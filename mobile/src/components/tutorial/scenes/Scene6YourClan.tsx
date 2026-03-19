import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LORE_CLANS, CLAN_TO_LORE_MAP, PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import ClanVignette from '../ClanVignette';
import MossDialogueBox from '../MossDialogueBox';

interface Scene6YourClanProps {
  onComplete: () => void;
}

const LINES = [
  'You were called here for a reason.',
  'The grove remembers you.',
  'And the clan you belong to has been waiting.',
  'Look closely. These are your companions.',
  'Together, you will wander the paths once more.',
];

function usePlayerLoreClan() {
  const gameClan = useAuthStore((s) => s.clan);
  const loreId = gameClan ? CLAN_TO_LORE_MAP[gameClan] : undefined;
  const loreClan = LORE_CLANS.find((c) => c.id === loreId);
  return loreClan ?? LORE_CLANS[0];
}

export default function Scene6YourClan({ onComplete }: Scene6YourClanProps) {
  const loreClan = usePlayerLoreClan();

  return (
    <View style={styles.container}>
      <View style={styles.clanArea}>
        <ClanVignette clan={loreClan} />
        <View style={styles.companionRow}>
          <View style={styles.companionCircle} />
          <View style={styles.companionCircle} />
          <View style={styles.companionCircle} />
          <View style={styles.companionCircle} />
        </View>
        <Text style={styles.companionLabel}>Your companions await.</Text>
      </View>
      <View style={styles.dialogueArea}>
        <MossDialogueBox lines={LINES} onComplete={onComplete} mood="warm" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  clanArea: {
    flex: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companionRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  companionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PALETTE.stoneGrey,
  },
  companionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.stoneGrey,
    marginTop: 8,
  },
  dialogueArea: {
    flex: 60,
    justifyContent: 'center',
  },
});
