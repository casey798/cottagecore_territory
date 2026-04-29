import crypto from 'crypto';
import QRCode from 'qrcode';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { scan, updateItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import type { Space } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Scan spaces table, collect all active spaces
    const activeSpaces: Space[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<Space>('spaces', {
        filterExpression: 'active = :t',
        expressionValues: { ':t': true },
        exclusiveStartKey: lastKey,
      });
      activeSpaces.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const now = new Date().toISOString();

    // Generate permanent QR payload for each active space
    // Re-use existing payload if already generated (idempotent)
    const spaces = await Promise.all(
      activeSpaces.map(async (space) => {
        // Already has a permanent QR — return cached version
        if (space.qrPayload && space.qrImageBase64) {
          return {
            spaceId: space.spaceId,
            spaceName: space.name,
            qrNumber: space.qrNumber,
            qrPayload: space.qrPayload,
            qrImageBase64: space.qrImageBase64,
            qrGeneratedAt: space.qrGeneratedAt ?? '',
            alreadyExisted: true,
          };
        }

        // Generate new permanent payload: HMAC over just spaceId (no timestamp)
        const message = space.spaceId;
        const hmac = crypto
          .createHmac('sha256', space.qrSecret)
          .update(message)
          .digest('hex');
        const qrPayload = `GROVE_SPACE:${space.spaceId}:permanent:${hmac}`;

        // Generate QR image server-side
        const qrImageBase64 = await QRCode.toDataURL(qrPayload, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M',
        });

        // Persist on the space record so future calls return cached version
        await updateItem(
          'spaces',
          { spaceId: space.spaceId },
          'SET qrPayload = :p, qrImageBase64 = :img, qrGeneratedAt = :t',
          { ':p': qrPayload, ':img': qrImageBase64, ':t': now },
        );

        return {
          spaceId: space.spaceId,
          spaceName: space.name,
          qrNumber: space.qrNumber,
          qrPayload,
          qrImageBase64,
          qrGeneratedAt: now,
          alreadyExisted: false,
        };
      }),
    );

    return success({ spaces });
  } catch (err) {
    console.error('adminGenerateSpaceQRs error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to generate space QR codes', 500);
  }
};
