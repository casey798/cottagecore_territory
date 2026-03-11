export const BASE_URL =
  'https://incbqo08d8.execute-api.ap-south-1.amazonaws.com/dev';
export const WS_URL =
  'wss://vegaw2zi58.execute-api.ap-south-1.amazonaws.com/dev';
export const USER_POOL_ID = 'ap-south-1_1Sj502jqF';
export const USER_POOL_CLIENT_ID = '7bh1l2629baepvagqp1l3v0qg5';
export const REGION = 'ap-south-1';

export const ENDPOINTS = {
  AUTH_SIGNUP: '/auth/signup',
  AUTH_VERIFY: '/auth/verify',
  AUTH_LOGIN: '/auth/login',
  PLAYER_PROFILE: '/player/profile',
  PLAYER_AVATAR: '/player/avatar',
  PLAYER_ASSETS: '/player/assets',
  PLAYER_STATS: '/player/stats',
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
} as const;
