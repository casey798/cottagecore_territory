import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin } from './MapPin';
import { gpsToPixel } from '@/utils/affineTransform';
import { AffineMatrix, Location } from '@/types';
import { MAP_TILE_SIZE } from '@/constants/config';
import { SpaceAssignmentItem } from '@/api/spaces';

interface Props {
  locations: Location[];
  transformMatrix: AffineMatrix;
  onPinPress: (location: Location) => void;
  inRangeIds?: Set<string>;
  xpExhaustedIds?: Set<string>;
  lockedUntilMap?: Record<string, string>;
  spaces?: SpaceAssignmentItem[];
  onSpacePress?: (space: SpaceAssignmentItem) => void;
  inRangeSpaceIds?: Set<string>;
}

function getPolygonCentroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** Stub Location for space pins — MapPin requires a location prop. */
function spaceToLocation(space: SpaceAssignmentItem): Location {
  return {
    locationId: `space-${space.spaceId}`,
    name: space.spaceName,
    gpsLat: 0,
    gpsLng: 0,
    geofenceRadius: space.geofenceRadius,
    category: 'other',
    locked: false,
  };
}

export function MapPinsLayer({
  locations,
  transformMatrix,
  onPinPress,
  inRangeIds,
  xpExhaustedIds,
  lockedUntilMap,
  spaces,
  onSpacePress,
  inRangeSpaceIds,
}: Props) {
  const pinPositions = useMemo(
    () =>
      locations.map((loc) => {
        const pixel = gpsToPixel(loc.gpsLat, loc.gpsLng, transformMatrix);
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

  const spaceEntries = useMemo(
    () =>
      (spaces ?? []).map((space) => ({
        space,
        location: spaceToLocation(space),
      })),
    [spaces],
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
          inRange={inRangeIds?.has(location.locationId)}
          xpExhausted={xpExhaustedIds?.has(location.locationId)}
          bonusXP={!!location.bonusXP}
          isCoop={location.isCoop}
          lockedUntil={lockedUntilMap?.[location.locationId]}
        />
      ))}
      {spaceEntries.map(({ space, location }) => (
        <MapPin
          key={`space-${space.spaceId}`}
          location={location}
          pixelX={(() => {
            const c = space.polygonPoints && space.polygonPoints.length >= 3
              ? getPolygonCentroid(space.polygonPoints)
              : { x: space.mapPixelX, y: space.mapPixelY };
            return Math.round(c.x / MAP_TILE_SIZE) * MAP_TILE_SIZE;
          })()}
          pixelY={(() => {
            const c = space.polygonPoints && space.polygonPoints.length >= 3
              ? getPolygonCentroid(space.polygonPoints)
              : { x: space.mapPixelX, y: space.mapPixelY };
            return Math.round(c.y / MAP_TILE_SIZE) * MAP_TILE_SIZE;
          })()}
          onPress={() => onSpacePress?.(space)}
          inRange={inRangeSpaceIds?.has(space.spaceId)}
          isSpace
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
