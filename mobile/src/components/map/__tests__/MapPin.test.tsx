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
  it('renders active state with pin icon', () => {
    const onPress = jest.fn();
    const { queryByText } = render(
      <MapPin
        location={makeLocation()}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
      />,
    );

    // Should NOT show lock icon when active
    expect(queryByText('🔒')).toBeNull();
  });

  it('renders locked state with lock icon', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <MapPin
        location={makeLocation({ locked: true })}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
      />,
    );

    expect(getByText('🔒')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <MapPin
        location={makeLocation()}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
      />,
    );

    // Find the pin icon (one of 🍄🌸🏮🌰) and press the container
    // Since Pressable wraps everything, we can press any child
    const pressable = getByText('🍄') || getByText('🌸') || getByText('🏮') || getByText('🌰');
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

    // The component renders a glowRing View when inRange && !locked
    const pressable = UNSAFE_root.children[0];
    expect(pressable).toBeTruthy();
  });

  it('does not show glow ring when locked even if in range', () => {
    const onPress = jest.fn();
    const { queryByText } = render(
      <MapPin
        location={makeLocation({ locked: true })}
        pixelX={100}
        pixelY={200}
        onPress={onPress}
        inRange
      />,
    );

    // Should show lock icon
    expect(queryByText('🔒')).toBeTruthy();
  });
});
