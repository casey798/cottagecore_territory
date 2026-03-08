import {
  generateQrPayload,
  verifyQrPayload,
  generateCompletionHash,
  verifyCompletionHash,
} from '../../shared/hmac';
import { QrPayload } from '../../shared/types';

describe('HMAC Utilities', () => {
  const SECRET = 'test-secret-key-2026';
  const LOCATION_ID = 'loc-001';
  const DATE = '2026-03-07';

  describe('generateQrPayload', () => {
    it('produces a valid payload with v, l, d, h fields', () => {
      const payload = generateQrPayload(LOCATION_ID, DATE, SECRET);

      expect(payload).toHaveProperty('v', 1);
      expect(payload).toHaveProperty('l', LOCATION_ID);
      expect(payload).toHaveProperty('d', DATE);
      expect(payload).toHaveProperty('h');
      expect(typeof payload.h).toBe('string');
      expect(payload.h.length).toBe(64); // SHA-256 hex = 64 chars
    });

    it('produces deterministic output for same inputs', () => {
      const payload1 = generateQrPayload(LOCATION_ID, DATE, SECRET);
      const payload2 = generateQrPayload(LOCATION_ID, DATE, SECRET);

      expect(payload1).toEqual(payload2);
    });

    it('produces different hashes for different locations', () => {
      const payload1 = generateQrPayload('loc-001', DATE, SECRET);
      const payload2 = generateQrPayload('loc-002', DATE, SECRET);

      expect(payload1.h).not.toBe(payload2.h);
    });

    it('produces different hashes for different dates', () => {
      const payload1 = generateQrPayload(LOCATION_ID, '2026-03-07', SECRET);
      const payload2 = generateQrPayload(LOCATION_ID, '2026-03-08', SECRET);

      expect(payload1.h).not.toBe(payload2.h);
    });
  });

  describe('verifyQrPayload', () => {
    it('returns true for a valid payload', () => {
      const payload = generateQrPayload(LOCATION_ID, DATE, SECRET);
      const isValid = verifyQrPayload(payload, SECRET);

      expect(isValid).toBe(true);
    });

    it('returns false for tampered location', () => {
      const payload = generateQrPayload(LOCATION_ID, DATE, SECRET);
      const tampered: QrPayload = { ...payload, l: 'tampered-loc' };

      expect(verifyQrPayload(tampered, SECRET)).toBe(false);
    });

    it('returns false for tampered date', () => {
      const payload = generateQrPayload(LOCATION_ID, DATE, SECRET);
      const tampered: QrPayload = { ...payload, d: '2026-12-31' };

      expect(verifyQrPayload(tampered, SECRET)).toBe(false);
    });

    it('returns false for tampered hash', () => {
      const payload = generateQrPayload(LOCATION_ID, DATE, SECRET);
      const tampered: QrPayload = {
        ...payload,
        h: 'a'.repeat(64),
      };

      expect(verifyQrPayload(tampered, SECRET)).toBe(false);
    });

    it('returns false when using wrong secret', () => {
      const payload = generateQrPayload(LOCATION_ID, DATE, SECRET);

      expect(verifyQrPayload(payload, 'wrong-secret')).toBe(false);
    });
  });

  describe('generateCompletionHash', () => {
    const SESSION_ID = 'session-abc-123';
    const USER_ID = 'user-xyz-789';
    const RESULT = 'win';
    const SALT = 'random-salt-value';

    it('produces a consistent hash for the same inputs', () => {
      const hash1 = generateCompletionHash(SESSION_ID, USER_ID, RESULT, SALT);
      const hash2 = generateCompletionHash(SESSION_ID, USER_ID, RESULT, SALT);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('produces different hashes for different sessions', () => {
      const hash1 = generateCompletionHash('session-1', USER_ID, RESULT, SALT);
      const hash2 = generateCompletionHash('session-2', USER_ID, RESULT, SALT);

      expect(hash1).not.toBe(hash2);
    });

    it('produces different hashes for different results', () => {
      const hash1 = generateCompletionHash(SESSION_ID, USER_ID, 'win', SALT);
      const hash2 = generateCompletionHash(SESSION_ID, USER_ID, 'lose', SALT);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyCompletionHash', () => {
    const SESSION_ID = 'session-abc-123';
    const USER_ID = 'user-xyz-789';
    const RESULT = 'win';
    const SALT = 'random-salt-value';

    it('returns true for a valid hash', () => {
      const hash = generateCompletionHash(SESSION_ID, USER_ID, RESULT, SALT);
      const isValid = verifyCompletionHash(hash, SESSION_ID, USER_ID, RESULT, SALT);

      expect(isValid).toBe(true);
    });

    it('returns false for wrong hash', () => {
      const isValid = verifyCompletionHash('b'.repeat(64), SESSION_ID, USER_ID, RESULT, SALT);

      expect(isValid).toBe(false);
    });

    it('returns false for wrong sessionId', () => {
      const hash = generateCompletionHash(SESSION_ID, USER_ID, RESULT, SALT);
      const isValid = verifyCompletionHash(hash, 'wrong-session', USER_ID, RESULT, SALT);

      expect(isValid).toBe(false);
    });

    it('returns false for wrong userId', () => {
      const hash = generateCompletionHash(SESSION_ID, USER_ID, RESULT, SALT);
      const isValid = verifyCompletionHash(hash, SESSION_ID, 'wrong-user', RESULT, SALT);

      expect(isValid).toBe(false);
    });

    it('returns false for wrong result', () => {
      const hash = generateCompletionHash(SESSION_ID, USER_ID, RESULT, SALT);
      const isValid = verifyCompletionHash(hash, SESSION_ID, USER_ID, 'lose', SALT);

      expect(isValid).toBe(false);
    });
  });
});
