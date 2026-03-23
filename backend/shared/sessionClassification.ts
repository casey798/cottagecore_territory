export const SESSION_TYPES = {
  FREE_ROAM: 'free_roam',
  COMPETITIVE: 'competitive',
  PRACTICE: 'practice',
} as const;

export type SessionType = typeof SESSION_TYPES[keyof typeof SESSION_TYPES];

export function classifySession(session: {
  minigameId?: string;
  practiceSession?: boolean;
  result?: string;
}): SessionType {
  if (session.minigameId === 'checkin') return SESSION_TYPES.FREE_ROAM;
  if (session.practiceSession === true) return SESSION_TYPES.PRACTICE;
  return SESSION_TYPES.COMPETITIVE;
}

export function isCompetitive(session: { minigameId?: string; practiceSession?: boolean }): boolean {
  return classifySession(session) === SESSION_TYPES.COMPETITIVE;
}

export function isFreeRoam(session: { minigameId?: string }): boolean {
  return session.minigameId === 'checkin';
}

export function isPractice(session: { minigameId?: string; practiceSession?: boolean }): boolean {
  return classifySession(session) === SESSION_TYPES.PRACTICE;
}

// True abandoned = competitive session that was never completed (no explicit result submission)
// leaveReason='new_scan' means player physically moved on (scan-closed ghost record)
export function isTrueAbandoned(session: {
  minigameId?: string;
  practiceSession?: boolean;
  result?: string;
  leaveReason?: string | null;
}): boolean {
  return isCompetitive(session)
    && session.result === 'abandoned'
    && session.leaveReason !== 'new_scan';
}
