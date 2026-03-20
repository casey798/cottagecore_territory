import { getItem } from './db';
import { getTodayISTString } from './time';
import type { DailyConfig } from './types';

// Module-level cache — valid for the lifetime of a single Lambda invocation.
// Each invocation gets a fresh module scope, so this is inherently invocation-scoped.
let cachedResult: boolean | null = null;

/**
 * Check whether quiet mode is active for today.
 * Result is cached for the lifetime of the Lambda invocation (module-level variable).
 * Returns false if no daily config exists for today.
 */
export async function isQuietModeActive(): Promise<boolean> {
  if (cachedResult !== null) return cachedResult;

  const today = getTodayISTString();
  const config = await getItem<DailyConfig>('daily-config', { date: today });
  cachedResult = config?.quietMode === true;
  return cachedResult;
}
