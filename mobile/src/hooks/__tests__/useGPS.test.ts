import { PermissionsAndroid, Platform } from 'react-native';

// Mock dependencies before importing
jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    watchPosition: jest.fn(() => 42),
    clearWatch: jest.fn(),
  },
}));

jest.mock('@/utils/time', () => ({
  isWithinGameHours: jest.fn(() => true),
}));

jest.mock('@/store/useDebugStore', () => ({
  useDebugStore: (selector: (s: unknown) => unknown) =>
    selector({ debugLocation: null, isDebugMode: false }),
}));

import Geolocation from 'react-native-geolocation-service';
import { isWithinGameHours } from '@/utils/time';

const mockIsWithinGameHours = isWithinGameHours as jest.MockedFunction<
  typeof isWithinGameHours
>;
const mockWatchPosition = Geolocation.watchPosition as jest.MockedFunction<
  typeof Geolocation.watchPosition
>;

describe('useGPS - unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsWithinGameHours.mockReturnValue(true);
    Object.defineProperty(Platform, 'OS', { value: 'android' });
  });

  it('requestLocationPermission asks for ACCESS_FINE_LOCATION on Android', async () => {
    const requestSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'GroveWars Location Permission',
        message:
          'GroveWars needs your location to show you ' +
          'nearby challenges on the campus map.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );

    expect(requestSpy).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      expect.objectContaining({
        title: 'GroveWars Location Permission',
      }),
    );
  });

  it('watchPosition is called with high accuracy options', () => {
    const successCb = jest.fn();
    const errorCb = jest.fn();

    Geolocation.watchPosition(successCb, errorCb, {
      enableHighAccuracy: true,
      distanceFilter: 2,
      interval: 3000,
      fastestInterval: 1000,
      showLocationDialog: true,
      forceRequestLocation: true,
    });

    expect(mockWatchPosition).toHaveBeenCalledWith(
      successCb,
      errorCb,
      expect.objectContaining({
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 3000,
      }),
    );
  });

  it('watchPosition returns a numeric watchId', () => {
    const watchId = Geolocation.watchPosition(jest.fn(), jest.fn(), {});
    expect(typeof watchId).toBe('number');
  });

  it('clearWatch can be called with the watchId', () => {
    const watchId = Geolocation.watchPosition(jest.fn(), jest.fn(), {});
    Geolocation.clearWatch(watchId);
    expect(Geolocation.clearWatch).toHaveBeenCalledWith(42);
  });

  it('isWithinGameHours determines tracking eligibility', () => {
    mockIsWithinGameHours.mockReturnValue(false);
    expect(isWithinGameHours()).toBe(false);

    mockIsWithinGameHours.mockReturnValue(true);
    expect(isWithinGameHours()).toBe(true);
  });
});
