export interface MinigameResult {
  result: 'win' | 'lose' | 'timeout';
  timeTaken: number;
  completionHash: string;
  solutionData: Record<string, unknown>;
}

export interface MinigamePlayProps {
  sessionId: string;
  timeLimit: number;
  onComplete: (result: MinigameResult) => void;
  puzzleData?: Record<string, unknown>;
  practiceMode?: boolean;
  salt?: string;
  coopPartnerId?: string;
  /** When true: no API calls are made and no XP is awarded. Used in tutorial demo. */
  isTutorial?: boolean;
}
