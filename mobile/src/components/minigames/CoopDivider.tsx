import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CLAN_COLORS, PALETTE, UI } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { ClanId } from '@/types';

interface CoopDividerProps {
  p1Name: string;
  p1Clan: string;
  p2Name: string;
  p2Clan: string;
  timeLeft: number;
  totalTime: number;
  children?: React.ReactNode;
}

const SEPARATOR_COLOR = PALETTE.softGreen;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function clanColor(clan: string): string {
  return CLAN_COLORS[clan as ClanId] ?? PALETTE.stoneGrey;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}

export function CoopDivider({
  p1Name,
  p1Clan,
  p2Name,
  p2Clan,
  timeLeft,
  totalTime,
  children,
}: CoopDividerProps) {
  const timerFraction = totalTime > 0 ? Math.max(0, Math.min(1, timeLeft / totalTime)) : 0;
  const isTimeLow = timeLeft < 15;
  const p1Color = clanColor(p1Clan);
  const p2Color = clanColor(p2Clan);

  return (
    <View style={styles.wrapper}>
      {/* Top separator */}
      <View style={styles.separator} />

      <View style={styles.strip}>
        {/* P1 section — left 40% */}
        <View style={[styles.playerSection, { backgroundColor: withAlpha(p1Color, 0.25) }]}>
          <View style={[styles.clanDot, { backgroundColor: p1Color }]} />
          <Text style={styles.playerName} numberOfLines={1}>
            {p1Name}
          </Text>
        </View>

        {/* Timer center — 20% */}
        <View style={styles.timerSection}>
          <Text style={[styles.timerText, isTimeLow && styles.timerTextLow]}>
            {formatTime(timeLeft)}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${timerFraction * 100}%`,
                  backgroundColor: isTimeLow ? PALETTE.mutedRose : PALETTE.softGreen,
                },
              ]}
            />
          </View>
        </View>

        {/* P2 section — right 40% */}
        <View
          style={[
            styles.playerSection,
            styles.playerSectionRight,
            { backgroundColor: withAlpha(p2Color, 0.25) },
          ]}
        >
          <Text style={styles.playerName} numberOfLines={1}>
            {p2Name}
          </Text>
          <View style={[styles.clanDot, { backgroundColor: p2Color }]} />
        </View>
      </View>

      {/* Children slot (e.g. Submit button) */}
      {children ? <View style={styles.childrenRow}>{children}</View> : null}

      {/* Bottom separator */}
      <View style={styles.separator} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  separator: {
    height: 1,
    backgroundColor: withAlpha(PALETTE.softGreen, 0.5),
    width: '100%',
  },
  strip: {
    height: 52,
    flexDirection: 'row',
    width: '100%',
  },
  playerSection: {
    width: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  playerSectionRight: {
    justifyContent: 'flex-end',
  },
  clanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: UI.text,
    flexShrink: 1,
  },
  timerSection: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  timerText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: UI.text,
  },
  timerTextLow: {
    color: PALETTE.errorRed,
  },
  progressTrack: {
    width: '90%',
    height: 3,
    backgroundColor: UI.border + '30',
    borderRadius: 2,
    marginTop: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  childrenRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
});
