import { ErrorCode } from '@/types';
import { ERROR_MESSAGES } from '../QRScannerScreen';

describe('QRScannerScreen error messages', () => {
  it('maps QR_EXPIRED to day-expired message', () => {
    expect(ERROR_MESSAGES[ErrorCode.QrExpired]).toContain('previous day');
  });

  it('maps QR_INVALID to invalid QR message', () => {
    expect(ERROR_MESSAGES[ErrorCode.QrInvalid]).toContain('Invalid QR code');
  });

  it('maps GPS_OUT_OF_RANGE to proximity message', () => {
    expect(ERROR_MESSAGES[ErrorCode.GpsOutOfRange]).toContain('Move closer');
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

  it('maps LOCATION_EXHAUSTED to exhausted message', () => {
    expect(ERROR_MESSAGES[ErrorCode.LocationExhausted]).toContain('mastered all challenges');
  });

  it('maps ALL_MINIGAMES_PLAYED to all-played message', () => {
    expect(ERROR_MESSAGES[ErrorCode.AllMinigamesPlayed]).toContain('all available challenges');
  });

  it('maps GAME_INACTIVE to inactive message', () => {
    expect(ERROR_MESSAGES[ErrorCode.GameInactive]).toContain('game hours');
  });

  it('maps SEASON_ENDED to season-ended message', () => {
    expect(ERROR_MESSAGES[ErrorCode.SeasonEnded]).toContain('season has ended');
  });

  it('maps RATE_LIMITED to rate-limit message', () => {
    expect(ERROR_MESSAGES[ErrorCode.RateLimited]).toContain('Too many attempts');
  });

  it('maps PARTNER_CAP_REACHED to partner cap message', () => {
    expect(ERROR_MESSAGES[ErrorCode.PartnerCapReached]).toContain('partner');
  });

  it('maps PARTNER_LOCATION_LOCKED to partner locked message', () => {
    expect(ERROR_MESSAGES[ErrorCode.PartnerLocationLocked]).toContain('partner');
  });

  it('maps PARTNER_ALREADY_WON to partner won message', () => {
    expect(ERROR_MESSAGES[ErrorCode.PartnerAlreadyWon]).toContain('partner');
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
