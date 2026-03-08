import { toZonedTime } from 'date-fns-tz';
import { GAME_START_HOUR, GAME_END_HOUR } from '@/constants/config';

const IST_TIMEZONE = 'Asia/Kolkata';

export function getNowIST(): Date {
  return toZonedTime(new Date(), IST_TIMEZONE);
}

export function getTodayISTString(): string {
  const now = getNowIST();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWithinGameHours(): boolean {
  const now = getNowIST();
  const hour = now.getHours();
  return hour >= GAME_START_HOUR && hour < GAME_END_HOUR;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

export function getEndOfGameTimeToday(): Date {
  const now = getNowIST();
  const endOfGame = new Date(now);
  endOfGame.setHours(GAME_END_HOUR, 0, 0, 0);
  return endOfGame;
}
