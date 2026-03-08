import { apiRequest } from './client';
import { ENDPOINTS } from '@/constants/api';
import { MapConfig, Location, DailyInfo } from '@/types';

export function getMapConfig() {
  return apiRequest<MapConfig>(ENDPOINTS.MAP_CONFIG);
}

export function getTodayLocations() {
  return apiRequest<{ locations: Location[] }>(ENDPOINTS.LOCATIONS_TODAY);
}

export function getDailyInfo() {
  return apiRequest<DailyInfo>(ENDPOINTS.DAILY_INFO);
}
