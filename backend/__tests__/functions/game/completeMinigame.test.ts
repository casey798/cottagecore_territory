import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/game/completeMinigame';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/hmac');
jest.mock('../../../shared/auth');
jest.mock('../../../functions/websocket/broadcast', () => ({
  broadcastScoreUpdate: jest.fn().mockResolvedValue(undefined),
}));

import { getItem, putItem, updateItem, query, scan } from '../../../shared/db';
import { getTodayISTString, getMidnightISTAsISO, getNext8amISTEpochSeconds } from '../../../shared/time';
import { verifyCompletionHash, verifyClientCompletionHash } from '../../../shared/hmac';
import { extractUserId } from '../../../shared/auth';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;
const mockUpdateItem = updateItem as jest.MockedFunction<typeof updateItem>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockGetMidnightISTAsISO = getMidnightISTAsISO as jest.MockedFunction<typeof getMidnightISTAsISO>;
const mockGetNext8amISTEpochSeconds = getNext8amISTEpochSeconds as jest.MockedFunction<typeof getNext8amISTEpochSeconds>;
const mockVerifyCompletionHash = verifyCompletionHash as jest.MockedFunction<typeof verifyCompletionHash>;
const mockVerifyClientCompletionHash = verifyClientCompletionHash as jest.MockedFunction<typeof verifyClientCompletionHash>;
const mockExtractUserId = extractUserId as jest.MockedFunction<typeof extractUserId>;

const TODAY = '2026-03-07';
const USER_ID = 'user-abc-123';
const PARTNER_ID = 'user-partner-456';
const SESSION_ID = '660e8400-e29b-41d4-a716-446655440000';
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const COMPLETION_HASH = 'c'.repeat(64);
const SALT = 'test-salt-value';

function makeEvent(body: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/game/complete',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      authorizer: {
        claims: { sub: USER_ID },
      },
      accountId: '',
      apiId: '',
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: null,
        userArn: null,
      },
      path: '/game/complete',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: 0,
      resourceId: '',
      resourcePath: '',
      stage: 'dev',
    },
  };
}

