import crypto from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { getItem } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { getTodayISTString } from '../../shared/time';
import { Space, SpaceAssignment } from '../../shared/types';
import { getOrCreateSpaceAssignment } from '../../shared/spaceAssignment';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const qrPayload = body.qrPayload;

    if (typeof qrPayload !== 'string' || qrPayload.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'qrPayload is required', 400);
    }

    // Step 1: Parse payload — format: "GROVE_SPACE:spaceId:permanent:hmac"
    const parts = qrPayload.split(':');
    if (parts.length !== 4 || parts[0] !== 'GROVE_SPACE') {
      return error(ErrorCode.QR_INVALID, 'Malformed space QR code', 400);
    }
    const [, spaceId, mode, hmac] = parts;
    if (!spaceId || !hmac || mode !== 'permanent') {
      return error(ErrorCode.QR_INVALID, 'Malformed space QR code', 400);
    }

    const stage = process.env.STAGE || 'dev';
    const isDevBypass = stage === 'dev' && hmac === 'dev-bypass';

    // Step 2: Fetch space from spaces table
    const space = await getItem<Space>('spaces', { spaceId });
    if (!space) {
      return error(ErrorCode.NOT_FOUND, 'Space not found', 404);
    }
    if (!space.active) {
      return error(ErrorCode.GAME_INACTIVE, 'This space is not currently active', 400);
    }

    // Step 3: HMAC verification — skipped for dev bypass
    if (!isDevBypass) {
      const message = spaceId;
      const expectedHmac = crypto.createHmac('sha256', space.qrSecret).update(message).digest('hex');
      try {
        const valid = crypto.timingSafeEqual(
          Buffer.from(hmac, 'hex'),
          Buffer.from(expectedHmac, 'hex')
        );
        if (!valid) {
          return error(ErrorCode.QR_INVALID, 'Invalid QR code', 401);
        }
      } catch {
        return error(ErrorCode.QR_INVALID, 'Invalid QR code', 401);
      }
    }

    // Step 5: Get or lazy-create today's space assignment
    const today = getTodayISTString();
    const assignment = await getOrCreateSpaceAssignment(userId, today);

    // Step 6: Check spaceId in assignedSpaceIds — skipped for dev bypass
    if (!isDevBypass && !assignment.assignedSpaceIds.includes(spaceId)) {
      return error(ErrorCode.NOT_ASSIGNED, 'Space not assigned to you today', 403);
    }

    // Allow re-decoration — player can redo a space as many times as they want within the day
    return success({
      spaceId,
      spaceName: space.name,
      polygonPoints: space.polygonPoints,
      gridCells: space.gridCells,
      gridColumns: space.gridColumns,
      gridRows: space.gridRows,
      alreadyDecorated: false,
    });
  } catch (err) {
    console.error('scanSpaceQR error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
};
