import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getItem, query, scan } from '../../shared/db';
import { success, error, ErrorCode } from '../../shared/response';
import type {
  User,
  GameSession,
  CheckIn,
  PlayerAssignment,
  LocationMasterConfig,
  Phase1Cluster,
  LocationClassification,
} from '../../shared/types';

interface SpaceTypeDistribution {
  'Social Hub': number;
  'Transit / Forced Stay': number;
  'Hidden Gem': number;
  'Dead Zone': number;
  'Unvisited': number;
}

interface AssignmentHistoryEntry {
  date: string;
  assignedLocations: Array<{ locationId: string; name: string }>;
  visitedLocationIds: string[];
}

const PHASE1_BASELINES: Record<string, SpaceTypeDistribution> = {
  nomad:       { 'Social Hub': 25, 'Transit / Forced Stay': 20, 'Hidden Gem': 25, 'Dead Zone': 15, 'Unvisited': 15 },
  drifter:     { 'Social Hub': 40, 'Transit / Forced Stay': 30, 'Hidden Gem': 15, 'Dead Zone': 10, 'Unvisited': 5  },
  forced:      { 'Social Hub': 10, 'Transit / Forced Stay': 55, 'Hidden Gem': 5,  'Dead Zone': 20, 'Unvisited': 10 },
  seeker:      { 'Social Hub': 15, 'Transit / Forced Stay': 15, 'Hidden Gem': 40, 'Dead Zone': 15, 'Unvisited': 15 },
  disengaged:  { 'Social Hub': 15, 'Transit / Forced Stay': 40, 'Hidden Gem': 5,  'Dead Zone': 30, 'Unvisited': 10 },
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return error(ErrorCode.VALIDATION_ERROR, 'userId path parameter is required', 400);
    }

    // Fetch user
    const user = await getItem<User>('users', { userId });
    if (!user) {
      return error(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    // Parallel queries
    const [allSessions, allCheckins, allLocations] = await Promise.all([
      queryAllPages<GameSession>('game-sessions', 'userId = :userId', { ':userId': userId }, 'UserDateIndex'),
      queryAllPages<CheckIn>('checkins', 'userId = :userId', { ':userId': userId }, 'UserDateIndex'),
      scanAllPages<LocationMasterConfig>('location-master-config'),
    ]);

    // Build location lookup
    const locationMap = new Map<string, LocationMasterConfig>();
    for (const loc of allLocations) {
      locationMap.set(loc.locationId, loc);
    }

    // Computed game-session stats
    const totalGamesPlayed = allSessions.length;
    const totalLosses = allSessions.filter(s => s.result !== 'win').length;
    const uniqueLocationIds = new Set(allSessions.map(s => s.locationId));
    const coopGamesPlayed = allSessions.filter(s => s.coopPartnerId != null).length;

    // Favorite minigame
    const minigameCounts = new Map<string, number>();
    for (const s of allSessions) {
      minigameCounts.set(s.minigameId, (minigameCounts.get(s.minigameId) || 0) + 1);
    }
    let favoriteMinigame: string | null = null;
    let maxPlays = 0;
    for (const [id, count] of minigameCounts) {
      if (count > maxPlays) {
        maxPlays = count;
        favoriteMinigame = id;
      }
    }

    // Avg session time (completed sessions only)
    let totalDurationMs = 0;
    let completedCount = 0;
    for (const s of allSessions) {
      if (s.completedAt && s.startedAt) {
        const dur = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
        if (dur > 0 && dur < 3600000) { // sanity: < 1 hour
          totalDurationMs += dur;
          completedCount++;
        }
      }
    }
    const avgSessionTimeSeconds = completedCount > 0 ? Math.round(totalDurationMs / completedCount / 1000) : null;

    // Checkin stats
    const totalCheckins = allCheckins.length;
    const checkinLocationIds = new Set<string>();
    // CheckIn doesn't have locationId directly, but CheckinRecord does.
    // CheckIn has gpsLat/gpsLng. We need to count unique checkin locations
    // by proximity or by a locationId field if it exists.
    // Looking at the types: CheckIn has no locationId, but CheckinRecord does.
    // The checkins table stores CheckIn objects. Let's count unique dates as proxy.
    // Actually let's check if there's a locationId-like field. The checkins table stores
    // raw CheckIn records. We can approximate unique locations by floor.
    // For now, count unique (floor, date) combos or just use session locations.
    // Actually, let's just report totalCheckins and skip checkinLocations count.

    // Phase 2 space type distribution (from game sessions + checkins)
    let phase2SpaceTypeDistribution: SpaceTypeDistribution | null = null;
    let significantShift = false;

    if (user.phase1Cluster) {
      const spaceTypeCounts: Record<string, number> = {
        'Social Hub': 0,
        'Transit / Forced Stay': 0,
        'Hidden Gem': 0,
        'Dead Zone': 0,
        'Unvisited': 0,
      };
      let totalVisits = 0;

      for (const s of allSessions) {
        const loc = locationMap.get(s.locationId);
        if (loc && loc.classification && loc.classification !== 'TBD') {
          spaceTypeCounts[loc.classification] = (spaceTypeCounts[loc.classification] || 0) + 1;
          totalVisits++;
        }
      }

      if (totalVisits > 0) {
        phase2SpaceTypeDistribution = {
          'Social Hub': Math.round((spaceTypeCounts['Social Hub'] / totalVisits) * 100),
          'Transit / Forced Stay': Math.round((spaceTypeCounts['Transit / Forced Stay'] / totalVisits) * 100),
          'Hidden Gem': Math.round((spaceTypeCounts['Hidden Gem'] / totalVisits) * 100),
          'Dead Zone': Math.round((spaceTypeCounts['Dead Zone'] / totalVisits) * 100),
          'Unvisited': Math.round((spaceTypeCounts['Unvisited'] / totalVisits) * 100),
        };

        // Check for significant shift
        const baseline = PHASE1_BASELINES[user.phase1Cluster];
        if (baseline) {
          for (const key of Object.keys(baseline) as (keyof SpaceTypeDistribution)[]) {
            const diff = (phase2SpaceTypeDistribution[key] || 0) - (baseline[key] || 0);
            if (diff > 10) {
              significantShift = true;
              break;
            }
          }
        }
      }
    }

    // Assignment history (last 5 days)
    const assignmentHistory: AssignmentHistoryEntry[] = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dateUserId = `${dateStr}#${userId}`;

      const assignment = await getItem<PlayerAssignment>('player-assignments', { dateUserId });
      if (assignment) {
        // Get sessions for this date to see which locations were visited
        const daySessions = allSessions.filter(s => s.date === dateStr);
        const visitedIds = new Set(daySessions.map(s => s.locationId));

        assignmentHistory.push({
          date: dateStr,
          assignedLocations: assignment.assignedLocationIds.map(id => ({
            locationId: id,
            name: locationMap.get(id)?.name || id.slice(0, 8) + '...',
          })),
          visitedLocationIds: Array.from(visitedIds),
        });
      }
    }

    return success({
      user: {
        ...user,
      },
      computed: {
        totalGamesPlayed,
        totalLosses,
        uniqueLocationsVisited: uniqueLocationIds.size,
        totalLocations: allLocations.filter(l => l.active).length,
        favoriteMinigame,
        avgSessionTimeSeconds,
        coopGamesPlayed,
        totalCheckins,
      },
      phase1Comparison: user.phase1Cluster ? {
        cluster: user.phase1Cluster,
        baseline: PHASE1_BASELINES[user.phase1Cluster] || null,
        phase2Distribution: phase2SpaceTypeDistribution,
        significantShift,
      } : null,
      assignmentHistory,
    });
  } catch (err) {
    console.error('[getUserDetail] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}

// Helper: query all pages from a GSI
async function queryAllPages<T>(
  table: string,
  keyConditionExpression: string,
  expressionValues: Record<string, unknown>,
  indexName: string,
): Promise<T[]> {
  const allItems: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await query<T>(table, keyConditionExpression, expressionValues, {
      indexName,
      exclusiveStartKey: lastKey,
    });
    allItems.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return allItems;
}

// Helper: scan all pages
async function scanAllPages<T>(table: string): Promise<T[]> {
  const allItems: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { exclusiveStartKey: lastKey });
    allItems.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return allItems;
}
