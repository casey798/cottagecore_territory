import crypto from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { success, error, ErrorCode } from '../../shared/response';
import { generateQrSchema } from '../../shared/schemas';
import { getItem, updateItem, scan } from '../../shared/db';
import { generateQrPayload, generatePermanentQrPayload } from '../../shared/hmac';
import type { DailyConfig, Location, LocationMasterConfig, QrPayload } from '../../shared/types';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const ASSETS_BUCKET = process.env.ASSETS_BUCKET || '';

interface QrCodeEntry {
  locationId: string;
  locationName: string;
  payload: QrPayload;
  qrPayloadString: string;
  qrImageBase64: string;
}

async function generatePdf(
  qrCodes: QrCodeEntry[],
  date: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title page
    doc.fontSize(24).text(`GroveWars QR Codes`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Date: ${date}`, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).text(`${qrCodes.length} locations`, { align: 'center' });

    // Layout: 2 QR codes per row, 2 rows per page (quarter-page each)
    const pageWidth = 595.28 - 80; // A4 width minus margins
    const pageHeight = 841.89 - 80; // A4 height minus margins
    const cellWidth = pageWidth / 2;
    const cellHeight = pageHeight / 2;
    const qrSize = Math.min(cellWidth - 40, cellHeight - 80);

    for (let i = 0; i < qrCodes.length; i++) {
      if (i % 4 === 0) {
        if (i > 0) doc.addPage();
      }

      const qr = qrCodes[i];
      const col = (i % 4) % 2;
      const row = Math.floor((i % 4) / 2);
      const x = 40 + col * cellWidth;
      const y = 40 + row * cellHeight;

      // Location name label
      doc.fontSize(14).text(qr.locationName, x, y + 10, {
        width: cellWidth - 20,
        align: 'center',
      });

      // QR code image
      const imgX = x + (cellWidth - qrSize) / 2;
      const imgY = y + 40;

      // Convert base64 data URL to buffer
      const base64Data = qr.qrImageBase64.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');

      doc.image(imgBuffer, imgX, imgY, {
        width: qrSize,
        height: qrSize,
      });

      // Location ID (small text below)
      doc.fontSize(8).fillColor('#666666').text(
        qr.locationId,
        x,
        imgY + qrSize + 5,
        { width: cellWidth - 20, align: 'center' }
      );
      doc.fillColor('#000000');
    }

    doc.end();
  });
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Validate input
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const mode = body.mode as string | undefined;

    // ── Permanent QR generation mode ────────────────────────────────
    if (mode === 'permanent') {
      const allLocations: LocationMasterConfig[] = [];
      let lastKey: Record<string, unknown> | undefined;
      do {
        const result = await scan<LocationMasterConfig>('location-master-config', {
          exclusiveStartKey: lastKey,
        });
        allLocations.push(...result.items);
        lastKey = result.lastEvaluatedKey;
      } while (lastKey);

      allLocations.sort((a, b) => a.qrNumber - b.qrNumber);

      const qrCodesOut: { locationId: string; locationName: string; qrPayload: string; qrImageBase64: string; qrGeneratedAt: string; alreadyExisted: boolean; active: boolean }[] = [];

      for (const loc of allLocations) {
        // Skip locations that already have a permanent QR
        if (loc.qrSecret && loc.qrImageBase64 && loc.qrPayload) {
          qrCodesOut.push({
            locationId: loc.locationId,
            locationName: loc.name,
            qrPayload: loc.qrPayload,
            qrImageBase64: loc.qrImageBase64,
            qrGeneratedAt: loc.qrGeneratedAt ?? '',
            alreadyExisted: true,
            active: loc.active,
          });
          continue;
        }

        // Generate new secret if missing
        const locSecret = loc.qrSecret || crypto.randomBytes(32).toString('hex');
        const payload = generatePermanentQrPayload(loc.locationId, locSecret);
        const qrPayloadString = JSON.stringify(payload);

        const qrImageBase64 = await QRCode.toDataURL(qrPayloadString, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M',
        });

        const now = new Date().toISOString();

        await updateItem(
          'location-master-config',
          { locationId: loc.locationId },
          'SET qrSecret = :s, qrGeneratedAt = :t, qrImageBase64 = :img, qrPayload = :p',
          { ':s': locSecret, ':t': now, ':img': qrImageBase64, ':p': qrPayloadString },
        );

        qrCodesOut.push({
          locationId: loc.locationId,
          locationName: loc.name,
          qrPayload: qrPayloadString,
          qrImageBase64,
          qrGeneratedAt: now,
          alreadyExisted: false,
          active: loc.active,
        });
      }

      return success({ qrCodes: qrCodesOut, mode: 'permanent' });
    }

    // ── Daily QR generation mode (existing) ─────────────────────────
    const parsed = generateQrSchema.safeParse(body);
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { date } = parsed.data;

    // Get daily config
    const dailyConfig = await getItem<Record<string, unknown>>('daily-config', { date });
    if (!dailyConfig) {
      return error(ErrorCode.NOT_FOUND, 'Daily config not found for this date', 404);
    }

    // Return cached QR codes if they already exist
    const cachedQrCodes = dailyConfig.qrCodes as { locationId: string; locationName: string; qrPayload: string; qrImageBase64: string }[] | undefined;
    if (cachedQrCodes && cachedQrCodes.length > 0) {
      return success({
        qrCodes: cachedQrCodes,
        printablePdfKey: `qr-sheets/${date}.pdf`,
        cached: true,
      });
    }

    const { qrSecret, activeLocationIds } = dailyConfig as unknown as DailyConfig;

    // Generate QR codes for each active location
    const qrCodes: QrCodeEntry[] = [];

    for (const locationId of activeLocationIds) {
      const location = await getItem<Location>('locations', { locationId });
      const locationName = location?.name || locationId;

      const payload = generateQrPayload(locationId, date, qrSecret);
      const qrPayloadString = JSON.stringify(payload);

      const qrImageBase64 = await QRCode.toDataURL(qrPayloadString, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

      qrCodes.push({
        locationId,
        locationName,
        payload,
        qrPayloadString,
        qrImageBase64,
      });
    }

    // Generate PDF (non-fatal — QR images are the primary output)
    let pdfKey: string | null = null;
    try {
      const pdfBuffer = await generatePdf(qrCodes, date);
      pdfKey = `qr-sheets/${date}.pdf`;
      await s3.send(
        new PutObjectCommand({
          Bucket: ASSETS_BUCKET,
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
        })
      );
    } catch (pdfErr) {
      console.warn('PDF generation failed (non-fatal):', pdfErr);
    }

    // Persist generated QR codes to daily config for future retrieval
    const qrCodesForStorage = qrCodes.map((qr) => ({
      locationId: qr.locationId,
      locationName: qr.locationName,
      qrPayload: qr.qrPayloadString,
      qrImageBase64: qr.qrImageBase64,
    }));

    try {
      await updateItem(
        'daily-config',
        { date },
        'SET qrCodes = :qrCodes',
        { ':qrCodes': qrCodesForStorage },
      );
    } catch (saveErr) {
      console.warn('Failed to cache QR codes (non-fatal):', saveErr);
    }

    return success({
      qrCodes: qrCodesForStorage,
      printablePdfKey: pdfKey,
    });
  } catch (err) {
    console.error('generateQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
