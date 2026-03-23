import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { MapCanvas } from '@/components/map/MapCanvas';
import { TUTORIAL_IMAGES } from '@/assets/tutorial/tutorialAssets';

// ─── Screen dimensions for overlay image sizing ───────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMG_ASPECT = 1920 / 1080;
const imgHeight = SCREEN_WIDTH * IMG_ASPECT;

// ─── Component ────────────────────────────────────────────────────────────────

interface TutorialMapOutroSceneProps {
  onComplete: () => void;
}

export default function TutorialMapOutroScene({ onComplete }: TutorialMapOutroSceneProps) {
  return (
    <TouchableWithoutFeedback onPress={onComplete}>
      <View style={styles.container}>
        <MapCanvas interactive={false} />
        <View style={styles.s8Overlay} pointerEvents="none">
          <Image
            source={TUTORIAL_IMAGES.s8}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Explicit pixel dimensions required for transparent PNG overlay
  s8Overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: imgHeight,
    zIndex: 10,
  },
});
