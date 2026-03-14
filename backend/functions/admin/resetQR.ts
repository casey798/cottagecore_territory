import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { updateItem } from '../../shared/db';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const date = body.date as string | undefined;

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return error(ErrorCode.VALIDATION_ERROR, 'Valid date (YYYY-MM-DD) is required', 400);
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
