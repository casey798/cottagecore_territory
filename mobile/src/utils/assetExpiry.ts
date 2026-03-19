/**
 * Parse an ISO expiry timestamp and return hours + minutes remaining.
 */
export function getTimeUntilExpiry(expiresAt: string): {
  hours: number;
  minutes: number;
  expired: boolean;
} {
  const expiryMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const diffMs = expiryMs - nowMs;

  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const totalMinutes = Math.floor(diffMs / 60_000);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    expired: false,
  };
}
