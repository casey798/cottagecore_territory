import { ScheduledEvent } from 'aws-lambda';
import { handler } from '../../../functions/scheduled/dailyScoring';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/notifications');
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));
jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PostToConnectionCommand: jest.fn(),
}));

import { getItem, scan, updateItem, putItem } from '../../../shared/db';
import { getTodayISTString } from '../../../shared/time';
import { sendToAll } from '../../../shared/notifications';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockUpdateItem = updateItem as jest.MockedFunction<typeof updateItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockSendToAll = sendToAll as jest.MockedFunction<typeof sendToAll>;

const TODAY = '2026-03-07';

const MOCK_DAILY_CONFIG = {
  date: TODAY,
  activeLocationIds: ['loc-1', 'loc-2'],
  targetSpace: {
    name: 'Central Courtyard',
    description: 'The heart of campus',
    mapOverlayId: 'overlay-courtyard',
  },
  qrSecret: 'test-secret',
  winnerClan: null,
  status: 'active',
};

const MOCK_EVENT: ScheduledEvent = {
  version: '0',
  id: 'test-event-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789',
  time: '2026-03-07T12:30:00Z',
  region: 'ap-south-1',
  resources: [],
  detail: {},
};

function makeClan(
  clanId: string,
  todayXp: number,
  todayXpTimestamp: string | null
) {
  return {
    clanId,
    todayXp,
    todayXpTimestamp: todayXpTimestamp ?? undefined,
    seasonXp: todayXp * 10,
    spacesCaptured: 0,
  };
}

