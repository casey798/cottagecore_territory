jest.mock('../../../shared/db');
jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PostToConnectionCommand: jest.fn().mockImplementation((params) => params),
    GoneException: class GoneException extends Error {
      constructor() {
        super('Gone');
        this.name = 'GoneException';
      }
    },
  };
});

import { broadcastScoreUpdate } from '../../../functions/websocket/broadcast';
import { getItem, scan, deleteItem } from '../../../shared/db';
import {
  ApiGatewayManagementApiClient,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockDeleteItem = deleteItem as jest.MockedFunction<typeof deleteItem>;

const ENDPOINT = 'https://abc123.execute-api.ap-south-1.amazonaws.com/dev';

describe('broadcastScoreUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBSOCKET_API_ENDPOINT = ENDPOINT;
  });

  afterEach(() => {
    delete process.env.WEBSOCKET_API_ENDPOINT;
  });

  it('sends SCORE_UPDATE to all active connections', async () => {
    mockScan.mockResolvedValue({
      items: [
        { connectionId: 'conn-1', userId: 'u1', clan: 'ember', connectedAt: '', ttl: 0 },
        { connectionId: 'conn-2', userId: 'u2', clan: 'tide', connectedAt: '', ttl: 0 },
      ],
    });

    mockGetItem.mockImplementation(async (_table, key) => {
      const id = (key as Record<string, string>).clanId;
      return { clanId: id, todayXp: 100 } as unknown as undefined;
    });

    await broadcastScoreUpdate('dev');

    const clientInstance = (ApiGatewayManagementApiClient as jest.Mock).mock.results[0].value;
    expect(clientInstance.send).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no connections exist', async () => {
    mockScan.mockResolvedValue({ items: [] });

    await broadcastScoreUpdate('dev');

    expect(ApiGatewayManagementApiClient).not.toHaveBeenCalled();
  });

  it('deletes stale GoneException connections silently', async () => {
    mockScan.mockResolvedValue({
      items: [
        { connectionId: 'conn-stale', userId: 'u1', clan: 'ember', connectedAt: '', ttl: 0 },
      ],
    });

    mockGetItem.mockResolvedValue({ clanId: 'ember', todayXp: 50 } as unknown as undefined);

    // Make send throw GoneException
    const goneErr = new GoneException({ message: 'Gone', $metadata: {} });
    const mockSendFn = jest.fn().mockRejectedValue(goneErr);
    (ApiGatewayManagementApiClient as jest.Mock).mockImplementation(() => ({
      send: mockSendFn,
    }));

    await broadcastScoreUpdate('dev');

    expect(mockDeleteItem).toHaveBeenCalledWith('ws-connections', {
      connectionId: 'conn-stale',
    });
  });

  it('does nothing when WEBSOCKET_API_ENDPOINT is not set', async () => {
    delete process.env.WEBSOCKET_API_ENDPOINT;

    await broadcastScoreUpdate('dev');

    expect(mockScan).not.toHaveBeenCalled();
  });
});
