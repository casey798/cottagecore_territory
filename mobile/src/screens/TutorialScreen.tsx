/**
 * TutorialScreen — 9-scene onboarding flow.
 *
 * Navigation guard: route here only when !tutorialDone && !tutorialSkipped.
 * setTutorialDone() is called at the end of scene 8 (handleTutorialDone).
 *
 * Scene layout:
 *   0–5  TutorialSlide    (image-backed slides, skip allowed)
 *   6    Character creation (no skip)
 *   7    Map scene with practice minigame (no skip)
 *   8    Map outro (no skip) — completing this ends the tutorial
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { TUTORIAL_IMAGES } from '@/assets/tutorial/tutorialAssets';
import TutorialProgressBar from '@/components/tutorial/TutorialProgressBar';
import TutorialSlide from '@/components/tutorial/TutorialSlide';
import TutorialCharacterScene from '@/components/tutorial/scenes/TutorialCharacterScene';
import TutorialMapScene from '@/components/tutorial/scenes/TutorialMapScene';
import TutorialMapOutroScene from '@/components/tutorial/scenes/TutorialMapOutroScene';

const TOTAL_SCENES = 9;
const SLIDE_COUNT = 6; // scenes 0–5

export default function TutorialScreen() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [arrivedViaSkip, setArrivedViaSkip] = useState(false);

  const setTutorialDone = useAuthStore((s) => s.setTutorialDone);
  const setTutorialSkipped = useAuthStore((s) => s.setTutorialSkipped);
  const clan = useAuthStore((s) => s.clan);

  // Pick the clan-specific s5 image, falling back to ember if clan unknown
  const s5Image =
    clan && clan in TUTORIAL_IMAGES.s5
      ? TUTORIAL_IMAGES.s5[clan as keyof typeof TUTORIAL_IMAGES.s5]
      : TUTORIAL_IMAGES.s5.ember;

  const advance = () => {
    setSceneIndex((prev) => Math.min(prev + 1, TOTAL_SCENES - 1));
  };

  /**
   * Skip handler: jump to character creation without setting any store flag yet.
   * The store is updated only after character creation completes (handleTutorialDone).
   */
  const handleSkip = () => {
    setArrivedViaSkip(true);
    setSceneIndex(6);
  };

  /**
   * Called at the very end of the tutorial (scene 8 completes, or skip path finishes
   * character creation). Persists the flag locally and to the backend, then lets
   * RootNavigator automatically transition to Main.
   */
  const handleTutorialDone = () => {
    // setTutorialDone also fires the backend API call internally (fire-and-forget)
    setTutorialDone(); // → RootNavigator will switch to Main
    // Also record as skipped if user used the skip path (belt-and-suspenders)
    if (arrivedViaSkip) {
      setTutorialSkipped();
    }
  };

  /**
   * Called when character creation (scene 6) completes.
   * - Skip path  → end tutorial immediately (no map scenes)
   * - Normal path → advance to scene 7 (map)
   */
  const handleCharCreationComplete = () => {
    if (arrivedViaSkip) {
      handleTutorialDone();
    } else {
      advance();
    }
  };

  const renderScene = () => {
    switch (sceneIndex) {
      case 0:
        return (
          <TutorialSlide
            image={TUTORIAL_IMAGES.s1}
            onNext={advance}
            onSkip={handleSkip}
          />
        );
      case 1:
        return (
          <TutorialSlide
            image={TUTORIAL_IMAGES.s2}
            onNext={advance}
            onSkip={handleSkip}
          />
        );
      case 2:
        return (
          <TutorialSlide
            image={TUTORIAL_IMAGES.s3}
            onNext={advance}
            onSkip={handleSkip}
          />
        );
      case 3:
        return (
          <TutorialSlide
            image={TUTORIAL_IMAGES.s4}
            onNext={advance}
            onSkip={handleSkip}
          />
        );
      case 4:
        return (
          <TutorialSlide
            image={s5Image}
            onNext={advance}
            onSkip={handleSkip}
          />
        );
      case 5:
        return (
          <TutorialSlide
            image={TUTORIAL_IMAGES.s6}
            onNext={advance}
            onSkip={handleSkip}
          />
        );
      case 6:
        return (
          <TutorialCharacterScene
            onComplete={handleCharCreationComplete}
            arrivedViaSkip={arrivedViaSkip}
          />
        );
      case 7:
        return <TutorialMapScene onComplete={advance} />;
      case 8:
        return <TutorialMapOutroScene onComplete={handleTutorialDone} />;
      default:
        return null;
    }
  };

  // Progress bar is only shown during the 6 slides (scenes 0–5)
  const showProgress = sceneIndex < SLIDE_COUNT;

  return (
    <View style={styles.screen}>
      {showProgress && (
        <TutorialProgressBar
          sceneIndex={sceneIndex}
          totalScenes={SLIDE_COUNT}
        />
      )}
      <View style={styles.sceneArea}>{renderScene()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  sceneArea: {
    flex: 1,
  },
});
