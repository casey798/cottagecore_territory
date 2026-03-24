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
  onBack?: () => void;
  showBack?: boolean;
}

export default function TutorialSlide({
  image,
  onNext,
  onSkip,
  showSkip = true,
  onBack,
  showBack = true,
}: TutorialSlideProps) {
  return (
    <TouchableWithoutFeedback onPress={onNext}>
      <View style={styles.container}>
        <Image source={image} style={styles.slideImage} resizeMode="contain" />
        {showBack && onBack && (
          <TouchableOpacity
            style={[styles.overlayBtn, styles.overlayBtnLeft]}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={styles.overlayBtnText}>&#8592; Back</Text>
          </TouchableOpacity>
        )}
        {showSkip && (
          <TouchableOpacity
            style={[styles.overlayBtn, styles.overlayBtnRight]}
            onPress={onSkip}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={styles.overlayBtnText}>Skip</Text>
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
  overlayBtn: {
    position: 'absolute',
    top: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  overlayBtnLeft: {
    left: 16,
  },
  overlayBtnRight: {
    right: 16,
  },
  overlayBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: PALETTE.white,
  },
});
