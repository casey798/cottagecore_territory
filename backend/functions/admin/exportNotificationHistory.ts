import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { AdminNotification } from '../../shared/types';

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

const CSV_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'text/csv',
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const params = event.queryStringParameters || {};
    const startDate = params.startDate;
    const endDate = params.endDate;

    const allItems: AdminNotification[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const scanOpts: Parameters<typeof scan>[1] = { exclusiveStartKey: lastKey };
      if (startDate && endDate) {
        scanOpts.filterExpression = 'sentAt BETWEEN :start AND :end';
        scanOpts.expressionValues = { ':start': startDate, ':end': endDate };
      }
      const result = await scan<AdminNotification>('admin-notifications', scanOpts);
      allItems.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    // Sort by sentAt descending
    allItems.sort((a, b) => (b.sentAt > a.sentAt ? 1 : b.sentAt < a.sentAt ? -1 : 0));

    const header = 'notificationId,sentAt,sentBy,message,target,notificationType,deliveryCount';
    const rows = allItems.map((n) =>
      csvRow([
        n.notificationId, n.sentAt, n.sentBy, n.message,
        n.target, n.notificationType, n.deliveryCount,
      ])
    );

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportNotificationHistory] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
