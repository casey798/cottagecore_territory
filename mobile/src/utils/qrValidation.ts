import { QrData } from '@/types';

export function parseQrPayload(raw: string): QrData | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.v === 'number' &&
      typeof parsed.l === 'string' &&
      typeof parsed.d === 'string' &&
      typeof parsed.h === 'string'
    ) {
      return {
        v: parsed.v,
        l: parsed.l,
        d: parsed.d,
        h: parsed.h,
      };
    }
    return null;
  } catch {
    return null;
  }
}
