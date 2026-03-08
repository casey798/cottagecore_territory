import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { success, error, ErrorCode } from '../../shared/response';
import { generateQrSchema } from '../../shared/schemas';
import { getItem } from '../../shared/db';
import { generateQrPayload } from '../../shared/hmac';
import type { DailyConfig, Location, QrPayload } from '../../shared/types';

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
    const claims = event.requestContext.authorizer?.claims;
    if (!claims) return error(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    const groups: string[] = ((claims['cognito:groups'] as string) || '').split(',').filter(Boolean);
    if (!groups.some((g) => g.toLowerCase() === 'admin')) {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Validate input
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const parsed = generateQrSchema.safeParse(body);
    if (!parsed.success) {
      return error(ErrorCode.VALIDATION_ERROR, parsed.error.message, 400);
    }

    const { date } = parsed.data;

    // Get daily config
    const dailyConfig = await getItem<DailyConfig>('daily-config', { date });
    if (!dailyConfig) {
      return error(ErrorCode.NOT_FOUND, 'Daily config not found for this date', 404);
    }

    const { qrSecret, activeLocationIds } = dailyConfig;

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

    // Generate PDF
    const pdfBuffer = await generatePdf(qrCodes, date);

    // Upload PDF to S3
    const pdfKey = `qr-sheets/${date}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: ASSETS_BUCKET,
        Key: pdfKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

    return success({
      qrCodes: qrCodes.map((qr) => ({
        locationId: qr.locationId,
        locationName: qr.locationName,
        qrPayload: qr.qrPayloadString,
        qrImageBase64: qr.qrImageBase64,
      })),
      printablePdfKey: pdfKey,
    });
  } catch (err) {
    console.error('generateQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
