import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin } from './MapPin';
import { gpsToPixel } from '@/utils/affineTransform';
import { AffineMatrix, Location } from '@/types';

interface Props {
  locations: Location[];
  transformMatrix: AffineMatrix;
  onPinPress: (location: Location) => void;
  eventBoostedIds?: Set<string>;
}

export function MapPinsLayer({
  locations,
  transformMatrix,
  onPinPress,
  eventBoostedIds,
}: Props) {
  const pinPositions = useMemo(
    () =>
      locations.map((loc) => {
        const pixel = gpsToPixel(loc.gpsLat, loc.gpsLng, transformMatrix);
        console.log('[pin position]', loc.locationId, 'gps:', loc.gpsLat, loc.gpsLng, '-> pixel:', pixel.x, pixel.y);
        return { location: loc, pixel };
      }),
    [locations, transformMatrix],
  );

  const handlePress = useCallback(
    (location: Location) => {
      onPinPress(location);
    },
    [onPinPress],
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {pinPositions.map(({ location, pixel }) => (
        <MapPin
          key={location.locationId}
          location={location}
          pixelX={pixel.x}
          pixelY={pixel.y}
          onPress={() => handlePress(location)}
          eventBoosted={eventBoostedIds?.has(location.locationId)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