function makeValidBody() {
  return {
    sessionId: SESSION_ID,
    result: 'win',
    completionHash: COMPLETION_HASH,
    timeTaken: 30,
    solutionData: { answer: 42 },
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
  return {
    sessionId: SESSION_ID,
    userId: USER_ID,
    locationId: LOCATION_ID,
    minigameId: 'grove-words',
    date: TODAY,
    startedAt: thirtySecondsAgo,
    completedAt: null,
    result: null,
    xpEarned: 0,
    chestDropped: false,
    chestAssetId: null,
    completionHash: '',
    coopPartnerId: null,
    _salt: SALT,
    timeLimit: 120,
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_ID,
    clan: 'ember',
    todayXp: 0,
    seasonXp: 0,
    totalWins: 0,
    currentStreak: 1,
    bestStreak: 1,
    lastActiveDate: '2026-03-06',
    ...overrides,
  };
}

describe('completeMinigame handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractUserId.mockReturnValue(USER_ID);
    mockGetTodayISTString.mockReturnValue(TODAY);
    mockGetMidnightISTAsISO.mockReturnValue('2026-03-07T18:30:00.000Z');
    mockGetNext8amISTEpochSeconds.mockReturnValue(1741363800);
    // Default: client hash succeeds
    mockVerifyClientCompletionHash.mockReturnValue(true);
    mockVerifyCompletionHash.mockReturnValue(false);
    mockUpdateItem.mockResolvedValue({ todayXp: 25, seasonXp: 25 });
    mockPutItem.mockResolvedValue(undefined);
    mockScan.mockResolvedValue({ items: [] });
    mockQuery.mockResolvedValue({ items: [] });
  });

  describe('win path', () => {
    it('awards 25 XP, updates clan atomically, and rolls chest on valid win', async () => {
      mockGetItem.mockImplementation(async (table: string, key?: Record<string, string | number>) => {
        if (table === 'game-sessions') return makeSession();
        if (table === 'users') return makeUser();
        if (table === 'locations') {
          return { locationId: LOCATION_ID, chestDropModifier: 1 };
        }
        if (table === 'clans') return { clanId: 'ember', todayXp: 25 };
        return undefined;
      });

      mockUpdateItem.mockResolvedValue({ todayXp: 25, seasonXp: 25 });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.result).toBe('win');
      expect(responseBody.data.xpEarned).toBe(25);

      // Verify user XP was updated with ADD (atomic, with daily cap condition)
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'users',
        { userId: USER_ID },
        expect.stringContaining('ADD todayXp'),
        expect.objectContaining({ ':xp': 25 }),
        undefined,
        'todayXp <= :maxXp'
      );

      // Verify clan XP was updated with ADD (atomic)
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'clans',
        { clanId: 'ember' },
        expect.stringContaining('ADD todayXp'),
        expect.objectContaining({ ':xp': 25 })
      );
    });

    it('increments streak when lastActiveDate is not today', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        if (table === 'users') {
          return makeUser({ lastActiveDate: '2026-03-06', currentStreak: 3, bestStreak: 5 });
        }
        if (table === 'locations') {
          return { locationId: LOCATION_ID, chestDropModifier: 1 };
        }
        if (table === 'clans') return { clanId: 'ember', todayXp: 25 };
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      await handler(event);

      // Verify streak was updated
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'users',
        { userId: USER_ID },
        expect.stringContaining('currentStreak'),
        expect.objectContaining({ ':streak': 4, ':best': 5 })
      );
    });

    it('awards XP to co-op partner on win', async () => {
      const session = makeSession({ coopPartnerId: PARTNER_ID });
      const callCount: Record<string, number> = {};

      mockGetItem.mockImplementation(async (table: string, key?: Record<string, string | number>) => {
        const k = `${table}:${JSON.stringify(key)}`;
        callCount[k] = (callCount[k] || 0) + 1;
        if (table === 'game-sessions') return session;
        if (table === 'users') {
          const uid = key?.userId as string;
          if (uid === PARTNER_ID) {
            return makeUser({ userId: PARTNER_ID, clan: 'ember', lastActiveDate: '2026-03-06' });
          }
          return makeUser();
        }
        if (table === 'locations') {
          return { locationId: LOCATION_ID, chestDropModifier: 1 };
        }
        if (table === 'clans') return { clanId: 'ember', todayXp: 50 };
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(responseBody.data.result).toBe('win');

      // Verify partner XP was also updated (with daily cap condition)
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'users',
        { userId: PARTNER_ID },
        expect.stringContaining('ADD todayXp'),
        expect.objectContaining({ ':xp': 25 }),
        undefined,
        'todayXp <= :maxXp'
      );

      // Verify clan XP was incremented twice (player + partner)
      const clanCalls = (mockUpdateItem as jest.Mock).mock.calls.filter(
        (call: unknown[]) => call[0] === 'clans'
      );
      expect(clanCalls.length).toBe(2);
    });

    it('does not write completedMinigameIds to player-assignments', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        if (table === 'users') return makeUser();
        if (table === 'locations') return { locationId: LOCATION_ID, chestDropModifier: 1 };
        if (table === 'clans') return { clanId: 'ember', todayXp: 25 };
        return undefined;
      });

      mockUpdateItem.mockResolvedValue({ todayXp: 25, seasonXp: 25 });

      const event = makeEvent(makeValidBody());
      await handler(event);

      // Verify NO updateItem call targets player-assignments
      const assignmentCalls = (mockUpdateItem as jest.Mock).mock.calls.filter(
        (call: unknown[]) => call[0] === 'player-assignments'
      );
      expect(assignmentCalls.length).toBe(0);
    });

    it('stores solutionData on the session for analytics', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        if (table === 'users') return makeUser();
        if (table === 'locations') return { locationId: LOCATION_ID, chestDropModifier: 1 };
        if (table === 'clans') return { clanId: 'ember', todayXp: 25 };
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      await handler(event);

      // Session update should include solutionData
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'game-sessions',
        { sessionId: SESSION_ID },
        expect.stringContaining('solutionData'),
        expect.objectContaining({ ':sd': { answer: 42 } }),
        expect.anything()
      );
    });
  });

  describe('lose path', () => {
    it('creates lock record and awards 0 XP on loss', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        return undefined;
      });

      const body = makeValidBody();
      body.result = 'lose';
      const event = makeEvent(body);
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.result).toBe('lose');
      expect(responseBody.data.xpEarned).toBe(0);
      expect(responseBody.data.locationLocked).toBe(true);

      expect(mockPutItem).toHaveBeenCalledWith(
        'player-locks',
        expect.objectContaining({
          dateUserLocation: `${TODAY}#${USER_ID}#${LOCATION_ID}`,
        })
      );
    });
  });

  describe('error cases', () => {
    it('returns SESSION_NOT_FOUND when session does not exist', async () => {
      mockGetItem.mockResolvedValue(undefined);

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(404);
      expect(responseBody.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('returns SESSION_NOT_FOUND when session belongs to a different user', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession({ userId: 'different-user-id' });
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(404);
      expect(responseBody.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('returns SESSION_COMPLETED when session was already completed', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') {
          return makeSession({ completedAt: '2026-03-07T10:00:00.000Z', result: 'win' });
        }
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('SESSION_COMPLETED');
    });

    it('returns INVALID_HASH when neither client nor server hash matches', async () => {
      mockVerifyClientCompletionHash.mockReturnValue(false);
      mockVerifyCompletionHash.mockReturnValue(false);

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('INVALID_HASH');
    });

    it('accepts server-salt hash as fallback when client hash fails', async () => {
      mockVerifyClientCompletionHash.mockReturnValue(false);
      mockVerifyCompletionHash.mockReturnValue(true);

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        if (table === 'users') return makeUser();
        if (table === 'locations') return { locationId: LOCATION_ID, chestDropModifier: 1 };
        if (table === 'clans') return { clanId: 'ember', todayXp: 25 };
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(responseBody.data.result).toBe('win');
    });

    it('returns SUSPICIOUS_TIME when completion is too fast (< 5 seconds)', async () => {
      const twoSecondsAgo = new Date(Date.now() - 2 * 1000).toISOString();

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession({ startedAt: twoSecondsAgo });
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('SUSPICIOUS_TIME');
    });

    it('returns SUSPICIOUS_TIME when completion exceeds timeLimit + grace period', async () => {
      const twoHundredSecondsAgo = new Date(Date.now() - 200 * 1000).toISOString();

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') {
          return makeSession({ startedAt: twoHundredSecondsAgo, timeLimit: 120 });
        }
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('SUSPICIOUS_TIME');
    });

    it('returns MINIGAME_ALREADY_PLAYED when same minigame already won at this location today', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'game-sessions') return makeSession();
        return undefined;
      });

      mockQuery.mockResolvedValue({
        items: [
          {
            sessionId: 'prev-session',
            userId: USER_ID,
            locationId: LOCATION_ID,
            minigameId: 'grove-words',
            result: 'win',
            completedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            date: TODAY,
          },
        ],
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('MINIGAME_ALREADY_PLAYED');
    });
  });
});
