import React from 'react';
import {
  View,
  ImageBackground,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';
import { CottageButton } from '@/components/common/CottageButton';

interface TutorialSlideProps {
  image: ImageSourcePropType;
  onNext: () => void;
  onSkip: () => void;
  showSkip?: boolean;
}

export default function TutorialSlide({
  image,
  onNext,
  onSkip,
  showSkip = true,
}: TutorialSlideProps) {
  return (
    <ImageBackground source={image} style={styles.container} resizeMode="cover">
      {showSkip && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={onSkip}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}
      <View style={styles.nextRow}>
        <CottageButton title="Next →" onPress={onNext} style={styles.nextBtn} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  skipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.white,
  },
  nextRow: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  nextBtn: {
    paddingHorizontal: 40,
  },
});
