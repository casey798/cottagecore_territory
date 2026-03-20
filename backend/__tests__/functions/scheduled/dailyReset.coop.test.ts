import { assignLocationsForAllPlayers } from '../../../shared/locationAssignment';
import { User, ClanId, PlayerAssignment } from '../../../shared/types';

jest.mock('../../../shared/db', () => ({
  getItem: jest.fn(),
  scan: jest.fn(),
  batchWrite: jest.fn(),
}));

import { scan, batchWrite } from '../../../shared/db';

const mockScan = scan as jest.MockedFunction<typeof scan>;
const mockBatchWrite = batchWrite as jest.MockedFunction<typeof batchWrite>;

// ── Helpers ─────────────────────────────────────────────────────────

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
    playerCode: 'ABC123',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

const TEST_DATE = '2026-03-19';
const ACTIVE_LOCATION_IDS = ['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5'];

const TEST_USERS: User[] = [
  makeUser('fUid1abc123xyz'),
  makeUser('gBeta456defQRS'),
];

function setupScanMock() {
  mockScan.mockResolvedValue({ items: TEST_USERS } as any);
}

/** Extract the assignments that were passed to batchWrite */
function getCapturedAssignments(): PlayerAssignment[] {
  const calls = mockBatchWrite.mock.calls;
  return calls.flatMap((call) => call[1] as any[]);
}

// ── Tests ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchWrite.mockResolvedValue(undefined);
});

describe('assignLocationsForAllPlayers – co-op designation', () => {
  it('produces coopLocationIds as a subset of assignedLocationIds', async () => {
    setupScanMock();
    await assignLocationsForAllPlayers(TEST_DATE, ACTIVE_LOCATION_IDS);

    const assignments = getCapturedAssignments();
    for (const a of assignments) {
      const assignedSet = new Set(a.assignedLocationIds);
      for (const coopId of a.coopLocationIds ?? []) {
        expect(assignedSet.has(coopId)).toBe(true);
      }
    }
  });

  it('coopLocationIds never exceeds MAX_COOP_SLOTS_PER_PLAYER (2)', async () => {
    setupScanMock();
    // Run multiple times to exercise randomness
    for (let i = 0; i < 10; i++) {
      jest.clearAllMocks();
      mockBatchWrite.mockResolvedValue(undefined);
      setupScanMock();
      await assignLocationsForAllPlayers(TEST_DATE, ACTIVE_LOCATION_IDS);

      const assignments = getCapturedAssignments();
      for (const a of assignments) {
        expect((a.coopLocationIds ?? []).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('writes coopLocationIds field to every assignment', async () => {
    setupScanMock();
    await assignLocationsForAllPlayers(TEST_DATE, ACTIVE_LOCATION_IDS);

    const assignments = getCapturedAssignments();
    expect(assignments.length).toBe(2);
    for (const a of assignments) {
      expect(a).toHaveProperty('coopLocationIds');
      expect(Array.isArray(a.coopLocationIds)).toBe(true);
    }
  });

  it('assigns correct number of locations (FALLBACK_ASSIGNMENT_COUNT=4)', async () => {
    setupScanMock();
    await assignLocationsForAllPlayers(TEST_DATE, ACTIVE_LOCATION_IDS);

    const assignments = getCapturedAssignments();
    for (const a of assignments) {
      expect(a.assignedLocationIds.length).toBe(4);
    }
  });
});
