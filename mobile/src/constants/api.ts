export const BASE_URL =
  'https://incbqo08d8.execute-api.ap-south-1.amazonaws.com/dev';
export const WS_URL =
  'wss://vegaw2zi58.execute-api.ap-south-1.amazonaws.com/dev';
export const REGION = 'ap-south-1';

export const ENDPOINTS = {
  AUTH_GOOGLE_LOGIN: '/auth/google-login',
  PLAYER_PROFILE: '/player/profile',
  PLAYER_AVATAR: '/player/avatar',
  PLAYER_ASSETS: '/player/assets',
  PLAYER_STATS: '/player/stats',
  PLAYER_CLAN: '/player/clan',
  MAP_CONFIG: '/map/config',
  LOCATIONS_TODAY: '/locations/today',
  DAILY_INFO: '/daily/info',
  GAME_SCAN: '/game/scan',
  GAME_START: '/game/start',
  GAME_COMPLETE: '/game/complete',
  SCORES_CLANS: '/scores/clans',
  SCORES_HISTORY: '/scores/history',
  SPACES_CAPTURED: '/spaces/captured',
  SPACES_DECORATION: '/spaces',
  PLAYER_FCM_TOKEN: '/player/fcm-token',
  PLAYER_SEARCH: '/player/search',
  CHECKIN_SUBMIT: '/checkin/submit',
  GAME_START_PRACTICE: '/game/startPractice',
  GAME_CHECKIN: '/game/checkin',
  SUBMIT_LEAVE: '/game/session/leave',
  SEASON_SUMMARY: '/season/summary',
  PLAYER_JOURNAL: '/player/journal',
  PLAYER_TUTORIAL_DONE: '/player/tutorialDone',
  ACCEPT_TC: '/player/acceptTc',
  SPACE_ASSIGNMENTS_TODAY: '/spaces/assignments/today',
  SCAN_SPACE_QR: '/spaces/scan-qr',
  SUBMIT_SPACE_DECORATION: '/spaces/decoration/submit',
  MY_DECORATIONS: '/spaces/my-decorations',
} as const;

export function SUBMIT_SENTIMENT(sessionId: string): string {
  return `/game/session/${sessionId}/sentiment`;
}
