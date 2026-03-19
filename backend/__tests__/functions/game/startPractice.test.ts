import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/game/startPractice';

jest.mock('../../../shared/db');
jest.mock('../../../shared/time');
jest.mock('../../../shared/auth');
jest.mock('../../../shared/minigames/pipsGenerator', () => ({
  generatePuzzle: jest.fn(() => ({ startGrid: [[0]], solutionTaps: [{ row: 0, col: 0 }], moveLimit: 1 })),
}));
jest.mock('../../../shared/minigames/pathWeaverGenerator', () => ({
  generatePuzzle: jest.fn(() => ({ name: 'test', gridSize: 5, rowClues: [], colClues: [], solution: [[]] })),
}));
jest.mock('../../../functions/game/mosaic/puzzleLibrary', () => ({
  getRandomPuzzle: jest.fn(() => ({ id: 'p1', gridCols: 4, gridRows: 4, targetCells: [], tiles: [] })),
}));
jest.mock('../../../shared/minigames/groveEquationsGenerator', () => ({
  generatePuzzle: jest.fn(() => ({ numbers: [1, 2, 3, 4], target: 10, solution: ['+', '+', '+'] })),
}));
jest.mock('../../../shared/minigames/bloomSequenceGenerator', () => ({
  generateGame: jest.fn(() => ({ rounds: [{ options: [], correctAnswer: 0 }] })),
}));

import { getItem, putItem } from '../../../shared/db';
import { getTodayISTString } from '../../../shared/time';
import { extractUserId } from '../../../shared/auth';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;
const mockGetTodayISTString = getTodayISTString as jest.MockedFunction<typeof getTodayISTString>;
const mockExtractUserId = extractUserId as jest.MockedFunction<typeof extractUserId>;

const USER_ID = 'user-abc-123';
const TODAY = '2026-03-19';

function makeEvent(body: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/game/startPractice',
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
      path: '/game/startPractice',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: 0,
      resourceId: '',
      resourcePath: '',
      stage: 'dev',
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExtractUserId.mockReturnValue(USER_ID);
  mockGetTodayISTString.mockReturnValue(TODAY);
  mockPutItem.mockResolvedValue(undefined);
});

describe('startPractice', () => {
  it('returns a practice session with specified minigame', async () => {
    mockGetItem.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@test.com',
      clan: 'ember',
    });

    const result = await handler(makeEvent({ minigameId: 'grove-words' }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBeDefined();
    expect(body.data.timeLimit).toBe(120);
    expect(body.data.salt).toBeDefined();
    expect(body.data.puzzleData.type).toBe('grove-words');

    // Verify session was saved with practiceSession: true
    expect(mockPutItem).toHaveBeenCalledWith(
      'game-sessions',
      expect.objectContaining({
        practiceSession: true,
        locationId: 'practice',
        minigameId: 'grove-words',
      })
    );
  });

  it('picks a random minigame when none specified', async () => {
    mockGetItem.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@test.com',
      clan: 'ember',
    });

    const result = await handler(makeEvent({}));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBeDefined();
  });

  it('rejects invalid minigame ID', async () => {
    const result = await handler(makeEvent({ minigameId: 'nonexistent-game' }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects when user not found', async () => {
    mockGetItem.mockResolvedValueOnce(undefined);

    const result = await handler(makeEvent({ minigameId: 'grove-words' }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 on auth failure', async () => {
    mockExtractUserId.mockImplementation(() => {
      throw new Error('No authorization context found');
    });

    const result = await handler(makeEvent({ minigameId: 'grove-words' }));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
