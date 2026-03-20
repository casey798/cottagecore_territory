import { APIGatewayProxyResult } from 'aws-lambda';

export const enum ErrorCode {
  INVALID_DOMAIN = 'INVALID_DOMAIN',
  NOT_IN_ROSTER = 'NOT_IN_ROSTER',
  INVALID_CODE = 'INVALID_CODE',
  QR_EXPIRED = 'QR_EXPIRED',
  QR_INVALID = 'QR_INVALID',
  GPS_OUT_OF_RANGE = 'GPS_OUT_OF_RANGE',
  NOT_ASSIGNED = 'NOT_ASSIGNED',
  LOCATION_LOCKED = 'LOCATION_LOCKED',
  DAILY_CAP_REACHED = 'DAILY_CAP_REACHED',
  MINIGAME_ALREADY_PLAYED = 'MINIGAME_ALREADY_PLAYED',
  MINIGAME_ALREADY_WON = 'MINIGAME_ALREADY_WON',
  LOCATION_EXHAUSTED = 'LOCATION_EXHAUSTED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_COMPLETED = 'SESSION_COMPLETED',
  INVALID_HASH = 'INVALID_HASH',
  SUSPICIOUS_TIME = 'SUSPICIOUS_TIME',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  GAME_INACTIVE = 'GAME_INACTIVE',
  SEASON_ENDED = 'SEASON_ENDED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_ADMIN = 'NOT_ADMIN',
  ALL_MINIGAMES_PLAYED = 'ALL_MINIGAMES_PLAYED',
  NOT_IN_RANGE = 'NOT_IN_RANGE',
  ALREADY_CHECKED_IN = 'ALREADY_CHECKED_IN',
  COOP_REQUIRED = 'COOP_REQUIRED',
  PARTNER_CAP_REACHED = 'PARTNER_CAP_REACHED',
  PARTNER_LOCATION_LOCKED = 'PARTNER_LOCATION_LOCKED',
  PARTNER_ALREADY_WON = 'PARTNER_ALREADY_WON',
  DUPLICATE_QR_NUMBER = 'DUPLICATE_QR_NUMBER',
  QUIET_MODE = 'QUIET_MODE',
  QUIET_MODE_ACTIVE = 'QUIET_MODE_ACTIVE',
  DURATION_CAP_EXCEEDED = 'DURATION_CAP_EXCEEDED',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

export function success(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true, data }),
  };
}

export function error(
  code: ErrorCode,
  message: string,
  statusCode: number
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: { code, message },
    }),
  };
}
