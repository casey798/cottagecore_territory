import React, { useEffect, useRef } from 'react';
import { ScrollView, Animated, StyleSheet } from 'react-native';
import { LORE_CLANS } from '@/constants/colors';
import ClanVignette from './ClanVignette';

type LoreClanArray = typeof LORE_CLANS;

interface ClanVignetteRowProps {
  clans: LoreClanArray;
  onAnimationComplete: () => void;
}

export default function ClanVignetteRow({
  clans,
  onAnimationComplete,
}: ClanVignetteRowProps) {
  const anims = useRef(clans.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * 120,
        useNativeDriver: true,
      }),
    );

    Animated.parallel(animations).start(() => {
      onAnimationComplete();
    });
  }, [anims, onAnimationComplete]);

  return (
    <ScrollView
      horizontal
      pagingEnabled={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {clans.map((clan, index) => {
        const opacity = anims[index];
        const translateY = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        });

        return (
          <Animated.View
            key={clan.id}
            style={[styles.cardWrapper, { opacity, transform: [{ translateY }] }]}
          >
            <ClanVignette clan={clan} />
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  cardWrapper: {},
});
