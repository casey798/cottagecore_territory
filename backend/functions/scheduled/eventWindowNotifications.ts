import { ScheduledEvent } from 'aws-lambda';
import { getItem } from '../../shared/db';
import { sendToAll, sendToClan } from '../../shared/notifications';
import { Clan, ClanId } from '../../shared/types';
import { clanDisplayName } from '../../shared/clanLabels';
import { isQuietModeActive } from '../../shared/quietMode';

type Window = 'morning' | 'lunch' | 'final';

const CLAN_IDS: ClanId[] = [ClanId.Ember, ClanId.Tide, ClanId.Bloom, ClanId.Gale, ClanId.Hearth];

export const handler = async (_event: ScheduledEvent): Promise<void> => {
  const window = (process.env.WINDOW || 'morning') as Window;
  console.log(`Event window notification: ${window}`);

  if (await isQuietModeActive()) {
    console.log(`Quiet mode active — skipping ${window} notification`);
    return;
  }

  try {
    if (window === 'morning') {
      const delivered = await sendToAll({
        notification: {
          title: 'Break time!',
          body: 'Morning break! Visit your assigned spaces and locations to earn XP.',
        },
        data: {
          type: 'EVENT_WINDOW',
          window: 'morning',
        },
      });
      console.log(`Morning notification sent: ${delivered} delivered`);
      return;
    }

    if (window === 'lunch') {
      const delivered = await sendToAll({
        notification: {
          title: 'Lunch break!',
          body: 'Lunch break! Great time to decorate a space or win a minigame.',
        },
        data: {
          type: 'EVENT_WINDOW',
          window: 'lunch',
        },
      });
      console.log(`Lunch notification sent: ${delivered} delivered`);
      return;
    }

    // Final push — clan-specific notifications
    const clans: (Clan | undefined)[] = await Promise.all(
      CLAN_IDS.map((clanId) => getItem<Clan>('clans', { clanId }))
    );

    const validClans = clans.filter((c): c is Clan => c !== undefined);

    // Check if all clans are tied at 0
    const allZero = validClans.every((c) => c.todayXp === 0);
    if (allZero) {
      const delivered = await sendToAll({
        notification: {
          title: 'Last hour!',
          body: 'Last hour! Visit your spaces and locations before scoring at 6 PM.',
        },
        data: {
          type: 'FINAL_PUSH',
          leadingClan: '',
          deficit: '0',
        },
      });
      console.log(`Final push (all zero) sent: ${delivered} delivered`);
      return;
    }

    // Find leading clan
    const maxXp = Math.max(...validClans.map((c) => c.todayXp));
    const leadingClan = validClans.find((c) => c.todayXp === maxXp)!;
    const leadingName = clanDisplayName(leadingClan.clanId);

    let totalDelivered = 0;

    for (const clan of validClans) {
      const name = clanDisplayName(clan.clanId);
      const deficit = maxXp - clan.todayXp;

      if (clan.clanId === leadingClan.clanId) {
        const delivered = await sendToClan(clan.clanId, {
          notification: {
            title: 'Last hour!',
            body: `${name} is leading! Hold your ground — one hour left.`,
          },
          data: {
            type: 'FINAL_PUSH',
            leadingClan: leadingClan.clanId,
            deficit: '0',
          },
        });
        totalDelivered += delivered;
      } else {
        const delivered = await sendToClan(clan.clanId, {
          notification: {
            title: 'Last hour!',
            body: `${name} is ${deficit} XP behind ${leadingName}! Decorate your remaining spaces and win minigames before 6 PM.`,
          },
          data: {
            type: 'FINAL_PUSH',
            leadingClan: leadingClan.clanId,
            deficit: String(deficit),
          },
        });
        totalDelivered += delivered;
      }
    }

    console.log(`Final push sent: ${totalDelivered} delivered`);
  } catch (err) {
    console.error('Event window notification failed:', err);
    throw err;
  }
};
