import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { error, ErrorCode } from '../../shared/response';
import { scan } from '../../shared/db';
import type { DailyConfig } from '../../shared/types';

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

    const allItems: DailyConfig[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const scanOpts: Parameters<typeof scan>[1] = { exclusiveStartKey: lastKey };
      if (startDate && endDate) {
        scanOpts.filterExpression = '#d BETWEEN :start AND :end';
        scanOpts.expressionNames = { '#d': 'date' };
        scanOpts.expressionValues = { ':start': startDate, ':end': endDate };
      }
      const result = await scan<DailyConfig>('daily-config', scanOpts);
      allItems.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    const header = 'date,activeLocationIds,targetSpaceName,winnerClan,status';
    const rows = allItems.map((d) =>
      csvRow([
        d.date,
        d.activeLocationIds?.join(';') ?? '',
        d.targetSpace?.name ?? '',
        d.winnerClan ?? '',
        d.status,
      ])
    );

    return {
      statusCode: 200,
      headers: CSV_HEADERS,
      body: [header, ...rows].join('\n'),
    };
  } catch (err) {
    console.error('[exportDailyConfigs] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}