describe('dailyScoring handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTodayISTString.mockReturnValue(TODAY);
    mockUpdateItem.mockResolvedValue(undefined);
    mockPutItem.mockResolvedValue(undefined);
    mockSendToAll.mockResolvedValue(0);

    // Default: no WS connections
    mockScan.mockImplementation(async (table: string) => {
      if (table === 'ws-connections') {
        return { items: [] };
      }
      if (table === 'users') {
        return { items: [] };
      }
      // clans scan
      return { items: [] };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setupClans(clans: ReturnType<typeof makeClan>[]): void {
    // The handler scans clans table
    let scanCallCount = 0;
    mockScan.mockImplementation(async (table: string) => {
      if (table === 'clans') {
        return { items: clans };
      }
      if (table === 'users') {
        return { items: [] };
      }
      if (table === 'ws-connections') {
        return { items: [] };
      }
      return { items: [] };
    });
  }

  function setupDailyConfig(): void {
    mockGetItem.mockImplementation(async (table: string) => {
      if (table === 'daily-config') {
        return MOCK_DAILY_CONFIG;
      }
      return undefined;
    });
  }

  describe('winner determination', () => {
    it('picks the clan with highest XP when no tie', async () => {
      setupDailyConfig();
      setupClans([
        makeClan('ember', 200, '2026-03-07T10:00:00.000Z'),
        makeClan('tide', 150, '2026-03-07T09:00:00.000Z'),
        makeClan('bloom', 100, '2026-03-07T08:00:00.000Z'),
        makeClan('gale', 50, '2026-03-07T11:00:00.000Z'),
      ]);

      await handler(MOCK_EVENT);

      // Should record ember as winner
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'daily-config',
        { date: TODAY },
        expect.stringContaining('winnerClan'),
        expect.objectContaining({ ':winner': 'ember' }),
        expect.any(Object)
      );

      // Should create captured space for ember
      expect(mockPutItem).toHaveBeenCalledWith(
        'captured-spaces',
        expect.objectContaining({
          clan: 'ember',
          spaceName: 'Central Courtyard',
        })
      );

    });

    it('uses tiebreaker: two clans tied on XP, earlier timestamp wins', async () => {
      setupDailyConfig();
      setupClans([
        makeClan('ember', 100, '2026-03-07T10:00:00.000Z'), // later
        makeClan('tide', 100, '2026-03-07T08:30:00.000Z'),  // earlier -> winner
        makeClan('bloom', 50, '2026-03-07T09:00:00.000Z'),
        makeClan('gale', 75, '2026-03-07T11:00:00.000Z'),
      ]);

      await handler(MOCK_EVENT);

      // Tide should win the tiebreaker (earlier timestamp)
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'daily-config',
        { date: TODAY },
        expect.stringContaining('winnerClan'),
        expect.objectContaining({ ':winner': 'tide' }),
        expect.any(Object)
      );

      expect(mockPutItem).toHaveBeenCalledWith(
        'captured-spaces',
        expect.objectContaining({ clan: 'tide' })
      );
    });

    it('uses tiebreaker: three clans tied, earliest timestamp wins', async () => {
      setupDailyConfig();
      setupClans([
        makeClan('ember', 100, '2026-03-07T10:00:00.000Z'),
        makeClan('tide', 100, '2026-03-07T09:30:00.000Z'),
        makeClan('bloom', 100, '2026-03-07T08:00:00.000Z'), // earliest -> winner
        makeClan('gale', 50, '2026-03-07T11:00:00.000Z'),
      ]);

      await handler(MOCK_EVENT);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        'daily-config',
        { date: TODAY },
        expect.stringContaining('winnerClan'),
        expect.objectContaining({ ':winner': 'bloom' }),
        expect.any(Object)
      );
    });

    it('clan with null todayXpTimestamp loses tie to clan with timestamp', async () => {
      setupDailyConfig();
      setupClans([
        makeClan('ember', 100, null),                        // no timestamp
        makeClan('tide', 100, '2026-03-07T10:00:00.000Z'),   // has timestamp -> winner
        makeClan('bloom', 50, '2026-03-07T09:00:00.000Z'),
        makeClan('gale', 25, '2026-03-07T08:00:00.000Z'),
      ]);

      await handler(MOCK_EVENT);

      expect(mockUpdateItem).toHaveBeenCalledWith(
        'daily-config',
        { date: TODAY },
        expect.stringContaining('winnerClan'),
        expect.objectContaining({ ':winner': 'tide' }),
        expect.any(Object)
      );
    });

    it('handles all clans at 0 XP gracefully (no winner)', async () => {
      setupClans([
        makeClan('ember', 0, null),
        makeClan('tide', 0, null),
        makeClan('bloom', 0, null),
        makeClan('gale', 0, null),
      ]);

      // getItem returns daily-config for status update
      mockGetItem.mockResolvedValue(MOCK_DAILY_CONFIG);

      await handler(MOCK_EVENT);

      // Should NOT create any captured-space
      expect(mockPutItem).not.toHaveBeenCalledWith(
        'captured-spaces',
        expect.anything()
      );

      // Should update daily-config status to complete without a winner
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'daily-config',
        { date: TODAY },
        expect.stringContaining('#status'),
        expect.objectContaining({ ':status': 'complete' }),
        expect.any(Object)
      );
    });
  });

  describe('notifications', () => {
    it('sends push notifications to all users with FCM tokens', async () => {
      setupDailyConfig();
      setupClans([
        makeClan('ember', 200, '2026-03-07T10:00:00.000Z'),
        makeClan('tide', 100, '2026-03-07T09:00:00.000Z'),
        makeClan('bloom', 50, '2026-03-07T08:00:00.000Z'),
        makeClan('gale', 25, '2026-03-07T07:00:00.000Z'),
      ]);

      // Override scan to return users with tokens
      mockScan.mockImplementation(async (table: string) => {
        if (table === 'clans') {
          return {
            items: [
              makeClan('ember', 200, '2026-03-07T10:00:00.000Z'),
              makeClan('tide', 100, '2026-03-07T09:00:00.000Z'),
              makeClan('bloom', 50, '2026-03-07T08:00:00.000Z'),
              makeClan('gale', 25, '2026-03-07T07:00:00.000Z'),
            ],
          };
        }
        if (table === 'users') {
          return {
            items: [
              { userId: 'u1', fcmToken: 'token-1', todayXp: 50, lastActiveDate: TODAY, currentStreak: 1, bestStreak: 1 },
              { userId: 'u2', fcmToken: 'token-2', todayXp: 0, lastActiveDate: '2026-03-06', currentStreak: 1, bestStreak: 1 },
              { userId: 'u3', fcmToken: '', todayXp: 0, lastActiveDate: '', currentStreak: 0, bestStreak: 0 },
            ],
          };
        }
        if (table === 'ws-connections') {
          return { items: [] };
        }
        return { items: [] };
      });

      await handler(MOCK_EVENT);

      // sendToAll should be called with capture result message
      expect(mockSendToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            title: 'Ember wins!',
          }),
          data: expect.objectContaining({ type: 'CAPTURE_RESULT', winnerClan: 'ember' }),
        })
      );
    });
  });

  describe('edge cases', () => {
    it('handles missing daily-config gracefully', async () => {
      mockGetItem.mockResolvedValue(undefined);
      setupClans([
        makeClan('ember', 100, '2026-03-07T10:00:00.000Z'),
      ]);

      // Should not throw
      await expect(handler(MOCK_EVENT)).resolves.toBeUndefined();
    });
  });
});
