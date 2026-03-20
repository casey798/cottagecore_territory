/**
 * Navigation guard: route here only when !tutorialDone && !tutorialSkipped.
 * tutorialDone is set at end of Scene 9 (handleTutorialComplete).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
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
  const [presetId, setPresetId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);

  const setTutorialSkipped = useAuthStore((s) => s.setTutorialSkipped);
  const setTutorialDone = useAuthStore((s) => s.setTutorialDone);
  const setSelectedPresetId = useAuthStore((s) => s.setSelectedPresetId);
  const gameClan = useAuthStore((s) => s.clan);

  const activeClanColor = React.useMemo(() => {
    const loreId = gameClan ? CLAN_TO_LORE_MAP[gameClan] : undefined;
    const loreClan = LORE_CLANS.find((c) => c.id === loreId);
    return loreClan?.color;
  }, [gameClan]);

  const advance = () => {
    setSceneIndex((prev) => Math.min(prev + 1, TOTAL_SCENES - 1));
  };

  const handleSkipPress = () => {
    setShowSkipModal(true);
  };

  const handleSkipConfirm = () => {
    setShowSkipModal(false);
    setTutorialSkipped();
  };

  const handleScene8Complete = async (
    name: string,
    config: AvatarConfig,
    selectedPreset: number,
  ) => {
    if (isSubmitting) return;
    setDisplayName(name);
    setAvatarConfig(config);
    setPresetId(selectedPreset);
    setUploadError(null);
    setIsSubmitting(true);

    try {
      const result = await playerApi.updateAvatar(name, config);
      if (result.success) {
        setSelectedPresetId(selectedPreset);
        setSceneIndex(9);
      } else {
        setUploadError(result.error?.message ?? 'Could not save your character. Check your connection and try again.');
      }
    } catch {
      setUploadError('Could not save your character. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTutorialComplete = () => {
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
        <Pressable onPress={handleSkipPress} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.sceneArea}>
        {renderScene()}
        {/* Scene 8 error & loading overlay */}
        {sceneIndex === 8 && isSubmitting && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={PALETTE.honeyGold} />
          </View>
        )}
        {sceneIndex === 8 && uploadError && !isSubmitting && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{uploadError}</Text>
          </View>
        )}
      </View>

      {/* Skip confirmation modal */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Skip the tutorial?</Text>
            <Text style={styles.modalBody}>
              You won&apos;t be asked again. You can always find game tips in Settings.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalBtnSecondary}
                onPress={() => setShowSkipModal(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Go Back</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={handleSkipConfirm}>
                <Text style={styles.modalBtnPrimaryText}>Skip Tutorial</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  errorText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: PALETTE.errorRed,
    textAlign: 'center',
  },
  // Skip confirmation modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: PALETTE.parchmentBg,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 28,
    marginHorizontal: 32,
    borderWidth: 1.5,
    borderColor: PALETTE.honeyGold,
  },
  modalTitle: {
    fontFamily: FONTS.headerBold,
    fontSize: 24,
    color: PALETTE.darkBrown,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: PALETTE.stoneGrey,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  modalBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.stoneGrey,
  },
  modalBtnSecondaryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.stoneGrey,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: PALETTE.errorRed,
  },
  modalBtnPrimaryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: PALETTE.cream,
  },
});
