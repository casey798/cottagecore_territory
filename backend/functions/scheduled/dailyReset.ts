import { ScheduledEvent } from 'aws-lambda';
import { getItem, putItem, scan, updateItem, batchWrite, deleteItem } from '../../shared/db';
import { getTodayISTString, toISTString } from '../../shared/time';
import { sendToAll } from '../../shared/notifications';
import { assignLocationsForAllPlayers } from '../../shared/locationAssignment';
import { generateSpaceAssignment, getActiveSpaceIds } from '../../shared/spaceAssignment';
import { isQuietModeActive } from '../../shared/quietMode';
import {
  buildAdjacencyMap,
  scoreLocationForUser,
  assignLocationsWithSpread,
} from '../../shared/weightedAssignment';
import { ROTATION_HISTORY_WINDOW_DAYS } from '../../shared/constants';
import { User, DailyConfig, Clan, ClanId, DailyConfigStatus, GameSession, LocationMasterConfig, PlayerAssignment, PlayerLock, WsConnection, ClusterWeightConfig, Phase1Cluster } from '../../shared/types';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
  const today = getTodayISTString();
  const yesterdayDate = toISTString(addDays(toZonedTime(new Date(), 'Asia/Kolkata'), -1));

  console.log(`Daily reset running. Today: ${today}, Yesterday: ${yesterdayDate}`);

  // Step 1: Set yesterday's daily-config status to 'complete' if not already
  const yesterdayConfig = await getItem<DailyConfig>('daily-config', { date: yesterdayDate });
  if (yesterdayConfig && yesterdayConfig.status !== DailyConfigStatus.Complete) {
    await updateItem(
      'daily-config',
      { date: yesterdayDate },
      'SET #status = :status',
      { ':status': DailyConfigStatus.Complete },
      { '#status': 'status' }
    );
    console.log(`Set yesterday's config (${yesterdayDate}) to complete`);
  }

  // Quiet mode check — skip all competitive resets
  if (await isQuietModeActive()) {
    console.log(`Quiet mode active for ${today} — skipping competitive resets, assignments, and notifications`);
    return;
  }

  // Step 2: Scan all users, reset todayXp to 0
  const allUsers: User[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await scan<User>('users', { exclusiveStartKey: lastKey });
    allUsers.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${allUsers.length} users to reset`);

  for (const user of allUsers) {
    await updateItem(
      'users',
      { userId: user.userId },
      'SET todayXp = :zero',
      { ':zero': 0 }
    );
  }

  // Step 2b: Reset streaks for users who missed the last play day.
  // Walk backwards to find the most recent non-quiet day, so leave/holiday
  // gaps don't incorrectly break streaks.
  const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
  let lastPlayDate: string | null = null;
  for (let d = 1; d <= 14; d++) {
    const checkDate = toISTString(addDays(nowIST, -d));
    const cfg = await getItem<DailyConfig>('daily-config', { date: checkDate });
    if (!cfg || !cfg.quietMode) {
      lastPlayDate = checkDate;
      break;
    }
  }

  let streaksReset = 0;
  if (lastPlayDate) {
    for (const user of allUsers) {
      if (user.lastActiveDate && user.lastActiveDate !== lastPlayDate) {
        await updateItem(
          'users',
          { userId: user.userId },
          'SET currentStreak = :zero',
          { ':zero': 0 }
        );
        streaksReset++;
      }
    }
  }
  console.log(`Reset ${streaksReset} user streaks (last play day: ${lastPlayDate ?? 'none'})`);

  // Step 3: Reset all 5 clans: todayXp = 0, clear todayXpTimestamp
  const clanIds = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];
  for (const clanId of clanIds) {
    await updateItem(
      'clans',
      { clanId },
      'SET todayXp = :zero, todayParticipants = :zero REMOVE todayXpTimestamp',
      { ':zero': 0 }
    );
  }
  console.log('Reset all clan daily XP');

  // Step 4: Explicitly delete yesterday's player-locks (TTL can lag up to 48h)
  const lockPrefix = `${yesterdayDate}#`;
  let lockLastKey: Record<string, unknown> | undefined;
  let locksDeleted = 0;
  do {
    const lockResult = await scan<PlayerLock>('player-locks', {
      filterExpression: 'begins_with(dateUserLocation, :prefix)',
      expressionValues: { ':prefix': lockPrefix },
      exclusiveStartKey: lockLastKey,
    });
    for (const lock of lockResult.items) {
      await deleteItem('player-locks', { dateUserLocation: lock.dateUserLocation });
      locksDeleted++;
    }
    lockLastKey = lockResult.lastEvaluatedKey;
  } while (lockLastKey);
  console.log(`Deleted ${locksDeleted} yesterday's player-locks`);

  // Step 5: Generate player location assignments for today (weighted algorithm)
  const todayConfig = await getItem<DailyConfig>('daily-config', { date: today });
  if (todayConfig && todayConfig.activeLocationIds.length > 0) {
    // Try weighted assignment using cluster weights
    const clusterConfig = await getItem<ClusterWeightConfig>('cluster-weight-config', { configId: 'current' });

    if (clusterConfig) {
      // Fetch LocationMasterConfigs for active locations
      const locationConfigs: LocationMasterConfig[] = [];
      for (const locId of todayConfig.activeLocationIds) {
        const loc = await getItem<LocationMasterConfig>('location-master-config', { locationId: locId });
        if (loc) locationConfigs.push(loc);
      }

      if (locationConfigs.length > 0) {
        const adjacencyMap = buildAdjacencyMap(locationConfigs);

        // Compute 3-day window dates
        const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
        const windowDates: string[] = [];
        for (let d = 0; d < ROTATION_HISTORY_WINDOW_DAYS; d++) {
          const date = addDays(nowIST, -d);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          windowDates.push(`${y}-${m}-${day}`);
        }

        // Read rotation history — windowed scan with FilterExpression per date
        const windowAssignments: PlayerAssignment[] = [];
        for (const dateStr of windowDates) {
          let paLastKey: Record<string, unknown> | undefined;
          do {
            const result = await scan<PlayerAssignment>('player-assignments', {
              filterExpression: 'begins_with(dateUserId, :prefix)',
              expressionValues: { ':prefix': `${dateStr}#` },
              exclusiveStartKey: paLastKey,
            });
            windowAssignments.push(...result.items);
            paLastKey = result.lastEvaluatedKey;
          } while (paLastKey);
        }

        const rotationCounts = new Map<string, Map<string, number>>();
        const windowAssigned = new Map<string, Set<string>>();
        for (const assignment of windowAssignments) {
          const [assignDate, uId] = assignment.dateUserId.split('#');
          if (!uId) continue;
          if (!rotationCounts.has(uId)) rotationCounts.set(uId, new Map());
          const userMap = rotationCounts.get(uId)!;
          for (const locId of assignment.assignedLocationIds) {
            userMap.set(locId, (userMap.get(locId) || 0) + 1);
          }
          if (assignDate !== today) {
            if (!windowAssigned.has(uId)) windowAssigned.set(uId, new Set());
            for (const locId of assignment.assignedLocationIds) {
              windowAssigned.get(uId)!.add(locId);
            }
          }
        }

        // Read session pairs within window for visit-response modifier
        const sessionPairs = new Set<string>();
        for (const dateStr of windowDates) {
          let gsKey: Record<string, unknown> | undefined;
          do {
            const result = await scan<GameSession>('game-sessions', {
              filterExpression: '#d = :dateVal',
              expressionValues: { ':dateVal': dateStr },
              expressionNames: { '#d': 'date' },
              exclusiveStartKey: gsKey,
            });
            for (const session of result.items) {
              sessionPairs.add(`${session.userId}#${session.locationId}`);
            }
            gsKey = result.lastEvaluatedKey;
          } while (gsKey);
        }

        // Build bad pairing sets
        const badPairingLocIds = new Map<Phase1Cluster, Set<string>>();
        for (const [cluster, locIds] of Object.entries(clusterConfig.badPairings)) {
          badPairingLocIds.set(cluster as Phase1Cluster, new Set(locIds));
        }

        const MAX_COOP_SLOTS_PER_PLAYER = 2;

        console.log('[dailyReset] co-op designation active for clusters with coopChance > 0:',
          Object.entries(clusterConfig.coopChances ?? {})
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ') || 'none',
        );

        // Assign each user
        let assignedCount = 0;
        let totalCoopUsers = 0;
        let totalCoopSlots = 0;
        for (const user of allUsers) {
          const clusterKey: Phase1Cluster | 'null' =
            user.computedCluster ?? user.phase1Cluster ?? 'null';
          if (clusterConfig.assignmentCounts[clusterKey] === undefined) {
            console.warn('[dailyReset] no assignmentCount configured for cluster:', clusterKey, '— defaulting to 4');
          }
          const assignmentCount = clusterConfig.assignmentCounts[clusterKey] ?? 4;

          // Per-cluster co-op chance with legacy fallback
          const coopChance = clusterConfig.coopChances?.[clusterKey]
            ?? clusterConfig.coopChance ?? 0;

          // Score all locations for weighted selection
          const candidates: Array<{ locationId: string; score: number }> = [];
          for (const loc of locationConfigs) {
            const rotCount = rotationCounts.get(user.userId)?.get(loc.locationId) ?? 0;
            const wasAssignedNeverPlayed =
              (windowAssigned.get(user.userId)?.has(loc.locationId) ?? false) &&
              !sessionPairs.has(`${user.userId}#${loc.locationId}`);

            const score = scoreLocationForUser(
              user, loc, rotCount, wasAssignedNeverPlayed,
              clusterConfig, badPairingLocIds,
            );
            candidates.push({ locationId: loc.locationId, score });
          }

          const assignedLocs = assignLocationsWithSpread(candidates, adjacencyMap, assignmentCount, user.userId);

          // Designate co-op slots from already-assigned locations
          const coopLocationIds: string[] = [];
          if (coopChance > 0) {
            const coopSlotCount = Math.min(
              MAX_COOP_SLOTS_PER_PLAYER,
              assignedLocs.length,
            );
            const shuffled = [...assignedLocs].sort(() => Math.random() - 0.5);
            for (const locId of shuffled) {
              if (Math.random() < coopChance && coopLocationIds.length < coopSlotCount) {
                coopLocationIds.push(locId);
              }
            }
          }

          if (coopChance > 0 && coopLocationIds.length === 0) {
            console.warn('[dailyReset] coopChance is', coopChance, 'for cluster', clusterKey, 'but no co-op slots were designated for user', user.userId, '— assigned location count:', assignedLocs.length);
          }

          if (coopLocationIds.some(id => !assignedLocs.includes(id))) {
            console.error('[dailyReset] co-op location not in assigned set — this is a bug. user:', user.userId, 'coopLocationIds:', coopLocationIds, 'assignedLocs:', assignedLocs);
            coopLocationIds.length = 0;
          }

          if (coopLocationIds.length > 0) totalCoopUsers++;
          totalCoopSlots += coopLocationIds.length;

          const assignment: PlayerAssignment = {
            dateUserId: `${today}#${user.userId}`,
            assignedLocationIds: assignedLocs,
            coopLocationIds,
          };
          await putItem('player-assignments', assignment as unknown as Record<string, unknown>);
          assignedCount++;
        }
        console.log('[dailyReset] assignment complete — total users:', allUsers.length, '| users with >=1 co-op slot:', totalCoopUsers, '| total co-op slots assigned:', totalCoopSlots);
        console.log(`Created ${assignedCount} weighted player assignments`);
      } else {
        // No location master configs found — fallback to simple
        const count = await assignLocationsForAllPlayers(today, todayConfig.activeLocationIds);
        console.log(`Created ${count} player assignments (simple fallback — no master configs)`);
      }
    } else {
      // No cluster weight config — fallback to simple random
      const count = await assignLocationsForAllPlayers(today, todayConfig.activeLocationIds);
      console.log(`Created ${count} player assignments (simple fallback — no cluster config)`);
    }
  } else {
    console.warn('No daily-config found for today or no active locations');
  }

  // Step 5b: Write resetSeq to today's daily-config for foreground-poll detection
  const resetSeq = Date.now();
  if (todayConfig) {
    await updateItem(
      'daily-config',
      { date: today },
      'SET resetSeq = :seq',
      { ':seq': resetSeq }
    );
    console.log(`Set resetSeq=${resetSeq} on daily-config for ${today}`);
  }

  // Step 5c: Generate space assignments for all users (decoration system)
  // First delete any existing assignments for today (stale empty records from lazy-creation
  // before spaces existed would block regeneration via the conditional put).
  try {
    console.log('[dailyReset] Step 5c: Clearing stale space assignments for today');
    let saLastKey: Record<string, unknown> | undefined;
    let saDeleted = 0;
    do {
      const saResult = await scan<{ dateUserId: string }>('space-assignments', {
        filterExpression: 'begins_with(dateUserId, :prefix)',
        expressionValues: { ':prefix': `${today}#` },
        exclusiveStartKey: saLastKey,
      });
      for (const item of saResult.items) {
        await deleteItem('space-assignments', { dateUserId: item.dateUserId });
        saDeleted++;
      }
      saLastKey = saResult.lastEvaluatedKey;
    } while (saLastKey);
    if (saDeleted > 0) console.log(`[dailyReset] Deleted ${saDeleted} stale space assignments for ${today}`);

    console.log('[dailyReset] Step 5c: Generating space assignments');
    // Scan active spaces once, pass to all users to avoid N redundant scans
    const activeSpaceIds = await getActiveSpaceIds();
    console.log(`[dailyReset] Found ${activeSpaceIds.length} active spaces`);

    const spaceAssignmentResults = await Promise.allSettled(
      allUsers.map(user =>
        generateSpaceAssignment(user.userId, today, activeSpaceIds)
          .catch((err: unknown) => {
            if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') return;
            console.error(`[dailyReset] Space assignment failed for ${user.userId}:`, err);
          })
      )
    );
    const succeeded = spaceAssignmentResults.filter(r => r.status === 'fulfilled').length;
    console.log(`[dailyReset] Step 5c complete: ${succeeded}/${allUsers.length} space assignments generated`);
  } catch (spaceAssignErr) {
    console.error('[dailyReset] Space assignment step failed (non-fatal):', spaceAssignErr);
  }

  // Step 6: Send day-start push notification (playtest day-aware copy)
  {
    // Determine playtest day: count completed (non-quiet) daily-configs
    // within a wider window to handle leave / holiday gaps.
    let playtestDay = 1;
    try {
      const MAX_LOOKBACK = 14;
      const nowIST = toZonedTime(new Date(), 'Asia/Kolkata');
      let completedDays = 0;
      for (let d = 1; d <= MAX_LOOKBACK && completedDays < 3; d++) {
        const pastDate = toISTString(addDays(nowIST, -d));
        const pastConfig = await getItem<DailyConfig>('daily-config', { date: pastDate });
        if (pastConfig && pastConfig.status === DailyConfigStatus.Complete && !pastConfig.quietMode) {
          completedDays++;
        }
      }
      playtestDay = Math.min(Math.max(completedDays + 1, 1), 4);
    } catch (dayErr) {
      console.warn('Failed to determine playtest day, defaulting to 1:', dayErr);
      playtestDay = 1;
    }

    const dayStartCopy: Record<number, { title: string; body: string }> = {
      1: { title: 'The playtest begins!', body: 'Your spaces and locations are ready. Head to the map and start exploring!' },
      2: { title: 'Day 2 of 4!', body: 'Keep your streak going — your spaces and locations are waiting.' },
      3: { title: 'Day 3 of 4!', body: 'Two days left! Visit your assigned spaces and locations to earn XP for your clan.' },
      4: { title: 'Final day!', body: 'Last chance! Decorate your spaces and win your locations today.' },
    };
    const copy = dayStartCopy[playtestDay] ?? dayStartCopy[1];

    const delivered = await sendToAll({
      notification: {
        title: copy.title,
        body: copy.body,
      },
      data: {
        type: 'DAY_START',
        targetSpace: todayConfig?.targetSpace?.name ?? '',
        date: today,
      },
    });
    console.log(`Sent day-start notifications (playtest day ${playtestDay}): ${delivered} delivered`);
  }

  // Step 7: Broadcast DAILY_RESET event via WebSocket
  try {
    const wsEndpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (wsEndpoint) {
      const apiGw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });
      const connectionsResult = await scan<WsConnection>('ws-connections');
      const connections = connectionsResult.items;

      const payload = JSON.stringify({
        type: 'DAILY_RESET',
        data: { date: today, resetSeq },
      });

      for (const conn of connections) {
        try {
          await apiGw.send(
            new PostToConnectionCommand({
              ConnectionId: conn.connectionId,
              Data: new TextEncoder().encode(payload),
            })
          );
        } catch (wsErr) {
          console.warn(`Failed to send to connection ${conn.connectionId}:`, wsErr);
        }
      }
      console.log(`Broadcast DAILY_RESET to ${connections.length} connections`);
    }
  } catch (broadcastErr) {
    console.error('WebSocket broadcast failed (non-fatal):', broadcastErr);
  }

  // Step 8: Revert bonusXP on all LocationMasterConfig records (Dead Zone Revival auto-clear)
  try {
    const boostedLocations: LocationMasterConfig[] = [];
    let bmLastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        filterExpression: 'bonusXP = :true',
        expressionValues: { ':true': true },
        exclusiveStartKey: bmLastKey,
      });
      boostedLocations.push(...result.items);
      bmLastKey = result.lastEvaluatedKey;
    } while (bmLastKey);

    if (boostedLocations.length > 0) {
      for (const loc of boostedLocations) {
        await updateItem(
          'location-master-config',
          { locationId: loc.locationId },
          'SET bonusXP = :false',
          { ':false': false }
        );
      }
      console.log(`bonusXP reverted on ${boostedLocations.length} locations`);
    } else {
      console.log('No locations with bonusXP to revert');
    }
  } catch (bonusErr) {
    console.error('bonusXP revert failed (non-fatal):', bonusErr);
  }

  // Step 9: Update rolling 3-day visit counts for all locations
  try {
    // Fetch all LocationMasterConfig records
    const allMasterLocations: LocationMasterConfig[] = [];
    let mlLastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<LocationMasterConfig>('location-master-config', {
        exclusiveStartKey: mlLastKey,
      });
      allMasterLocations.push(...result.items);
      mlLastKey = result.lastEvaluatedKey;
    } while (mlLastKey);

    // Query yesterday's game sessions (scan with filter — 30 locations × small count is acceptable)
    const allYesterdaySessions: GameSession[] = [];
    let gsLastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<GameSession>('game-sessions', {
        filterExpression: '#d = :yesterday',
        expressionValues: { ':yesterday': yesterdayDate },
        expressionNames: { '#d': 'date' },
        exclusiveStartKey: gsLastKey,
      });
      allYesterdaySessions.push(...result.items);
      gsLastKey = result.lastEvaluatedKey;
    } while (gsLastKey);

    // Count sessions per locationId
    const visitCounts = new Map<string, number>();
    for (const session of allYesterdaySessions) {
      visitCounts.set(session.locationId, (visitCounts.get(session.locationId) ?? 0) + 1);
    }

    // Update all locations in parallel
    const visitSummary: string[] = [];
    await Promise.all(
      allMasterLocations.map(async (loc) => {
        const yesterdayVisits = visitCounts.get(loc.locationId) ?? 0;
        const oldVisits = loc.last3DaysVisits ?? [0, 0, 0];
        const newVisits: [number, number, number] = [
          yesterdayVisits,
          oldVisits[0],
          oldVisits[1],
        ];

        await updateItem(
          'location-master-config',
          { locationId: loc.locationId },
          'SET last3DaysVisits = :visits',
          { ':visits': newVisits }
        );

        if (yesterdayVisits > 0) {
          visitSummary.push(`#${loc.qrNumber}: ${yesterdayVisits}`);
        }
      })
    );

    console.log(
      `Visit counts updated for ${allMasterLocations.length} locations. Yesterday's totals: [${visitSummary.join(', ') || 'none'}]`
    );
  } catch (visitErr) {
    console.error('Visit count update failed (non-fatal):', visitErr);
  }

  console.log('Daily reset complete');
  } catch (err) {
    console.error('Daily reset failed:', err);
    throw err;
  }
};
