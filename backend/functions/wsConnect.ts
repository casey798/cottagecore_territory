import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { putItem, getItem } from '../shared/db';
import { verifyToken } from '../shared/auth';
import { WsConnection, ClanId, User } from '../shared/types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connectionId' };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return { statusCode: 401, body: 'Missing token' };
  }

  try {
    const claims = await verifyToken(token);
    const userId = claims.uid;
    const user = await getItem<User>('users', { userId });
    const clan = (user?.clan as ClanId) ?? ClanId.Ember;

    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

    const connection: WsConnection = {
      connectionId,
      userId,
      clan,
      connectedAt: now,
      ttl,
    };

    await putItem('ws-connections', connection as unknown as Record<string, unknown>);

    console.log(`WebSocket connected: ${connectionId} for user ${userId}`);
    return { statusCode: 200, body: 'Connected' };
  } catch (err) {
    console.error('WebSocket auth failed:', err);
    return { statusCode: 401, body: 'Unauthorized' };
  }
};
