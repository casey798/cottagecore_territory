/**
 * Navigation guard: route here only when !tutorialDone && !tutorialSkipped.
 * tutorialDone is set at end of Scene 9 (handleTutorialComplete).
 */
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import { PALETTE, LORE_CLANS, CLAN_TO_LORE_MAP } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { useAuthStore } from '@/store/useAuthStore';
import * as playerApi from '@/api/player';
import type { AvatarConfig } from '@/types';
import SceneBackground from '@/components/tutorial/SceneBackground';
import TutorialProgressBar from '@/components/tutorial/TutorialProgressBar';
import Scene0Awakening from '@/components/tutorial/scenes/Scene0Awakening';
import Scene1Landmarks from '@/components/tutorial/scenes/Scene1Landmarks';
import Scene2Clans from '@/components/tutorial/scenes/Scene2Clans';
import Scene3Silence from '@/components/tutorial/scenes/Scene3Silence';
import Scene4MossAppears from '@/components/tutorial/scenes/Scene4MossAppears';
import Scene5Stirring from '@/components/tutorial/scenes/Scene5Stirring';
import Scene6YourClan from '@/components/tutorial/scenes/Scene6YourClan';
import Scene7TrueGoal from '@/components/tutorial/scenes/Scene7TrueGoal';
import Scene8CharacterCreation from '@/components/tutorial/scenes/Scene8CharacterCreation';
import Scene9DemoGame from '@/components/tutorial/scenes/Scene9DemoGame';

const TOTAL_SCENES = 10;

export default function TutorialScreen() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);

  const setTutorialSkipped = useAuthStore((s) => s.setTutorialSkipped);
  const setTutorialDone = useAuthStore((s) => s.setTutorialDone);
  const gameClan = useAuthStore((s) => s.clan);

  const activeClanColor = useMemo(() => {
    const loreId = gameClan ? CLAN_TO_LORE_MAP[gameClan] : undefined;
    const loreClan = LORE_CLANS.find((c) => c.id === loreId);
    return loreClan?.color;
  }, [gameClan]);

  const advance = () => {
    setSceneIndex((prev) => Math.min(prev + 1, TOTAL_SCENES - 1));
  };

  const handleSkip = () => {
    setTutorialSkipped();
  };

  const handleScene8Complete = (name: string, config: AvatarConfig) => {
    setDisplayName(name);
    setAvatarConfig(config);
    setSceneIndex(9);
  };

  const handleTutorialComplete = async () => {
    if (avatarConfig) {
      try {
        await playerApi.updateAvatar(displayName, avatarConfig);
      } catch (err) {
        console.warn('[Tutorial] Failed to save avatar:', err);
      }
    }
    setTutorialDone();
  };

  const renderScene = () => {
    switch (sceneIndex) {
      case 0:
        return <Scene0Awakening onComplete={advance} />;
      case 1:
        return <Scene1Landmarks onComplete={advance} />;
      case 2:
        return <Scene2Clans onComplete={advance} />;
      case 3:
        return <Scene3Silence onComplete={advance} />;
      case 4:
        return <Scene4MossAppears onComplete={advance} />;
      case 5:
        return <Scene5Stirring onComplete={advance} />;
      case 6:
        return <Scene6YourClan onComplete={advance} />;
      case 7:
        return <Scene7TrueGoal onComplete={advance} />;
      case 8:
        return <Scene8CharacterCreation onComplete={handleScene8Complete} />;
      case 9:
        return <Scene9DemoGame onComplete={handleTutorialComplete} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <SceneBackground sceneIndex={sceneIndex} activeClanColor={activeClanColor} />
      <TutorialProgressBar sceneIndex={sceneIndex} totalScenes={TOTAL_SCENES} />
      <View style={styles.skipRow}>
        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.sceneArea}>{renderScene()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  skipRow: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
  },
  skipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.stoneGrey,
  },
  sceneArea: {
    flex: 1,
  },
});
