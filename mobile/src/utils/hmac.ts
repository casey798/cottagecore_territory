import CryptoJS from 'crypto-js';

export function generateCompletionHash(
  sessionId: string,
  userId: string,
  result: string,
  salt: string,
): string {
  const data = `${sessionId}:${userId}:${result}`;
  return CryptoJS.HmacSHA256(data, salt).toString(CryptoJS.enc.Hex);
}
