import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/game/scanQR';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/hmac');
jest.mock('../../../shared/auth');

import { getItem, query } from '../../../shared/db';
import { getTodayISTString } from '../../../shared/time';
import { verifyQrPayload } from '../../../shared/hmac';
import { extractUserId } from '../../../shared/auth';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockVerifyQrPayload = verifyQrPayload as jest.MockedFunction<typeof verifyQrPayload>;
const mockExtractUserId = extractUserId as jest.MockedFunction<typeof extractUserId>;

const TODAY = '2026-03-07';
const USER_ID = 'user-abc-123';
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_HMAC = 'a'.repeat(64);

function makeEvent(body: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/game/scan',
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
      path: '/game/scan',
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
    qrData: {
      v: 1,
      l: LOCATION_ID,
      d: TODAY,
      h: VALID_HMAC,
    },
    gpsLat: 13.0,
    gpsLng: 80.2,
  };
}

describe('scanQR handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtractUserId.mockReturnValue(USER_ID);
    mockGetTodayISTString.mockReturnValue(TODAY);
    mockVerifyQrPayload.mockReturnValue(true);
  });

  function setupSuccessPath(): void {
    mockGetItem.mockImplementation(async (table: string) => {
      if (table === 'daily-config') {
        return {
          date: TODAY,
          activeLocationIds: [LOCATION_ID],
          qrSecret: 'test-secret',
          targetSpace: { name: 'Test Space', description: 'A test', mapOverlayId: 'overlay-1' },
          status: 'active',
          difficulty: 'medium',
          winnerClan: null,
        };
      }
      if (table === 'locations') {
        return {
          locationId: LOCATION_ID,
          name: 'Test Location',
          gpsLat: 13.0,
          gpsLng: 80.2,
          geofenceRadius: 100,
          category: 'courtyard',
          active: true,
          chestDropModifier: 1,
          notes: '',
        };
      }
      if (table === 'player-assignments') {
        return {
          dateUserId: `${TODAY}#${USER_ID}`,
          assignedLocationIds: [LOCATION_ID],
        };
      }
      if (table === 'player-locks') {
        return undefined;
      }
      if (table === 'users') {
        return {
          userId: USER_ID,
          todayXp: 0,
          clan: 'ember',
        };
      }
      return undefined;
    });

    mockQuery.mockResolvedValue({ items: [] });
  }

  describe('failure codes', () => {
    it('returns QR_EXPIRED when qrData.d is not today', async () => {
      const body = makeValidBody();
      body.qrData.d = '2026-03-06';
      const event = makeEvent(body);

      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('QR_EXPIRED');
    });

    it('returns QR_INVALID when HMAC verification fails', async () => {
      mockVerifyQrPayload.mockReturnValue(false);

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'test-secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('QR_INVALID');
    });

    it('returns GPS_OUT_OF_RANGE when GPS coordinates are far from location', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 50,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        return undefined;
      });

      const body = makeValidBody();
      body.gpsLat = 13.01;
      body.gpsLng = 80.21;
      const event = makeEvent(body);

      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('GPS_OUT_OF_RANGE');
    });

    it('returns NOT_ASSIGNED when location is not in player assignments', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 100,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        if (table === 'player-assignments') {
          return {
            dateUserId: `${TODAY}#${USER_ID}`,
            assignedLocationIds: ['other-location-id'],
          };
        }
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(responseBody.error.code).toBe('NOT_ASSIGNED');
    });

    it('returns LOCATION_LOCKED when player has a lock record for this location', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 100,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        if (table === 'player-assignments') {
          return {
            dateUserId: `${TODAY}#${USER_ID}`,
            assignedLocationIds: [LOCATION_ID],
          };
        }
        if (table === 'player-locks') {
          return {
            dateUserLocation: `${TODAY}#${USER_ID}#${LOCATION_ID}`,
            lockedAt: '2026-03-07T10:00:00.000Z',
            ttl: 1741363800,
          };
        }
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(responseBody.error.code).toBe('LOCATION_LOCKED');
    });

    it('returns DAILY_CAP_REACHED when user todayXp is 100', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 100,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        if (table === 'player-assignments') {
          return {
            dateUserId: `${TODAY}#${USER_ID}`,
            assignedLocationIds: [LOCATION_ID],
          };
        }
        if (table === 'player-locks') {
          return undefined;
        }
        if (table === 'users') {
          return {
            userId: USER_ID,
            todayXp: 100,
            clan: 'ember',
          };
        }
        return undefined;
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(responseBody.error.code).toBe('DAILY_CAP_REACHED');
    });

    it('returns ON_COOLDOWN when last session completed less than 5 minutes ago', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 100,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        if (table === 'player-assignments') {
          return {
            dateUserId: `${TODAY}#${USER_ID}`,
            assignedLocationIds: [LOCATION_ID],
          };
        }
        if (table === 'player-locks') {
          return undefined;
        }
        if (table === 'users') {
          return {
            userId: USER_ID,
            todayXp: 25,
            clan: 'ember',
          };
        }
        return undefined;
      });

      mockQuery.mockResolvedValue({
        items: [
          {
            sessionId: 'session-prev',
            userId: USER_ID,
            completedAt: twoMinutesAgo,
            date: TODAY,
            locationId: 'other-location',
            minigameId: 'grove-words',
          },
        ],
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(429);
      expect(responseBody.error.code).toBe('ON_COOLDOWN');
    });
  });

  describe('success path', () => {
    it('returns 3-5 available minigames when all validations pass', async () => {
      setupSuccessPath();

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toHaveProperty('locationId', LOCATION_ID);
      expect(responseBody.data).toHaveProperty('locationName', 'Test Location');
      expect(responseBody.data).toHaveProperty('availableMinigames');
      expect(Array.isArray(responseBody.data.availableMinigames)).toBe(true);
      expect(responseBody.data.availableMinigames.length).toBeGreaterThanOrEqual(3);
      expect(responseBody.data.availableMinigames.length).toBeLessThanOrEqual(5);

      const minigame = responseBody.data.availableMinigames[0];
      expect(minigame).toHaveProperty('minigameId');
      expect(minigame).toHaveProperty('name');
      expect(minigame).toHaveProperty('timeLimit');
      expect(minigame).toHaveProperty('description');
    });

    it('excludes already-played minigames at this location', async () => {
      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 100,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        if (table === 'player-assignments') {
          return {
            dateUserId: `${TODAY}#${USER_ID}`,
            assignedLocationIds: [LOCATION_ID],
          };
        }
        if (table === 'player-locks') {
          return undefined;
        }
        if (table === 'users') {
          return { userId: USER_ID, todayXp: 25, clan: 'ember' };
        }
        return undefined;
      });

      // Player already played grove-words at this location
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      mockQuery.mockResolvedValue({
        items: [
          {
            sessionId: 'session-old',
            userId: USER_ID,
            completedAt: tenMinutesAgo,
            date: TODAY,
            locationId: LOCATION_ID,
            minigameId: 'grove-words',
          },
        ],
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      const minigameIds = responseBody.data.availableMinigames.map(
        (m: { minigameId: string }) => m.minigameId
      );
      expect(minigameIds).not.toContain('grove-words');
    });

    it('passes after cooldown has elapsed (>5 minutes since last session)', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();

      mockGetItem.mockImplementation(async (table: string) => {
        if (table === 'daily-config') {
          return {
            date: TODAY,
            qrSecret: 'secret',
            activeLocationIds: [LOCATION_ID],
            targetSpace: { name: 'Test', description: 'test', mapOverlayId: 'o1' },
            status: 'active',
            difficulty: 'medium',
            winnerClan: null,
          };
        }
        if (table === 'locations') {
          return {
            locationId: LOCATION_ID,
            name: 'Test Location',
            gpsLat: 13.0,
            gpsLng: 80.2,
            geofenceRadius: 100,
            category: 'courtyard',
            active: true,
            chestDropModifier: 1,
            notes: '',
          };
        }
        if (table === 'player-assignments') {
          return {
            dateUserId: `${TODAY}#${USER_ID}`,
            assignedLocationIds: [LOCATION_ID],
          };
        }
        if (table === 'player-locks') {
          return undefined;
        }
        if (table === 'users') {
          return { userId: USER_ID, todayXp: 25, clan: 'ember' };
        }
        return undefined;
      });

      mockQuery.mockResolvedValue({
        items: [
          {
            sessionId: 'session-prev',
            userId: USER_ID,
            completedAt: sixMinutesAgo,
            date: TODAY,
            locationId: 'other-location',
            minigameId: 'kindred',
          },
        ],
      });

      const event = makeEvent(makeValidBody());
      const result = await handler(event);
      const responseBody = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
    });
  });
});
