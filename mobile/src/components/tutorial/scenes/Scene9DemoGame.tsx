import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import type { MinigameResult } from '@/types/minigame';
import MossDialogueBox from '../MossDialogueBox';
import GroveWordsGame from '@/minigames/grove-words/GroveWordsGame';
import StonePairsGame from '@/minigames/stone-pairs/StonePairsGame';
import PipsGame from '@/minigames/pips/PipsGame';
import BloomSequenceGame from '@/minigames/bloom-sequence/BloomSequenceGame';
import FireflyFlowGame from '@/minigames/firefly-flow/FireflyFlowGame';

interface Scene9DemoGameProps {
  onComplete: () => void;
}

const DEMO_GAME_POOL = [
  'grove-words',
  'stone-pairs',
  'pips',
  'bloom-sequence',
  'firefly-flow',
] as const;

type DemoGameId = (typeof DEMO_GAME_POOL)[number];

const DEMO_INTRO_LINE: Record<DemoGameId, string> = {
  'grove-words': 'Let me test your readiness. Guess the hidden word…',
  'stone-pairs': 'Sharp eyes serve the grove well. Match the stones…',
  'pips': 'The grove lights must align. Tap to balance them…',
  'bloom-sequence': 'All things follow patterns. Find what comes next…',
  'firefly-flow': 'Guide the fireflies home. Connect each pair of lights…',
};

export default function Scene9DemoGame({ onComplete }: Scene9DemoGameProps) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  const [selectedGame] = useState<DemoGameId>(
    () => DEMO_GAME_POOL[Math.floor(Math.random() * DEMO_GAME_POOL.length)],
  );
  const [gameKey, setGameKey] = useState(0);

  const handleGameComplete = (result: MinigameResult) => {
    setGameResult(result.result === 'win' ? 'win' : 'lose');
    setPhase('result');
  };

  const handleTryAgain = () => {
    setGameResult(null);
    setGameKey((k) => k + 1);
    setPhase('playing');
  };

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <MossDialogueBox
          lines={[DEMO_INTRO_LINE[selectedGame], 'Are you ready?']}
          onComplete={() => setPhase('playing')}
          mood="neutral"
        />
      </View>
    );
  }

  if (phase === 'playing') {
    const gameProps = {
      sessionId: 'tutorial-demo',
      timeLimit: 120,
      onComplete: handleGameComplete,
    };

    let gameElement: React.JSX.Element;
    switch (selectedGame) {
      case 'grove-words':
        gameElement = <GroveWordsGame key={gameKey} {...gameProps} />;
        break;
      case 'stone-pairs':
        gameElement = <StonePairsGame key={gameKey} {...gameProps} />;
        break;
      case 'pips':
        gameElement = <PipsGame key={gameKey} {...gameProps} />;
        break;
      case 'bloom-sequence':
        gameElement = <BloomSequenceGame key={gameKey} {...gameProps} />;
        break;
      case 'firefly-flow':
        gameElement = <FireflyFlowGame key={gameKey} {...gameProps} />;
        break;
    }

    return (
      <View style={styles.container}>
        <View style={styles.practiceBar}>
          <Text style={styles.practiceText}>Practice — no XP earned</Text>
        </View>
        <View style={styles.gameArea}>{gameElement}</View>
      </View>
    );
  }

  // phase === 'result'
  const isWin = gameResult === 'win';

  return (
    <View style={styles.container}>
      <View style={styles.resultContent}>
        <MossDialogueBox
          lines={
            isWin
              ? ["Excellent! You're ready.", 'The grove awaits.']
              : ['The grove will teach you in time.', 'No matter — the paths are open.']
          }
          onComplete={onComplete}
          mood={isWin ? 'warm' : 'neutral'}
        />
        {!isWin && (
          <View style={styles.resultButtons}>
            <Pressable onPress={handleTryAgain}>
              <Text style={styles.tryAgainText}>Try Again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  practiceBar: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  practiceText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: PALETTE.stoneGrey,
  },
  gameArea: {
    flex: 1,
  },
  resultContent: {
    flex: 1,
    justifyContent: 'center',
  },
  resultButtons: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  tryAgainText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.stoneGrey,
  },
});
