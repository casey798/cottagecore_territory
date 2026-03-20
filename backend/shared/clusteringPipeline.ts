import { scan, getItem, updateItem, putItem, query } from './db';
import { getTodayISTString } from './time';
import { buildFeatureVectors } from './clusterFeatures';
import { computePlayerClusters } from './clustering';
import type {
  User,
  GameSession,
  PlayerAssignment,
  LocationMasterConfig,
  DailyClusteringRun,
  Phase1Cluster,
  PlayerFeatureVector,
} from './types';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// ── Paginated helpers ────────────────────────────────────────────────

async function scanAll<T>(table: string, options?: Parameters<typeof scan>[1]): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<T>(table, { ...options, exclusiveStartKey: lastKey });
    all.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return all;
}

async function queryAll<T>(
  table: string,
  keyCondition: string,
  values: Record<string, unknown>,
  options?: { indexName?: string; filterExpression?: string; expressionNames?: Record<string, string> },
): Promise<T[]> {
  const all: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await query<T>(table, keyCondition, values, {
      ...options,
      exclusiveStartKey: lastKey,
    });
    all.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);
  return all;
}

// ── Main pipeline ────────────────────────────────────────────────────

export async function runClusteringPipeline(): Promise<DailyClusteringRun> {
  const today = getTodayISTString();
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');

  // Step 1: Determine window days
  // Find earliest game session date to bound the window
  let featureWindowActual = 3;

  const allSessions = await scanAll<GameSession>('game-sessions');
  if (allSessions.length > 0) {
    let earliestDate = allSessions[0].date;
    for (const s of allSessions) {
      if (s.date < earliestDate) earliestDate = s.date;
    }
    const earliestParsed = new Date(earliestDate);
    const daysSinceEarliest = Math.floor(
      (nowIST.getTime() - earliestParsed.getTime()) / (24 * 60 * 60 * 1000),
    );
    featureWindowActual = Math.min(3, Math.max(1, daysSinceEarliest));
  } else {
    featureWindowActual = 1;
  }

  // Step 2: Scan all users
  const allUsers = await scanAll<User>('users');
  const userIds = allUsers.map((u) => u.userId);

  // Step 3: Build date range for window
  const windowDates: string[] = [];
  for (let d = 1; d <= featureWindowActual; d++) {
    const date = addDays(nowIST, -d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    windowDates.push(`${y}-${m}-${day}`);
  }

  // Step 4: Query sessions per user for the window (filter from full scan)
  const windowDateSet = new Set(windowDates);
  const sessionsByUser = new Map<string, GameSession[]>();
  for (const session of allSessions) {
    if (!windowDateSet.has(session.date)) continue;
    const existing = sessionsByUser.get(session.userId) ?? [];
    existing.push(session);
    sessionsByUser.set(session.userId, existing);
  }

  // Step 5: Query player-assignments for the window
  const allAssignments = await scanAll<PlayerAssignment>('player-assignments');
  const assignmentsByUser = new Map<string, PlayerAssignment[]>();
  for (const assignment of allAssignments) {
    const [dateStr, uId] = assignment.dateUserId.split('#');
    if (!uId || !windowDateSet.has(dateStr)) continue;
    const existing = assignmentsByUser.get(uId) ?? [];
    existing.push(assignment);
    assignmentsByUser.set(uId, existing);
  }

  // Step 6: Fetch all location master configs
  const allLocations = await scanAll<LocationMasterConfig>('location-master-config');
  const locationConfigs = new Map<string, LocationMasterConfig>();
  for (const loc of allLocations) {
    locationConfigs.set(loc.locationId, loc);
  }

  // Step 7: Build feature vectors
  const featureResults = buildFeatureVectors(
    userIds,
    sessionsByUser,
    assignmentsByUser,
    locationConfigs,
    featureWindowActual,
  );

  const validVectors: PlayerFeatureVector[] = [];
  const noDataUserIds: string[] = [];
  for (let i = 0; i < userIds.length; i++) {
    if (featureResults[i] != null) {
      validVectors.push(featureResults[i]!);
    } else {
      noDataUserIds.push(userIds[i]);
    }
  }

  // Step 8: Run k-means clustering
  const clusterResult = computePlayerClusters(validVectors);

  // Step 9: Batch update users table
  const computedAt = new Date().toISOString();
  const featureWindowStr = `${featureWindowActual}d`;

  // Update clustered users
  const USER_BATCH_SIZE = 25;
  const allUpdateUserIds = [
    ...Object.keys(clusterResult.assignments),
    ...noDataUserIds,
  ];

  for (let i = 0; i < allUpdateUserIds.length; i += USER_BATCH_SIZE) {
    const batch = allUpdateUserIds.slice(i, i + USER_BATCH_SIZE);
    await Promise.all(
      batch.map(async (uid) => {
        const cluster = clusterResult.assignments[uid] ?? null;
        if (cluster != null) {
          await updateItem(
            'users',
            { userId: uid },
            'SET computedCluster = :cluster, clusterComputedAt = :at, clusterFeatureWindow = :window',
            {
              ':cluster': cluster,
              ':at': computedAt,
              ':window': featureWindowStr,
            },
          );
        } else {
          await updateItem(
            'users',
            { userId: uid },
            'SET clusterComputedAt = :at, clusterFeatureWindow = :window REMOVE computedCluster',
            {
              ':at': computedAt,
              ':window': featureWindowStr,
            },
          );
        }
      }),
    );
  }

  // Step 10: Compute cluster counts
  const clusterCounts: Record<Phase1Cluster, number> = {
    nomad: 0,
    seeker: 0,
    drifter: 0,
    forced: 0,
    disengaged: 0,
  };
  for (const label of Object.values(clusterResult.assignments)) {
    clusterCounts[label]++;
  }

  // Step 11: Write DailyClusteringRun
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  const run: DailyClusteringRun = {
    date: today,
    totalPlayers: validVectors.length,
    clusterCounts,
    noDataPlayers: noDataUserIds.length,
    withinClusterVariance: clusterResult.withinClusterVariance,
    featureWindowActual,
    labelMapping: clusterResult.labelMapping,
    computedAt,
    expiresAt,
  };

  await putItem('clustering-runs', run as unknown as Record<string, unknown>);

  // Step 12: Log summary
  console.log(
    `[clustering] ${today}: ${validVectors.length} players clustered, ${noDataUserIds.length} no-data. ` +
    `Distribution: nomad=${clusterCounts.nomad} seeker=${clusterCounts.seeker} ` +
    `drifter=${clusterCounts.drifter} forced=${clusterCounts.forced} ` +
    `disengaged=${clusterCounts.disengaged}. Variance=${clusterResult.withinClusterVariance}. ` +
    `Window=${featureWindowActual}d`,
  );

  return run;
}
