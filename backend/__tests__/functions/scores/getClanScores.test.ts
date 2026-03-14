import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../../functions/scores/getClanScores';

jest.mock('../../../shared/db');

import { getItem, scan } from '../../../shared/db';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockScan = scan as jest.MockedFunction<typeof scan>;

function makeEvent(): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/scores/clans',
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      authorizer: { claims: { sub: 'user-1' } },
    } as unknown as APIGatewayProxyEvent['requestContext'],
    resource: '',
  };
}

describe('getClanScores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no captured spaces
    mockScan.mockResolvedValue({ items: [] });
  });

  it('returns all 5 clans sorted by todayXp descending', async () => {
    mockGetItem.mockImplementation(async (_table, key) => {
      const data: Record<string, unknown> = {
        ember: { clanId: 'ember', todayXp: 500, seasonXp: 2000 },
        tide: { clanId: 'tide', todayXp: 750, seasonXp: 1800 },
        bloom: { clanId: 'bloom', todayXp: 300, seasonXp: 2500 },
        gale: { clanId: 'gale', todayXp: 600, seasonXp: 1500 },
        hearth: { clanId: 'hearth', todayXp: 200, seasonXp: 800 },
      };
      const id = (key as Record<string, string>).clanId;
      return data[id] as undefined;
    });

    // 3 ember captures, 2 tide captures
    mockScan.mockResolvedValue({
      items: [
        { spaceId: '1', clan: 'ember' },
        { spaceId: '2', clan: 'ember' },
        { spaceId: '3', clan: 'ember' },
        { spaceId: '4', clan: 'tide' },
        { spaceId: '5', clan: 'tide' },
      ],
    });

    const result = await handler(makeEvent());
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.clans).toHaveLength(5);

    // Sorted by todayXp descending
    expect(body.data.clans[0].clanId).toBe('tide');
    expect(body.data.clans[0].todayXp).toBe(750);
    expect(body.data.clans[0].spacesCaptured).toBe(2);
    expect(body.data.clans[1].clanId).toBe('gale');
    expect(body.data.clans[1].todayXp).toBe(600);
    expect(body.data.clans[2].clanId).toBe('ember');
    expect(body.data.clans[2].todayXp).toBe(500);
    expect(body.data.clans[2].spacesCaptured).toBe(3);
    expect(body.data.clans[3].clanId).toBe('bloom');
    expect(body.data.clans[3].todayXp).toBe(300);
    expect(body.data.clans[3].spacesCaptured).toBe(0);
    expect(body.data.clans[4].clanId).toBe('hearth');
    expect(body.data.clans[4].todayXp).toBe(200);
  });

  it('returns 0 for missing clan records', async () => {
    mockGetItem.mockResolvedValue(undefined);

    const result = await handler(makeEvent());
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.data.clans).toHaveLength(5);
    for (const clan of body.data.clans) {
      expect(clan.todayXp).toBe(0);
      expect(clan.seasonXp).toBe(0);
      expect(clan.spacesCaptured).toBe(0);
    }
  });

  it('returns correct response shape with clans array', async () => {
    mockGetItem.mockResolvedValue({
      clanId: 'ember',
      todayXp: 100,
      seasonXp: 500,
    });

    mockScan.mockResolvedValue({
      items: [{ spaceId: '1', clan: 'ember' }],
    });

    const result = await handler(makeEvent());
    const body = JSON.parse(result.body);

    expect(body.data).toHaveProperty('clans');
    expect(Array.isArray(body.data.clans)).toBe(true);
    for (const clan of body.data.clans) {
      expect(clan).toHaveProperty('clanId');
      expect(clan).toHaveProperty('todayXp');
      expect(clan).toHaveProperty('seasonXp');
      expect(clan).toHaveProperty('spacesCaptured');
    }
  });
});
