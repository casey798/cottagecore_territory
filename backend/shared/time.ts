import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, startOfDay, addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

const IST_TIMEZONE = 'Asia/Kolkata';

export function getNowIST(): Date {
  return toZonedTime(new Date(), IST_TIMEZONE);
}

export function getTodayISTString(): string {
  const nowIST = getNowIST();
  return format(nowIST, 'yyyy-MM-dd');
}

export function getMidnightISTTimestamp(): number {
  const nowIST = getNowIST();
  const tomorrowMidnightIST = startOfDay(addDays(nowIST, 1));
  const utcTime = fromZonedTime(tomorrowMidnightIST, IST_TIMEZONE);
  return utcTime.getTime();
}

export function getNext8amISTEpochSeconds(): number {
  const nowIST = getNowIST();
  let target = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(nowIST), 8), 0), 0), 0);
  if (nowIST >= target) {
    target = addDays(target, 1);
  }
  const utcTime = fromZonedTime(target, IST_TIMEZONE);
  return Math.floor(utcTime.getTime() / 1000);
}

export function isWithinGameHours(): boolean {
  const nowIST = getNowIST();
  const hours = nowIST.getHours();
  return hours >= 8 && hours < 18;
}

export function getMidnightISTAsISO(): string {
  const nowIST = getNowIST();
  const tomorrowMidnightIST = startOfDay(addDays(nowIST, 1));
  const utcTime = fromZonedTime(tomorrowMidnightIST, IST_TIMEZONE);
  return utcTime.toISOString();
}

export function toISTString(date: Date): string {
  const istDate = toZonedTime(date, IST_TIMEZONE);
  return format(istDate, 'yyyy-MM-dd');
}
