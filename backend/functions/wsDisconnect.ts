import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { deleteItem } from '../shared/db';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connectionId' };
  }

  try {
    await deleteItem('ws-connections', { connectionId });
    console.log(`WebSocket disconnected: ${connectionId}`);
  } catch (err) {
    console.error(`Failed to delete connection ${connectionId}:`, err);
  }

  return { statusCode: 200, body: 'Disconnected' };
};
