import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/game/startMinigame';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/hmac');
jest.mock('../../../shared/auth');
jest.mock('../../../shared/minigames/pipsGenerator');
jest.mock('../../../shared/minigames/pathWeaverGenerator');
jest.mock('../../../shared/minigames/groveEquationsGenerator');
jest.mock('../../../shared/minigames/bloomSequenceGenerator');
jest.mock('../../../functions/game/mosaic/puzzleLibrary');

import { getItem, putItem, query } from '../../../shared/db';
import { getTodayISTString } from '../../../shared/time';
import { extractUserId } from '../../../shared/auth';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockExtractUserId = extractUserId as jest.MockedFunction<typeof extractUserId>;

const TODAY = '2026-03-07';
const USER_ID = 'user-abc-123';
const PARTNER_ID = '00000000-0000-0000-0000-000000000001';
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeEvent(body: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/game/start',
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
      path: '/game/start',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: 0,
      resourceId: '',
      resourcePath: '',
      stage: 'dev',
    },
  };
}

function makeBody(overrides: Partial<{ locationId: string; minigameId: string; coopPartnerId: string | null }> = {}) {
  return {
    locationId: LOCATION_ID,
    minigameId: 'kindred-coop',
    coopPartnerId: PARTNER_ID,
    ...overrides,
  };
}

describe('startMinigame co-op tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractUserId.mockReturnValue(USER_ID);
    mockGetTodayISTString.mockReturnValue(TODAY);
    mockPutItem.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ items: [] });
  });

  function setupGetItem(overrides: Partial<{
    location: Record<string, unknown> | undefined;
    user: Record<string, unknown> | undefined;
    partner: Record<string, unknown> | undefined;
    lock: Record<string, unknown> | undefined;
    dailyConfig: Record<string, unknown> | undefined;
    masterConfig: Record<string, unknown> | undefined;
  }> = {}) {
    const defaults = {
      location: {
        locationId: LOCATION_ID, name: 'Test Location', gpsLat: 13.0, gpsLng: 80.2,
        geofenceRadius: 100, category: 'courtyard', active: true, chestDropModifier: 1, notes: '',
      },
      user: { userId: USER_ID, displayName: 'Alice', clan: 'ember', todayXp: 0 },
      partner: { userId: PARTNER_ID, displayName: 'Bob', clan: 'tide', todayXp: 0 },
      lock: undefined as Record<string, unknown> | undefined,
      dailyConfig: {
        date: TODAY, activeLocationIds: [LOCATION_ID], qrSecret: 'secret',
        targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
        status: 'active', winnerClan: null,
      },
      masterConfig: undefined as Record<string, unknown> | undefined,
      ...overrides,
    };

    mockGetItem.mockImplementation(async (table: string, key: Record<string, unknown>) => {
      if (table === 'locations') return defaults.location;
      if (table === 'users') {
        if (key.userId === PARTNER_ID) return defaults.partner;
        return defaults.user;
      }
      if (table === 'player-locks') return defaults.lock;
      if (table === 'daily-config') return defaults.dailyConfig;
      if (table === 'location-master-config') return defaults.masterConfig;
      return undefined;
    });
  }

  it('accepts cross-clan partner', async () => {
    setupGetItem(); // user clan 'ember', partner clan 'tide'

    const event = makeEvent(makeBody());
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBeDefined();
  });

  it('rejects solo minigame at coopOnly location', async () => {
    setupGetItem({
      masterConfig: {
        locationId: LOCATION_ID, coopOnly: true, spaceFact: null,
        firstVisitBonus: false, bonusXP: false, minigameAffinity: null,
      },
    });

    const event = makeEvent(makeBody({ minigameId: 'kindred', coopPartnerId: PARTNER_ID }));
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns COOP_REQUIRED at coopOnly location without partner', async () => {
    setupGetItem({
      masterConfig: {
        locationId: LOCATION_ID, coopOnly: true, spaceFact: null,
        firstVisitBonus: false, bonusXP: false, minigameAffinity: null,
      },
    });

    const event = makeEvent(makeBody({ coopPartnerId: null }));
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.error.code).toBe('COOP_REQUIRED');
  });

  it('injects p1/p2 names and clans into puzzleData', async () => {
    setupGetItem();

    const event = makeEvent(makeBody());
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.data.puzzleData.p1Name).toBe('Alice');
    expect(body.data.puzzleData.p1Clan).toBe('ember');
    expect(body.data.puzzleData.p2Name).toBe('Bob');
    expect(body.data.puzzleData.p2Clan).toBe('tide');
  });
});
