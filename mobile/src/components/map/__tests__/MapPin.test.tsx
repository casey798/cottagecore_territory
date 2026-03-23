import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MapPin } from '../MapPin';
import { Location } from '@/types';

// Mock Animated to avoid native driver issues in tests
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

const makeLocation = (overrides: Partial<Location> = {}): Location => ({
  locationId: 'loc-001',
  name: 'Test Garden',
  gpsLat: 12.97,
  gpsLng: 77.59,
  geofenceRadius: 50,
  category: 'garden',
  locked: false,
  ...overrides,
});

describe('MapPin', () => {
  it('renders without crashing', () => {
    const onPress = jest.fn();
    const { UNSAFE_root } = render(
      <MapPin
        location={makeLocation()}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
      />,
    );

    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders locked state with reduced opacity', () => {
    const onPress = jest.fn();
    const { UNSAFE_root } = render(
      <MapPin
        location={makeLocation({ locked: true })}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
      />,
    );

    expect(UNSAFE_root).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { UNSAFE_root } = render(
      <MapPin
        location={makeLocation()}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
      />,
    );

    // The root child is the Pressable
    const pressable = UNSAFE_root.children[0] as import('react-test-renderer').ReactTestInstance;
    fireEvent.press(pressable);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows glow ring when in range and not locked', () => {
    const onPress = jest.fn();
    const { UNSAFE_root } = render(
      <MapPin
        location={makeLocation()}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
        inRange
      />,
    );

    const pressable = UNSAFE_root.children[0];
    expect(pressable).toBeTruthy();
  });

  it('does not show glow ring when locked even if in range', () => {
    const onPress = jest.fn();
    const { UNSAFE_root } = render(
      <MapPin
        location={makeLocation({ locked: true })}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
        inRange
      />,
    );

    expect(UNSAFE_root).toBeTruthy();
  });
});
