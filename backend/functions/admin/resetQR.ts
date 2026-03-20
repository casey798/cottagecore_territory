import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { getItem, updateItem } from '../../shared/db';
import type { LocationMasterConfig } from '../../shared/types';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;

    // ── Per-location permanent QR regenerate ──────────────────────
    const locationId = body.locationId as string | undefined;
    if (locationId && typeof locationId === 'string') {
      const existing = await getItem<LocationMasterConfig>('location-master-config', { locationId });
      if (!existing) {
        return error(ErrorCode.NOT_FOUND, 'Location not found', 404);
      }

      await updateItem(
        'location-master-config',
        { locationId },
        'REMOVE qrSecret, qrGeneratedAt, qrImageBase64, qrPayload',
      );

      return success({ locationId, message: 'Permanent QR invalidated — regenerate to create a new one' });
    }

    // ── Daily QR reset (existing behavior) ────────────────────────
    const date = body.date as string | undefined;

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Valid date (YYYY-MM-DD) or locationId is required', 400);
    }

    await updateItem(
      'daily-config',
      { date },
      'REMOVE qrCodes',
    );

    return success({ date, message: 'QR codes reset' });
  } catch (err) {
    console.error('resetQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
