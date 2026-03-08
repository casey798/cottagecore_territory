import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const STAGE = process.env.STAGE || 'dev';

export function tableName(name: string): string {
  return `grovewars-${STAGE}-${name}`;
}

export async function getItem<T>(
  table: string,
  key: Record<string, string | number>
): Promise<T | undefined> {
  const params: GetCommandInput = {
    TableName: tableName(table),
    Key: key,
  };
  const result = await docClient.send(new GetCommand(params));
  return result.Item as T | undefined;
}

export async function putItem<T extends Record<string, unknown>>(
  table: string,
  item: T
): Promise<void> {
  const params: PutCommandInput = {
    TableName: tableName(table),
    Item: item,
  };
  await docClient.send(new PutCommand(params));
}

export async function updateItem(
  table: string,
  key: Record<string, string | number>,
  updateExpression: string,
  expressionValues?: Record<string, unknown>,
  expressionNames?: Record<string, string>,
  conditionExpression?: string
): Promise<Record<string, unknown> | undefined> {
  const params: UpdateCommandInput = {
    TableName: tableName(table),
    Key: key,
    UpdateExpression: updateExpression,
    ReturnValues: 'ALL_NEW',
  };
  if (expressionValues) {
    params.ExpressionAttributeValues = expressionValues;
  }
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }
  if (conditionExpression) {
    params.ConditionExpression = conditionExpression;
  }
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes as Record<string, unknown> | undefined;
}

export async function deleteItem(
  table: string,
  key: Record<string, string | number>
): Promise<void> {
  const params: DeleteCommandInput = {
    TableName: tableName(table),
    Key: key,
  };
  await docClient.send(new DeleteCommand(params));
}

export async function query<T>(
  table: string,
  keyConditionExpression: string,
  expressionValues: Record<string, unknown>,
  options?: {
    indexName?: string;
    filterExpression?: string;
    expressionNames?: Record<string, string>;
    limit?: number;
    scanIndexForward?: boolean;
    exclusiveStartKey?: Record<string, unknown>;
  }
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, unknown> }> {
  const params: QueryCommandInput = {
    TableName: tableName(table),
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionValues,
  };
  if (options?.indexName) params.IndexName = options.indexName;
  if (options?.filterExpression) params.FilterExpression = options.filterExpression;
  if (options?.expressionNames) params.ExpressionAttributeNames = options.expressionNames;
  if (options?.limit) params.Limit = options.limit;
  if (options?.scanIndexForward !== undefined) params.ScanIndexForward = options.scanIndexForward;
  if (options?.exclusiveStartKey) params.ExclusiveStartKey = options.exclusiveStartKey;

  const result = await docClient.send(new QueryCommand(params));
  return {
    items: (result.Items || []) as T[],
    lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
  };
}

export async function scan<T>(
  table: string,
  options?: {
    filterExpression?: string;
    expressionValues?: Record<string, unknown>;
    expressionNames?: Record<string, string>;
    limit?: number;
    exclusiveStartKey?: Record<string, unknown>;
  }
): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, unknown> }> {
  const params: ScanCommandInput = {
    TableName: tableName(table),
  };
  if (options?.filterExpression) params.FilterExpression = options.filterExpression;
  if (options?.expressionValues) params.ExpressionAttributeValues = options.expressionValues;
  if (options?.expressionNames) params.ExpressionAttributeNames = options.expressionNames;
  if (options?.limit) params.Limit = options.limit;
  if (options?.exclusiveStartKey) params.ExclusiveStartKey = options.exclusiveStartKey;

  const result = await docClient.send(new ScanCommand(params));
  return {
    items: (result.Items || []) as T[],
    lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
  };
}

export async function batchWrite(
  table: string,
  items: Record<string, unknown>[]
): Promise<void> {
  const tbl = tableName(table);
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tbl]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    );
  }
}

export { docClient };
