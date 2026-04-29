import { ScheduledEvent } from 'aws-lambda';
import { scan } from '../../shared/db';
import { sendToPlayer } from '../../shared/notifications';
import { getTodayISTString } from '../../shared/time';
import type { SpaceAssignment } from '../../shared/types';
import { isQuietModeActive } from '../../shared/quietMode';

const BATCH_SIZE = 25;

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  try {
    if (await isQuietModeActive()) {
      console.log('Quiet mode active — skipping spaces remaining nudge');
      return;
    }
    const today = getTodayISTString();
    console.log(`Spaces remaining nudge running for ${today}`);

    // Scan space-assignments for today
    const assignments: SpaceAssignment[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await scan<SpaceAssignment>('space-assignments', {
        filterExpression: 'begins_with(dateUserId, :prefix)',
        expressionValues: { ':prefix': `${today}#` },
        exclusiveStartKey: lastKey,
      });
      assignments.push(...result.items);
      lastKey = result.lastEvaluatedKey;
    } while (lastKey);

    console.log(`Found ${assignments.length} space assignments for today`);

    let nudgesSent = 0;

    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE);
      for (const assignment of batch) {
        try {
          const remaining = assignment.assignedSpaceIds.length - (assignment.completedSpaceIds?.length ?? 0);
          if (remaining <= 0) continue;

          const userId = assignment.dateUserId.split('#')[1];
          if (!userId) continue;

          const body = remaining === 1
            ? "You have 1 space left to decorate today. Don't miss the XP!"
            : `You have ${remaining} spaces left to decorate today. Don't miss the XP!`;

          await sendToPlayer(userId, {
            notification: {
              title: "Spaces waiting! \uD83C\uDFE1",
              body,
            },
            data: {
              type: 'SPACES_REMAINING',
              remaining: String(remaining),
            },
          });
          nudgesSent++;
        } catch (err) {
          const userId = assignment.dateUserId.split('#')[1] ?? 'unknown';
          console.error(`Nudge failed for user ${userId}:`, err);
        }
      }
    }

    console.log(`Spaces remaining nudge complete: ${nudgesSent} nudges sent`);
  } catch (err) {
    console.error('Spaces remaining nudge failed:', err);
    throw err;
  }
};
