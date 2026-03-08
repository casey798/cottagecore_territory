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
