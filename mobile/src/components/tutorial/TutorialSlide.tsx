import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  StyleSheet,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { PALETTE } from '@/constants/colors';
import { FONTS } from '@/constants/fonts';

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
    <TouchableWithoutFeedback onPress={onNext}>
      <View style={styles.container}>
        <Image source={image} style={styles.slideImage} resizeMode="contain" />
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
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2E1A',
  },
  slideImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
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
});
