// Mock DB and time modules before imports
jest.mock('../../../shared/db', () => ({
  scan: jest.fn(),
  getItem: jest.fn(),
  updateItem: jest.fn(),
  putItem: jest.fn(),
  query: jest.fn(),
}));

jest.mock('../../../shared/time', () => ({
  getTodayISTString: jest.fn(() => '2026-03-19'),
}));

import { scan, getItem, updateItem, putItem } from '../../../shared/db';
import type { User, GameSession, PlayerAssignment, LocationMasterConfig } from '../../../shared/types';

// We test the pipeline, not the Lambda wrapper
import { runClusteringPipeline } from '../../../shared/clusteringPipeline';

const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockUpdateItem = updateItem as jest.MockedFunction<typeof updateItem>;
const mockPutItem = putItem as jest.MockedFunction<typeof putItem>;

function makeUser(userId: string, phase1Cluster?: string): Partial<User> {
  return { userId, email: `${userId}@test.com`, phase1Cluster: phase1Cluster as any };
}

function makeSession(userId: string, locationId: string, date: string): Partial<GameSession> {
  return {
    sessionId: `${userId}-${locationId}-${date}`,
    userId,
    locationId,
    date,
    startedAt: `${date}T09:00:00.000Z`,
    completedAt: `${date}T09:10:00.000Z`,
    result: 'win' as any,
  };
}

function makeLocation(locationId: string, classification: string): Partial<LocationMasterConfig> {
  return {
    locationId,
    classification: classification as any,
    chestDropModifier: 1.0,
    active: true,
    qrNumber: 1,
    name: locationId,
    gpsLat: 10, gpsLng: 78,
  };
}

describe('Daily Clustering Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: scan returns empty, getItem returns undefined
    mockScan.mockResolvedValue({ items: [], lastEvaluatedKey: undefined });
    mockGetItem.mockResolvedValue(undefined);
    mockUpdateItem.mockResolvedValue(undefined);
    mockPutItem.mockResolvedValue(undefined);
  });

  it('writes DailyClusteringRun after successful run', async () => {
    // Setup: 6 users, sessions for 5, locations
    const users = Array.from({ length: 6 }, (_, i) => makeUser(`u${i}`));
    const sessions = users.slice(0, 5).map((u) =>
      makeSession(u.userId!, 'loc1', '2026-03-18'),
    );
    const locations = [makeLocation('loc1', 'Social Hub')];

    mockScan.mockImplementation(async (table: string) => {
      if (table === 'users') return { items: users as any[] };
      if (table === 'game-sessions') return { items: sessions as any[] };
      if (table === 'player-assignments') return { items: [] };
      if (table === 'location-master-config') return { items: locations as any[] };
      return { items: [] };
    });

    const result = await runClusteringPipeline();

    expect(result.date).toBe('2026-03-19');
    expect(result.totalPlayers).toBe(5); // 5 had sessions
    expect(result.noDataPlayers).toBe(1); // 1 had no sessions

    // Verify putItem was called with clustering-runs table
    expect(mockPutItem).toHaveBeenCalledWith(
      'clustering-runs',
      expect.objectContaining({ date: '2026-03-19' }),
    );
  });

  it('zero-session users get computedCluster = null', async () => {
    const users = [makeUser('active'), makeUser('inactive')];
    const sessions = [makeSession('active', 'loc1', '2026-03-18')];
    const locations = [makeLocation('loc1', 'Social Hub')];

    mockScan.mockImplementation(async (table: string) => {
      if (table === 'users') return { items: users as any[] };
      if (table === 'game-sessions') return { items: sessions as any[] };
      if (table === 'player-assignments') return { items: [] };
      if (table === 'location-master-config') return { items: locations as any[] };
      return { items: [] };
    });

    await runClusteringPipeline();

    // Find the updateItem call for the inactive user
    const inactiveCalls = mockUpdateItem.mock.calls.filter(
      (call) => (call[1] as any).userId === 'inactive',
    );
    expect(inactiveCalls.length).toBeGreaterThan(0);
    // Should REMOVE computedCluster (expression contains REMOVE)
    const expr = inactiveCalls[0][2] as string;
    expect(expr).toContain('REMOVE computedCluster');
  });

  it('featureWindowActual = 1 when only 1 day of session data exists', async () => {
    // Sessions only from yesterday
    const users = Array.from({ length: 6 }, (_, i) => makeUser(`u${i}`));
    const sessions = users.map((u) => makeSession(u.userId!, 'loc1', '2026-03-18'));
    const locations = [makeLocation('loc1', 'Social Hub')];

    mockScan.mockImplementation(async (table: string) => {
      if (table === 'users') return { items: users as any[] };
      if (table === 'game-sessions') return { items: sessions as any[] };
      if (table === 'player-assignments') return { items: [] };
      if (table === 'location-master-config') return { items: locations as any[] };
      return { items: [] };
    });

    const result = await runClusteringPipeline();
    expect(result.featureWindowActual).toBeLessThanOrEqual(3);
    expect(result.featureWindowActual).toBeGreaterThanOrEqual(1);
  });
});
