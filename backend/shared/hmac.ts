import crypto from 'crypto';
import { QrPayload } from './types';

export function generateQrPayload(
  locationId: string,
  date: string,
  secret: string
): QrPayload {
  const message = `${locationId}:${date}`;
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return {
    v: 1,
    l: locationId,
    d: date,
    h: hmac,
  };
}

export function verifyQrPayload(payload: QrPayload, secret: string): boolean {
  const message = `${payload.l}:${payload.d}`;
  const expectedHmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(payload.h, 'hex'),
    Buffer.from(expectedHmac, 'hex')
  );
}

export function generateCompletionHash(
  sessionId: string,
  userId: string,
  result: string,
  salt: string
): string {
  const message = `${sessionId}:${userId}:${result}`;
  return crypto.createHmac('sha256', salt).update(message).digest('hex');
}

export function verifyCompletionHash(
  hash: string,
  sessionId: string,
  userId: string,
  result: string,
  salt: string
): boolean {
  const expected = generateCompletionHash(sessionId, userId, result, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// Client-side completion hash — uses a shared hardcoded salt (not cryptographically secret,
// just prevents trivially forged packets).
const CLIENT_COMPLETION_SALT = 'grovewars-v1-completion-salt';

export function generateClientCompletionHash(
  sessionId: string,
  result: string,
  timeTaken: number
): string {
  const message = `${sessionId}:${result}:${timeTaken}`;
  return crypto.createHmac('sha256', CLIENT_COMPLETION_SALT).update(message).digest('hex');
}

export function verifyClientCompletionHash(
  hash: string,
  sessionId: string,
  result: string,
  timeTaken: number
): boolean {
  const expected = generateClientCompletionHash(sessionId, result, timeTaken);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}
