import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, error, ErrorCode } from '../../shared/response';
import { scan, query } from '../../shared/db';
import type {
  User,
  GameSession,
  CheckIn,
  LocationMasterConfig,
  Phase1Cluster,
  LocationClassification,
} from '../../shared/types';

const CLUSTER_IDS: Phase1Cluster[] = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged'];

async function scanAll<T>(table: string, opts?: Parameters<typeof scan>[1]): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { ...opts, exclusiveStartKey: lastKey });
    items.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer || authorizer.isAdmin !== 'true') {
      return error(ErrorCode.FORBIDDEN, 'Admin access required', 403);
    }

    // Parallel scans
    const [allUsers, allSessions, allCheckins, allLocations] = await Promise.all([
      scanAll<User>('users'),
      scanAll<GameSession>('game-sessions'),
      scanAll<CheckIn>('checkins'),
      scanAll<LocationMasterConfig>('location-master-config'),
    ]);

    // Build location classification lookup
    const locationClassification = new Map<string, LocationClassification>();
    for (const loc of allLocations) {
      locationClassification.set(loc.locationId, loc.classification);
    }

    // Group sessions by userId
    const sessionsByUser = new Map<string, GameSession[]>();
    for (const s of allSessions) {
      const arr = sessionsByUser.get(s.userId);
      if (arr) arr.push(s);
      else sessionsByUser.set(s.userId, [s]);
    }

    // Group checkins by userId
    const checkinsByUser = new Map<string, CheckIn[]>();
    for (const c of allCheckins) {
      const arr = checkinsByUser.get(c.userId);
      if (arr) arr.push(c);
      else checkinsByUser.set(c.userId, [c]);
    }

    // Initialize migration matrix
    type MigrationRow = { total: number } & Record<string, number>;
    const migrations: Record<string, MigrationRow> = {};
    for (const c of CLUSTER_IDS) {
      const row: MigrationRow = { total: 0 };
      for (const dest of CLUSTER_IDS) row[`to${capitalize(dest)}`] = 0;
      row[`still${capitalize(c)}`] = 0;
      migrations[c] = row;
    }

    // New users (no Phase 1 cluster)
    const newUserCounts: Record<string, number> = {
      total: 0, nomad: 0, seeker: 0, drifter: 0, forced: 0, disengaged: 0,
    };

    // Classify each user
    for (const user of allUsers) {
      const sessions = sessionsByUser.get(user.userId) || [];
      const checkins = checkinsByUser.get(user.userId) || [];

      const currentCluster = classifyUser(sessions, checkins, locationClassification);

      if (user.phase1Cluster && CLUSTER_IDS.includes(user.phase1Cluster)) {
        const original = user.phase1Cluster;
        const row = migrations[original];
        row.total++;

        if (currentCluster === original) {
          row[`still${capitalize(original)}`]++;
        } else {
          row[`to${capitalize(currentCluster)}`]++;
        }
      } else {
        // New user (no Phase 1 cluster)
        newUserCounts.total++;
        newUserCounts[currentCluster]++;
      }
    }

    return success({
      migrations,
      newUsers: newUserCounts,
      computedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[analyticsClusterMigration] Error:', err);
    return error(ErrorCode.INTERNAL_ERROR, 'Internal server error', 500);
  }
}

function classifyUser(
  sessions: GameSession[],
  checkins: CheckIn[],
  locationClassification: Map<string, LocationClassification>,
): Phase1Cluster {
  const totalSessions = sessions.length;
  const totalCheckins = checkins.length;

  if (totalSessions + totalCheckins === 0) return 'disengaged';

  // Unique locations from sessions
  const locationIds = new Set<string>();
  const classificationCounts: Record<string, number> = {};
  let socialHubCount = 0;
  let totalVisits = 0;

  for (const s of sessions) {
    locationIds.add(s.locationId);
    const cls = locationClassification.get(s.locationId);
    if (cls && cls !== 'TBD') {
      classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;
      totalVisits++;
      if (cls === 'Social Hub') socialHubCount++;
    }
  }

  const uniqueLocations = locationIds.size;

  // Space type diversity
  const spaceTypeDiversity = Object.keys(classificationCounts).length;

  // Dominant space type
  let dominantSpaceType = '';
  let maxCount = 0;
  for (const [cls, count] of Object.entries(classificationCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantSpaceType = cls;
    }
  }

  // Social ratio
  const socialRatio = totalVisits > 0 ? socialHubCount / totalVisits : 0;

  // Classification rules
  if (uniqueLocations >= 15 && spaceTypeDiversity >= 4) return 'nomad';
  if (dominantSpaceType === 'Hidden Gem' && uniqueLocations >= 8) return 'seeker';
  if (dominantSpaceType === 'Transit / Forced Stay' && spaceTypeDiversity <= 2) return 'forced';
  if (socialRatio > 0.5) return 'drifter';

  return 'drifter'; // default fallback
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
