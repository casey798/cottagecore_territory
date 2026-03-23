import { BASE_URL } from '@/constants/api';
import { useAuthStore } from '@/store/useAuthStore';

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

async function downloadCsv(path: string, fallbackFilename: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });

  if (response.status === 401 || response.status === 403) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let message = 'Export failed';
    try {
      const errData = await response.json();
      message = errData.error?.message || message;
    } catch {
      // response wasn't JSON
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Extract filename from Content-Disposition or use fallback
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) a.download = match[1];
    else a.download = fallbackFilename;
  } else {
    a.download = fallbackFilename;
  }

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportGameSessions(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/game-sessions${buildQuery({ startDate, endDate })}`,
    `game-sessions-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportCheckins(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/checkins/export${buildQuery({ startDate, endDate })}`,
    `checkins-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportPlayerProfiles(): Promise<void> {
  await downloadCsv('/admin/export/player-profiles', 'player-profiles.csv');
}

export async function exportPlayerAssignments(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/player-assignments${buildQuery({ startDate, endDate })}`,
    `player-assignments-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportCaptureHistory(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/capture-history${buildQuery({ startDate, endDate })}`,
    `capture-history-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportLocations(): Promise<void> {
  await downloadCsv('/admin/export/locations', 'locations.csv');
}

export async function exportDailyConfigs(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/daily-configs${buildQuery({ startDate, endDate })}`,
    `daily-configs-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportNotificationHistory(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/notification-history${buildQuery({ startDate, endDate })}`,
    `notification-history-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportLocationSummary(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/location-summary${buildQuery({ startDate, endDate })}`,
    `location-summary-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportAssetCollectionByClan(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/asset-collection-by-clan${buildQuery({ startDate, endDate })}`,
    `asset-collection-by-clan-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportAssetDropsByLocation(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/asset-collection-by-location${buildQuery({ startDate, endDate })}`,
    `asset-drops-by-location-${startDate}-to-${endDate}.csv`,
  );
}

export async function exportClusterHistory(startDate: string, endDate: string): Promise<void> {
  await downloadCsv(
    `/admin/export/cluster-history${buildQuery({ startDate, endDate })}`,
    `cluster-history-${startDate}-to-${endDate}.csv`,
  );
}
