import { DAILY_XP_CAP, XP_PER_WIN } from '@/constants/config';

export function canEarnXp(todayXp: number): boolean {
  return todayXp < DAILY_XP_CAP;
}

export function xpToWinsRemaining(todayXp: number): number {
  const remaining = DAILY_XP_CAP - todayXp;
  return Math.max(0, Math.ceil(remaining / XP_PER_WIN));
}

export function isOnCooldown(cooldownEndsAt: string | null): boolean {
  if (!cooldownEndsAt) return false;
  return new Date(cooldownEndsAt).getTime() > Date.now();
}
