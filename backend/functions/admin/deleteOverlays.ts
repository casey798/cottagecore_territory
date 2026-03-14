import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { deleteItem, scan } from '../../shared/db';
import { WsConnection } from '../../shared/types';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const spaceIds = body.spaceIds;

    if (!Array.isArray(spaceIds) || spaceIds.length === 0) {
      return error(ErrorCode.VALIDATION_ERROR, 'spaceIds must be a non-empty array', 400);
    }

    if (spaceIds.some((id) => typeof id !== 'string')) {
      return error(ErrorCode.VALIDATION_ERROR, 'All spaceIds must be strings', 400);
    }

    // Delete the captured-space records
    let deleted = 0;
    for (const spaceId of spaceIds) {
      await deleteItem('captured-spaces', { spaceId });
      deleted++;
    }

    // Broadcast SCORES_CHANGED via WebSocket
    try {
      const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
      if (wsEndpoint) {
        const apiGw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });
        const connectionsResult = await scan<WsConnection>('ws-connections');
        const connections = connectionsResult.items;

        const payload = JSON.stringify({
          type: 'SCORES_CHANGED',
          data: {},
        });

        for (const conn of connections) {
          try {
            await apiGw.send(
              new PostToConnectionCommand({
                ConnectionId: conn.connectionId,
                Data: new TextEncoder().encode(payload),
              })
            );
          } catch (wsErr) {
            console.warn(`Failed to send to connection ${conn.connectionId}:`, wsErr);
          }
        }
        console.log(`Broadcast SCORES_CHANGED to ${connections.length} connections`);
      }
    } catch (broadcastErr) {
      console.error('WebSocket broadcast failed (non-fatal):', broadcastErr);
    }

    return success({ deleted });
  } catch (err) {
    console.error('deleteOverlays error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Failed to delete overlays', 500);
  }
}
