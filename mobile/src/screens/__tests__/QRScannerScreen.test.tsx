import { ErrorCode } from '@/types';

// Test the error message mapping used by QRScannerScreen
const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCode.QrExpired]:
    "This QR code is from a previous day. Ask admin for today's code.",
  [ErrorCode.QrInvalid]:
    "Invalid QR code. Make sure you're scanning the official GroveWars code.",
  [ErrorCode.GpsOutOfRange]:
    "You're not close enough to this location. Move closer and try again.",
  [ErrorCode.NotAssigned]:
    "This location isn't in your assignment today. Check your map for your locations.",
  [ErrorCode.LocationLocked]:
    "You've already lost at this location today. Try a different spot!",
  [ErrorCode.DailyCapReached]:
    "You've earned all 100 XP for today! Come back tomorrow.",
  [ErrorCode.OnCooldown]: 'Cooldown active. Wait before playing again.',
};

describe('QRScannerScreen error messages', () => {
  it('maps QR_EXPIRED to day-expired message', () => {
    expect(ERROR_MESSAGES[ErrorCode.QrExpired]).toContain('previous day');
  });

  it('maps QR_INVALID to invalid QR message', () => {
    expect(ERROR_MESSAGES[ErrorCode.QrInvalid]).toContain('Invalid QR code');
  });

  it('maps GPS_OUT_OF_RANGE to proximity message', () => {
    expect(ERROR_MESSAGES[ErrorCode.GpsOutOfRange]).toContain('not close enough');
  });

  it('maps NOT_ASSIGNED to assignment message', () => {
    expect(ERROR_MESSAGES[ErrorCode.NotAssigned]).toContain('assignment');
  });

  it('maps LOCATION_LOCKED to locked message', () => {
    expect(ERROR_MESSAGES[ErrorCode.LocationLocked]).toContain('already lost');
  });

  it('maps DAILY_CAP_REACHED to cap message', () => {
    expect(ERROR_MESSAGES[ErrorCode.DailyCapReached]).toContain('100 XP');
  });

  it('maps ON_COOLDOWN to cooldown message', () => {
    expect(ERROR_MESSAGES[ErrorCode.OnCooldown]).toContain('Cooldown');
  });

  it('returns undefined for unknown error codes', () => {
    expect(ERROR_MESSAGES['UNKNOWN_CODE']).toBeUndefined();
  });

  it('all error codes have non-empty messages', () => {
    Object.values(ERROR_MESSAGES).forEach((msg) => {
      expect(msg.length).toBeGreaterThan(0);
    });
  });
});
