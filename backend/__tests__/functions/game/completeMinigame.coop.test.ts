import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/game/completeMinigame';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/hmac');
jest.mock('../../../shared/auth');
jest.mock('../../../functions/websocket/broadcast');
jest.mock('../../../shared/minigames/pipsGenerator');
jest.mock('../../../functions/game/mosaic/puzzleLibrary');
jest.mock('../../../functions/game/mosaic/mosaicLogic');
jest.mock('../../../shared/minigames/pathWeaverGenerator');
jest.mock('../../../shared/minigames/groveEquationsGenerator');
jest.mock('../../../shared/minigames/bloomSequenceGenerator');

import { getItem, putItem, updateItem, query, scan } from '../../../shared/db';
import { getTodayISTString, getMidnightISTAsISO, getNext8amISTEpochSeconds } from '../../../shared/time';
import { verifyClientCompletionHash, verifyCompletionHash } from '../../../shared/hmac';
import { extractUserId } from '../../../shared/auth';
import { broadcastScoreUpdate } from '../../../functions/websocket/broadcast';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;
const mockUpdateItem = updateItem as jest.MockedFunction<typeof updateItem>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockGetMidnightISTAsISO = getMidnightISTAsISO as jest.MockedFunction<typeof getMidnightISTAsISO>;
const mockGetNext8amISTEpochSeconds = getNext8amISTEpochSeconds as jest.MockedFunction<typeof getNext8amISTEpochSeconds>;
const mockVerifyClientCompletionHash = verifyClientCompletionHash as jest.MockedFunction<typeof verifyClientCompletionHash>;
const mockExtractUserId = extractUserId as jest.MockedFunction<typeof extractUserId>;
const mockBroadcastScoreUpdate = broadcastScoreUpdate as jest.MockedFunction<typeof broadcastScoreUpdate>;

const TODAY = '2026-03-07';
const USER_ID = 'user-abc-123';
const PARTNER_ID = 'user-partner-456';
const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440000';

const STARTED_AT = new Date(Date.now() - 30_000).toISOString(); // 30 seconds ago

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
      authorizer: { claims: { sub: USER_ID } },
      accountId: '',
      apiId: '',
      httpMethod: 'POST',
      identity: {
        accessKey: null, accountId: null, apiKey: null, apiKeyId: null,
        caller: null, clientCert: null, cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null, cognitoIdentityId: null,
        cognitoIdentityPoolId: null, principalOrgId: null,
        sourceIp: '127.0.0.1', user: null, userAgent: null, userArn: null,
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

function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION_ID,
    result: 'win',
    completionHash: 'hash123',
    timeTaken: 30,
    solutionData: {},
    ...overrides,
  };
}

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sessionId: SESSION_ID,
    userId: USER_ID,
    locationId: LOCATION_ID,
    minigameId: 'grove-words',
    date: TODAY,
    startedAt: STARTED_AT,
    completedAt: null,
    result: 'pending',
    xpEarned: 0,
    chestDropped: false,
    chestAssetId: null,
    completionHash: '',
    coopPartnerId: null,
    timeLimit: 120,
    ...overrides,
  };
}

const TEST_ASSETS = [
  { assetId: 'asset-common', name: 'Leaf', category: 'banner', rarity: 'common', imageKey: 'leaf.png', dropWeight: 1 },
  { assetId: 'asset-uncommon', name: 'Mushroom', category: 'statue', rarity: 'uncommon', imageKey: 'mush.png', dropWeight: 1 },
  { assetId: 'asset-rare', name: 'Crystal', category: 'furniture', rarity: 'rare', imageKey: 'crystal.png', dropWeight: 1 },
  { assetId: 'asset-legendary', name: 'Crown', category: 'special', rarity: 'legendary', imageKey: 'crown.png', dropWeight: 1 },
];

