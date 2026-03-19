import { assignLocationsForAllPlayers } from '../../../shared/locationAssignment';
import { Location, User, ClanId, LocationCategory } from '../../../shared/types';

jest.mock('../../../shared/db', () => ({
  getItem: jest.fn(),
  scan: jest.fn(),
  batchWrite: jest.fn(),
}));

import { getItem, scan, batchWrite } from '../../../shared/db';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockBatchWrite = batchWrite as jest.MockedFunction<typeof batchWrite>;

// ── Helpers ─────────────────────────────────────────────────────────

function makeLocation(id: string, coopOnly = false): Location {
  return {
    locationId: id,
    name: `Location ${id}`,
    gpsLat: 12.9,
    gpsLng: 77.6,
    geofenceRadius: 30,
    category: LocationCategory.Courtyard,
    active: true,
    chestDropModifier: 1,
    notes: '',
    coopOnly,
  };
}

function makeUser(id: string): User {
  return {
    userId: id,
    email: `${id}@test.com`,
    displayName: `User ${id}`,
    clan: ClanId.Ember,
    avatarConfig: { hairStyle: 0, hairColor: 0, skinTone: 0, outfit: 0, accessory: 0 },
    todayXp: 0,
    seasonXp: 0,
    totalWins: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDate: '2026-03-18',
    tutorialDone: true,
    fcmToken: '',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const TEST_DATE = '2026-03-19';

const COOP_LOC_1 = makeLocation('coop-loc-1', true);
const COOP_LOC_2 = makeLocation('coop-loc-2', true);
const SOLO_LOCS = [
  makeLocation('solo-loc-1'),
  makeLocation('solo-loc-2'),
  makeLocation('solo-loc-3'),
  makeLocation('solo-loc-4'),
  makeLocation('solo-loc-5'),
];

const TEST_USERS: User[] = [
  makeUser('fUid1abc123xyz'),
  makeUser('gBeta456defQRS'),
  makeUser('hGamma789ghiJK'),
];

const ALL_LOCATIONS: Location[] = [COOP_LOC_1, COOP_LOC_2, ...SOLO_LOCS];

function setupGetItemMock(locations: Location[]) {
  const map = new Map(locations.map((l) => [l.locationId, l]));
  mockGetItem.mockImplementation((_table: string, key: Record<string, string | number>) => {
    const loc = map.get(key.locationId as string);
    return Promise.resolve(loc as any);
  });
}

function setupScanMock() {
  mockScan.mockResolvedValue({ items: TEST_USERS } as any);
}

/** Extract the assignments that were passed to batchWrite */
function getCapturedAssignments(): Array<{ dateUserId: string; assignedLocationIds: string[] }> {
  const calls = mockBatchWrite.mock.calls;
  // batchWrite(table, items) — flatten all items across calls
  return calls.flatMap((call) => call[1] as any[]);
}

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchWrite.mockResolvedValue(undefined);
});

describe('assignLocationsForAllPlayers – co-op pool split', () => {
  it('assigns 1-2 co-op locations when coopPool has entries', async () => {
    setupScanMock();
    setupGetItemMock(ALL_LOCATIONS);

    const activeIds = ['coop-loc-1', 'coop-loc-2', ...SOLO_LOCS.map((l) => l.locationId)];
    const count = await assignLocationsForAllPlayers(TEST_DATE, activeIds);

    expect(count).toBe(3);
    expect(mockBatchWrite).toHaveBeenCalledWith('player-assignments', expect.any(Array));

    const assignments = getCapturedAssignments();
    expect(assignments).toHaveLength(3);

    for (const a of assignments) {
      const coopIds = a.assignedLocationIds.filter((id) => id.startsWith('coop-'));
      expect(coopIds.length).toBeGreaterThanOrEqual(1);
      expect(coopIds.length).toBeLessThanOrEqual(2);
      expect(a.assignedLocationIds.length).toBeGreaterThanOrEqual(5);
      expect(a.assignedLocationIds.length).toBeLessThanOrEqual(6);
    }
  });

  it('falls back to all-random when no co-op locations exist', async () => {
    setupScanMock();
    setupGetItemMock(SOLO_LOCS);

    const activeIds = SOLO_LOCS.map((l) => l.locationId);
    const count = await assignLocationsForAllPlayers(TEST_DATE, activeIds);

    expect(count).toBe(3);
    expect(mockBatchWrite).toHaveBeenCalled();

    const assignments = getCapturedAssignments();
    expect(assignments).toHaveLength(3);

    for (const a of assignments) {
      expect(a.assignedLocationIds.length).toBeGreaterThanOrEqual(5);
      expect(a.assignedLocationIds.length).toBeLessThanOrEqual(6);
      // All IDs should be solo
      for (const id of a.assignedLocationIds) {
        expect(id).toMatch(/^solo-loc-/);
      }
    }
  });

  it('assigns single co-op location when coopPool has exactly 1', async () => {
    setupScanMock();
    const locationsWithOneCoop = [COOP_LOC_1, ...SOLO_LOCS];
    setupGetItemMock(locationsWithOneCoop);

    const activeIds = ['coop-loc-1', ...SOLO_LOCS.map((l) => l.locationId)];
    const count = await assignLocationsForAllPlayers(TEST_DATE, activeIds);

    expect(count).toBe(3);
    expect(mockBatchWrite).toHaveBeenCalled();

    const assignments = getCapturedAssignments();
    expect(assignments).toHaveLength(3);

    for (const a of assignments) {
      expect(a.assignedLocationIds).toContain('coop-loc-1');
      expect(a.assignedLocationIds.length).toBeGreaterThanOrEqual(5);
      expect(a.assignedLocationIds.length).toBeLessThanOrEqual(6);
    }
  });
});
