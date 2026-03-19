import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface TutorialProgressBarProps {
  sceneIndex: number;
  totalScenes: number;
}

export default function TutorialProgressBar({
  sceneIndex,
  totalScenes,
}: TutorialProgressBarProps) {
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = (sceneIndex + 1) / totalScenes;
    Animated.timing(fillAnim, {
      toValue: target,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [sceneIndex, totalScenes, fillAnim]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: fillWidth }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(160,147,125,0.3)',
  },
  fill: {
    height: 4,
    backgroundColor: '#D4A843',
  },
});