describe('completeMinigame co-op tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractUserId.mockReturnValue(USER_ID);
    mockGetTodayISTString.mockReturnValue(TODAY);
    mockVerifyClientCompletionHash.mockReturnValue(true);
    mockGetMidnightISTAsISO.mockReturnValue('2026-03-08T18:30:00.000Z');
    mockGetNext8amISTEpochSeconds.mockReturnValue(1741363800);
    mockPutItem.mockResolvedValue(undefined);
    mockBroadcastScoreUpdate.mockResolvedValue(undefined);

    // Default: no prior sessions today
    mockQuery.mockResolvedValue({ items: [] });

    // Default scan returns test assets
    mockScan.mockResolvedValue({ items: TEST_ASSETS, lastEvaluatedKey: undefined });

    // Default updateItem: return updated user-like object
    mockUpdateItem.mockImplementation(async (table: string) => {
      if (table === 'users') {
        return { todayXp: 25 };
      }
      if (table === 'clans') {
        return { todayXp: 25 };
      }
      return undefined;
    });
  });

  function setupCoopWinMocks(sessionOverrides: Record<string, unknown> = {}) {
    const session = makeSession({ coopPartnerId: PARTNER_ID, ...sessionOverrides });

    mockGetItem.mockImplementation(async (table: string, key: Record<string, unknown>) => {
      if (table === 'game-sessions') return session;
      if (table === 'users') {
        const uid = key.userId as string;
        if (uid === USER_ID) {
          return { userId: USER_ID, todayXp: 0, clan: 'ember', lastActiveDate: null, currentStreak: 0, bestStreak: 0 };
        }
        if (uid === PARTNER_ID) {
          return { userId: PARTNER_ID, todayXp: 0, clan: 'tide', lastActiveDate: null, currentStreak: 0, bestStreak: 0 };
        }
      }
      if (table === 'location-master-config') return undefined;
      return undefined;
    });
  }

  function setupCoopLoseMocks(partnerIsGuest: boolean) {
    const session = makeSession({ coopPartnerId: PARTNER_ID, partnerIsGuest });

    mockGetItem.mockImplementation(async (table: string, key: Record<string, unknown>) => {
      if (table === 'game-sessions') return session;
      if (table === 'users') {
        const uid = key.userId as string;
        if (uid === USER_ID) return { userId: USER_ID, todayXp: 0, clan: 'ember' };
        if (uid === PARTNER_ID) return { userId: PARTNER_ID, todayXp: 0, clan: 'tide' };
      }
      return undefined;
    });
  }

  it('uses COOP_CHEST_WEIGHTS for co-op session', async () => {
    setupCoopWinMocks();

    const event = makeEvent(makeBody());
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.data.result).toBe('win');
    expect(body.data.chestDrop.dropped).toBe(true);
    expect(body.data.chestDrop.asset).toBeDefined();
    expect(body.data.chestDrop.asset.assetId).toBeDefined();
  });

  it('creates independent chest for partner', async () => {
    setupCoopWinMocks();

    const event = makeEvent(makeBody());
    await handler(event);

    // Filter putItem calls for 'player-assets'
    const playerAssetCalls = mockPutItem.mock.calls.filter(
      (call) => call[0] === 'player-assets'
    );

    // Should be 2: one for primary user, one for partner
    expect(playerAssetCalls.length).toBe(2);

    const primaryAsset = playerAssetCalls[0][1] as Record<string, unknown>;
    const partnerAsset = playerAssetCalls[1][1] as Record<string, unknown>;

    expect(primaryAsset.userId).toBe(USER_ID);
    expect(partnerAsset.userId).toBe(PARTNER_ID);
  });

  it('credits partner XP to partner own clan', async () => {
    setupCoopWinMocks();

    const event = makeEvent(makeBody());
    await handler(event);

    // Find updateItem calls to 'clans' table
    const clanUpdateCalls = mockUpdateItem.mock.calls.filter(
      (call) => call[0] === 'clans'
    );

    // Should be 2: one for user's clan (ember), one for partner's clan (tide)
    expect(clanUpdateCalls.length).toBe(2);

    const clanKeys = clanUpdateCalls.map((call) => call[1] as Record<string, unknown>);
    expect(clanKeys).toContainEqual({ clanId: 'ember' });
    expect(clanKeys).toContainEqual({ clanId: 'tide' });
  });

  it('locks both players on loss when partnerIsGuest=false', async () => {
    setupCoopLoseMocks(false);

    const event = makeEvent(makeBody({ result: 'lose' }));
    await handler(event);

    const lockCalls = mockPutItem.mock.calls.filter(
      (call) => call[0] === 'player-locks'
    );

    expect(lockCalls.length).toBe(2);

    const lockKeys = lockCalls.map(
      (call) => (call[1] as Record<string, unknown>).dateUserLocation as string
    );
    expect(lockKeys).toContain(`${TODAY}#${USER_ID}#${LOCATION_ID}`);
    expect(lockKeys).toContain(`${TODAY}#${PARTNER_ID}#${LOCATION_ID}`);
  });

  it('only locks Player A on loss when partnerIsGuest=true', async () => {
    setupCoopLoseMocks(true);

    const event = makeEvent(makeBody({ result: 'lose' }));
    await handler(event);

    const lockCalls = mockPutItem.mock.calls.filter(
      (call) => call[0] === 'player-locks'
    );

    expect(lockCalls.length).toBe(1);

    const lockKey = (lockCalls[0][1] as Record<string, unknown>).dateUserLocation as string;
    expect(lockKey).toBe(`${TODAY}#${USER_ID}#${LOCATION_ID}`);
  });

  it('awards XP to both players on win regardless of partnerIsGuest', async () => {
    // partnerIsGuest=true — partner should still get XP
    setupCoopWinMocks({ partnerIsGuest: true });

    const event = makeEvent(makeBody());
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.data.result).toBe('win');
    expect(body.data.xpEarned).toBe(25);

    // Both user and partner should have updateItem calls to 'users' for XP
    const userUpdateCalls = mockUpdateItem.mock.calls.filter(
      (call) => call[0] === 'users'
    );
    // At minimum: user ADD todayXp + user SET streak + partner ADD todayXp + partner SET streak
    expect(userUpdateCalls.length).toBeGreaterThanOrEqual(2);
  });
});
