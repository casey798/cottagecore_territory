import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { updateItem } from '../../shared/db';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Admin check
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}');
    const { date, quietMode } = body;

    if (!date || typeof date !== 'string') {
      return error(ErrorCode.VALIDATION_ERROR, 'date is required (YYYY-MM-DD)', 400);
    }
    if (typeof quietMode !== 'boolean') {
      return error(ErrorCode.VALIDATION_ERROR, 'quietMode must be a boolean', 400);
    }

    try {
      await updateItem(
        'daily-config',
        { date },
        'SET quietMode = :qm',
        { ':qm': quietMode },
        { '#d': 'date' },
        'attribute_exists(#d)',
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ConditionalCheckFailedException') {
        return error(ErrorCode.NOT_FOUND, 'No config found for this date — save a config first before toggling quiet mode.', 400);
      }
      throw err;
    }

    return success({ date, quietMode });
  } catch (err) {
    console.error('[setQuietMode] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
