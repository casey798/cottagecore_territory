import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import { CapturedSpace } from '../../shared/types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const seasonParam = event.queryStringParameters?.season;
    const seasonNum = seasonParam ? parseInt(seasonParam, 10) : 1;

    if (isNaN(seasonNum) || seasonNum < 1) {
      return error(ErrorCode.VALIDATION_ERROR, 'Invalid season parameter', 400);
    }

    const { items: spaces } = await query<CapturedSpace>(
      'captured-spaces',
      'season = :season',
      { ':season': String(seasonNum) },
      { indexName: 'SeasonIndex' }
    );

    return success({ spaces });
  } catch (err) {
    console.error('getCapturedSpaces error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to get captured spaces', 500);
  }
};
