import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { extractUserId } from '../../shared/auth';
import { updateItem } from '../../shared/db';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = extractUserId(event);

    const body = JSON.parse(event.body ?? '{}');
    const { tcVersion } = body;

    if (!tcVersion || typeof tcVersion !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'tcVersion is required' },
        }),
      };
    }

    const now = new Date().toISOString();

    await updateItem(
      'users',
      { userId },
      'SET tcAcceptedAt = :at, tcVersion = :v',
      { ':at': now, ':v': tcVersion },
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: { tcAcceptedAt: now, tcVersion },
      }),
    };
  } catch (err) {
    console.error('acceptTc error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal error' },
      }),
    };
  }
};
