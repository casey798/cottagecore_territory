import React from 'react';
import { render } from '@testing-library/react-native';

// Mock dependencies
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ popToTop: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: (cb: () => void) => cb(),
}));
jest.mock('@/store/useClanStore', () => ({
  useClanStore: (selector: (s: unknown) => unknown) =>
    selector({
      clans: [
        { clanId: 'ember', todayXp: 500, seasonXp: 2000, spacesCaptured: 3 },
        { clanId: 'tide', todayXp: 750, seasonXp: 1800, spacesCaptured: 2 },
      ],
    }),
}));
jest.mock('@/store/useGameStore', () => ({
  useGameStore: (selector: (s: unknown) => unknown) =>
    selector({
      markXpEarnedAtLocation: jest.fn(),
    }),
}));
jest.mock('@/store/useMapStore', () => ({
  useMapStore: (selector: (s: unknown) => unknown) =>
    selector({
      lockLocation: jest.fn(),
    }),
}));

let mockParams: Record<string, unknown> = {};

// Import after mocks
import ResultScreen from '../ResultScreen';

describe('ResultScreen', () => {
  beforeEach(() => {
    mockParams = {};
  });

  it('win state shows XP earned', () => {
    mockParams = {
      result: 'win',
      xpEarned: 25,
      newTodayXp: 50,
      clanTodayXp: 200,
      chestDrop: { dropped: false },
      locationLocked: false,
    };

    const { getByText } = render(<ResultScreen />);

    expect(getByText('+25 XP')).toBeTruthy();
    expect(getByText('Your XP: 50/100')).toBeTruthy();
    expect(getByText('Your clan now has 200 XP today!')).toBeTruthy();
  });

  it('win state with chest drop shows asset info', () => {
    mockParams = {
      result: 'win',
      xpEarned: 25,
      newTodayXp: 75,
      clanTodayXp: 300,
      chestDrop: {
        dropped: true,
        asset: {
          assetId: 'asset-001',
          name: 'Golden Banner',
          category: 'banner',
          rarity: 'legendary',
          imageKey: 'banners/golden.png',
        },
      },
      locationLocked: false,
    };

    const { getByText } = render(<ResultScreen />);

    expect(getByText('Chest Drop!')).toBeTruthy();
    expect(getByText('Golden Banner')).toBeTruthy();
    expect(getByText('LEGENDARY')).toBeTruthy();
  });

  it('win state without chest shows "no chest" message', () => {
    mockParams = {
      result: 'win',
      xpEarned: 25,
      newTodayXp: 25,
      clanTodayXp: 100,
      chestDrop: { dropped: false },
      locationLocked: false,
    };

    const { getByText } = render(<ResultScreen />);

    expect(getByText('No chest this time...')).toBeTruthy();
  });

  it('lose state shows lose message', () => {
    mockParams = {
      result: 'lose',
      xpEarned: 0,
      chestDrop: { dropped: false },
      locationLocked: false,
    };

    const { getByText } = render(<ResultScreen />);

    expect(getByText('Not this time...')).toBeTruthy();
  });

  it('lose state with location locked shows lock message', () => {
    mockParams = {
      result: 'lose',
      xpEarned: 0,
      chestDrop: { dropped: false },
      locationLocked: true,
    };

    const { getByText } = render(<ResultScreen />);

    expect(getByText('Not this time...')).toBeTruthy();
    expect(
      getByText('This location is locked for today. Try a different spot!'),
    ).toBeTruthy();
  });

  it('win with xpAwarded=false shows practice message', () => {
    mockParams = {
      result: 'win',
      xpEarned: 0,
      xpAwarded: false,
      chestDrop: { dropped: false },
      locationLocked: false,
    };

    const { getByText } = render(<ResultScreen />);

    expect(getByText('Challenge Complete!')).toBeTruthy();
    expect(
      getByText("No XP earned — you've already harvested this grove today."),
    ).toBeTruthy();
  });

  it('shows mini clan scoreboard', () => {
    mockParams = {
      result: 'win',
      xpEarned: 25,
      newTodayXp: 25,
      clanTodayXp: 100,
      chestDrop: { dropped: false },
      locationLocked: false,
    };

    const { getByText } = render(<ResultScreen />);

    // Sorted by todayXp desc: tide (750) > ember (500)
    expect(getByText('Tide')).toBeTruthy();
    expect(getByText('Ember')).toBeTruthy();
  });
});
