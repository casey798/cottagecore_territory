import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { getItem, scan, deleteItem } from '../../shared/db';
import { Clan, ClanId, WsConnection } from '../../shared/types';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

async function postToAllConnections(
  endpoint: string,
  payload: string
): Promise<void> {
  const { items: connections } = await scan<WsConnection>('ws-connections');
  if (connections.length === 0) return;

  const apiGw = new ApiGatewayManagementApiClient({ endpoint });

  const postPromises = connections.map(async (conn) => {
    try {
      await apiGw.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: new TextEncoder().encode(payload),
        })
      );
    } catch (err) {
      if (err instanceof GoneException) {
        await deleteItem('ws-connections', { connectionId: conn.connectionId });
      }
    }
  });

  await Promise.allSettled(postPromises);
}

export async function broadcastScoreUpdate(stage: string): Promise<void> {
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT || '';
  if (!endpoint) return;

  try {
    const clans = await Promise.all(
      CLAN_IDS.map(async (clanId) => {
        const clan = await getItem<Clan>('clans', { clanId });
        return {
          clanId,
          todayXp: clan?.todayXp ?? 0,
          todayParticipants: clan?.todayParticipants ?? 0,
          rosterSize: clan?.rosterSize ?? 0,
        };
      })
    );

    const payload = JSON.stringify({
      type: 'SCORE_UPDATE',
      data: {
        clans,
        timestamp: new Date().toISOString(),
      },
    });

    await postToAllConnections(endpoint, payload);
  } catch {
    // WebSocket broadcast is non-fatal
  }
}

export async function broadcastCapture(
  winnerClan: string,
  spaceName: string,
  mapOverlayId: string,
  stage: string
): Promise<void> {
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT || '';
  if (!endpoint) return;

  try {
    const payload = JSON.stringify({
      type: 'CAPTURE',
      data: {
        winnerClan,
        spaceName,
        mapOverlayId,
      },
    });

    await postToAllConnections(endpoint, payload);
  } catch {
    // WebSocket broadcast is non-fatal
  }
}
