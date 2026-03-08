import { apiClient } from './client';
import type { RosterImportResult } from '@/types';

export async function importRoster(
  file: File,
): Promise<RosterImportResult> {
  const csvData = await file.text();
  const res = await apiClient.post<RosterImportResult>(
    '/admin/roster/import',
    { csvData },
  );
  return res.data;
}
