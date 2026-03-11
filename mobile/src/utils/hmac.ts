import CryptoJS from 'crypto-js';
import { COMPLETION_SALT } from '@/constants/config';

export function generateCompletionHash(
  sessionId: string,
  userId: string,
  result: string,
  salt: string,
): string {
  const data = `${sessionId}:${userId}:${result}`;
  return CryptoJS.HmacSHA256(data, salt).toString(CryptoJS.enc.Hex);
}

export function generateClientCompletionHash(
  sessionId: string,
  result: string,
  timeTaken: number,
): string {
  const data = `${sessionId}:${result}:${timeTaken}`;
  return CryptoJS.HmacSHA256(data, COMPLETION_SALT).toString(CryptoJS.enc.Hex);
}
