import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CottageButton } from '@/components/common/CottageButton';
import { MapCanvas } from '@/components/map/MapCanvas';
import { TUTORIAL_IMAGES } from '@/assets/tutorial/tutorialAssets';

interface TutorialMapOutroSceneProps {
  onComplete: () => void;
}

export default function TutorialMapOutroScene({ onComplete }: TutorialMapOutroSceneProps) {
  return (
    <View style={styles.container}>
      <MapCanvas />
      <Image
        source={TUTORIAL_IMAGES.s8}
        style={styles.overlayImageBottom}
        resizeMode="contain"
        pointerEvents="none"
      />
      <View style={styles.buttonRow}>
        <CottageButton
          title="Let's Go! →"
          onPress={onComplete}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const { height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlayImageBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: SCREEN_H * 0.5,
  },
  buttonRow: {
    position: 'absolute',
    bottom: SCREEN_H * 0.5 + 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  btn: {
    paddingHorizontal: 40,
  },
});
