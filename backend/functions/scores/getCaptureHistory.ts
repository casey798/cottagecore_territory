import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { CapturedSpace } from '../../shared/types';

const PAGE_SIZE = 14;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const seasonParam = event.queryStringParameters?.season;
    const seasonNum = seasonParam ? parseInt(seasonParam, 10) : 1;

    if (isNaN(seasonNum) || seasonNum < 1) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid season parameter', 400);
    }

    // Decode cursor from base64 if provided
    let exclusiveStartKey: Record<string, unknown> | undefined;
    const cursorParam = event.queryStringParameters?.cursor;
    if (cursorParam) {
      try {
        exclusiveStartKey = JSON.parse(
          Buffer.from(cursorParam, 'base64').toString('utf-8'),
        );
      } catch {
        return error(ErrorCode.VALIDATION_ERROR, 'Invalid cursor parameter', 400);
      }
    }

    const { items: captures, lastEvaluatedKey } = await query<CapturedSpace>(
      'captured-spaces',
      'season = :season',
      { ':season': String(seasonNum) },
      {
        indexName: 'SeasonIndex',
        limit: PAGE_SIZE,
        scanIndexForward: false,
        exclusiveStartKey,
      },
    );

    const history = captures.map((capture) => ({
      spaceId: capture.spaceId,
      date: capture.dateCaptured,
      spaceName: capture.spaceName,
      clan: capture.clan,
      mapOverlayId: capture.mapOverlayId,
    }));

    const nextCursor = lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : null;

    return success({ captures: history, nextCursor });
  } catch (err) {
    console.error('getCaptureHistory error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get capture history', 500);
  }
};
