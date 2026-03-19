import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/game/checkin';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/auth');
jest.mock('../../../shared/geo');

import { getItem, putItem, query, scan } from '../../../shared/db';
import { getTodayISTString } from '../../../shared/time';
import { extractUserId } from '../../../shared/auth';
import { isWithinGeofence } from '../../../shared/geo';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockExtractUserId = extractUserId as jest.MockedFunction<typeof extractUserId>;
const mockIsWithinGeofence = isWithinGeofence as jest.MockedFunction<typeof isWithinGeofence>;

const USER_ID = 'user-abc-123';
const TODAY = '2026-03-19';
const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeEvent(body: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/game/checkin',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '',
    requestContext: {
      authorizer: { sub: USER_ID },
      accountId: '',
      apiId: '',
      httpMethod: 'POST',
      identity: {
        accessKey: null, accountId: null, apiKey: null, apiKeyId: null,
        caller: null, clientCert: null, cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null, cognitoIdentityId: null,
        cognitoIdentityPoolId: null, principalOrgId: null, sourceIp: '127.0.0.1',
        user: null, userAgent: null, userArn: null,
      },
      path: '/game/checkin',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: 0,
      resourceId: '',
      resourcePath: '',
      stage: 'dev',
    },
  };
}

const MOCK_LOCATION = {
  locationId: LOCATION_ID,
  name: 'Main Courtyard',
  gpsLat: 12.9716,
  gpsLng: 77.5946,
  geofenceRadius: 50,
  category: 'courtyard',
  active: true,
  chestDropModifier: 1,
  notes: '',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExtractUserId.mockReturnValue(USER_ID);
  mockGetTodayISTString.mockReturnValue(TODAY);
  mockPutItem.mockResolvedValue(undefined);
});

describe('checkin', () => {
  it('successfully checks in when within range and no prior checkin', async () => {
    mockGetItem.mockResolvedValueOnce({ userId: USER_ID, email: 'test@test.com', clan: 'ember' });
    mockScan.mockResolvedValueOnce({ items: [MOCK_LOCATION] });
    mockIsWithinGeofence.mockReturnValueOnce(true);
    mockQuery.mockResolvedValueOnce({ items: [] });

    const result = await handler(makeEvent({ gpsLat: 12.9716, gpsLng: 77.5946 }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.locationId).toBe(LOCATION_ID);
    expect(body.data.locationName).toBe('Main Courtyard');
    expect(body.data.checkedIn).toBe(true);

    expect(mockPutItem).toHaveBeenCalledWith(
      'game-sessions',
      expect.objectContaining({
        locationId: LOCATION_ID,
        result: 'checkin',
        practiceSession: true,
        xpEarned: 0,
      })
    );
  });

  it('rejects when not in range of any location', async () => {
    mockGetItem.mockResolvedValueOnce({ userId: USER_ID, email: 'test@test.com', clan: 'ember' });
    mockScan.mockResolvedValueOnce({ items: [MOCK_LOCATION] });
    mockIsWithinGeofence.mockReturnValueOnce(false);

    const result = await handler(makeEvent({ gpsLat: 0, gpsLng: 0 }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_IN_RANGE');
  });

  it('rejects when already checked in at this location today', async () => {
    mockGetItem.mockResolvedValueOnce({ userId: USER_ID, email: 'test@test.com', clan: 'ember' });
    mockScan.mockResolvedValueOnce({ items: [MOCK_LOCATION] });
    mockIsWithinGeofence.mockReturnValueOnce(true);
    mockQuery.mockResolvedValueOnce({
      items: [{ sessionId: 'existing', result: 'checkin', locationId: LOCATION_ID }],
    });

    const result = await handler(makeEvent({ gpsLat: 12.9716, gpsLng: 77.5946 }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ALREADY_CHECKED_IN');
  });

  it('rejects invalid GPS coordinates', async () => {
    const result = await handler(makeEvent({ gpsLat: 200, gpsLng: 77.5946 }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects when user not found', async () => {
    mockGetItem.mockResolvedValueOnce(undefined);

    const result = await handler(makeEvent({ gpsLat: 12.9716, gpsLng: 77.5946 }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 on auth failure', async () => {
    mockExtractUserId.mockImplementation(() => {
      throw new Error('No authorization context found');
    });

    const result = await handler(makeEvent({ gpsLat: 12.9716, gpsLng: 77.5946 }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('rejects missing GPS fields', async () => {
    const result = await handler(makeEvent({}));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
