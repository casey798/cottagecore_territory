import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getLocations } from '@/api/locations';
import { setDailyConfig } from '@/api/daily';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import type { Location } from '@/types';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DailyConfigPage() {
  const today = useMemo(() => getTodayIST(), []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [targetName, setTargetName] = useState('');
  const [targetDesc, setTargetDesc] = useState('');
  const [targetOverlay, setTargetOverlay] = useState('default');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (selectedIds.size === 0) throw new Error('Select at least one location');
      if (!targetName.trim()) throw new Error('Target space name is required');
      if (!targetDesc.trim()) throw new Error('Target space description is required');

      const body = {
        date: today,
        activeLocationIds: Array.from(selectedIds),
        targetSpace: {
          name: targetName.trim(),
          description: targetDesc.trim(),
          mapOverlayId: targetOverlay.trim() || 'default',
        },
        difficulty,
      };
      console.log('[DailyConfig] Saving:', JSON.stringify(body, null, 2));
      const result = await setDailyConfig(body);
      console.log('[DailyConfig] Response:', JSON.stringify(result, null, 2));
      return result;
    },
    onSuccess: (data) => {
      setNotification({ type: 'success', message: `Daily config saved for ${data.date ?? today}!` });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[DailyConfig] Save failed:', msg);
      setNotification({ type: 'error', message: `Failed to save: ${msg}` });
      setTimeout(() => setNotification(null), 8000);
    },
  });

  function toggleLocation(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!locations) return;
    const activeIds = locations.filter((l) => l.active).map((l) => l.locationId);
    setSelectedIds(new Set(activeIds));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  const activeLocations = useMemo(
    () => (locations ?? []).filter((l) => l.active),
    [locations],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Daily Config</h1>
        <span className="rounded bg-[#8B6914]/10 px-3 py-1 text-sm font-medium text-[#8B6914]">
          {today} (IST)
        </span>
      </div>

      {notification && (
        <div
          className={`mb-4 rounded p-3 text-sm ${
            notification.type === 'success'
              ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={(error as Error).message} />}

      {locations && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Location selection */}
          <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#3D2B1F]">
                Active Locations ({selectedIds.size}/{activeLocations.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-[#8B6914] hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs text-[#8B6914] hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {activeLocations.map((loc: Location) => (
                <label
                  key={loc.locationId}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[#F5EACB]"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(loc.locationId)}
                    onChange={() => toggleLocation(loc.locationId)}
                    className="accent-[#8B6914]"
                  />
                  <span className="text-sm text-[#3D2B1F]">{loc.name}</span>
                  <span className="text-xs text-[#3D2B1F]/40 capitalize">
                    {loc.category}
                  </span>
                </label>
              ))}
              {activeLocations.length === 0 && (
                <p className="text-sm text-[#3D2B1F]/50">
                  No active locations. Create some in the Locations page first.
                </p>
              )}
            </div>
          </div>

          {/* Right: Target space + difficulty */}
          <div className="space-y-4">
            <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
                Target Space (Today's Prize)
              </h2>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
                  Name
                </label>
                <input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Golden Gazebo"
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                />
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
                  Description
                </label>
                <textarea
                  value={targetDesc}
                  onChange={(e) => setTargetDesc(e.target.value)}
                  placeholder="A shimmering gazebo that grants bonus XP..."
                  rows={2}
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
                  Map Overlay ID
                </label>
                <input
                  value={targetOverlay}
                  onChange={(e) => setTargetOverlay(e.target.value)}
                  placeholder="default"
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
                Difficulty
              </h2>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`rounded px-4 py-2 text-sm font-medium capitalize transition ${
                      difficulty === d
                        ? 'bg-[#8B6914] text-white'
                        : 'bg-[#F5EACB] text-[#3D2B1F] hover:bg-[#D4A843]/30'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="w-full rounded bg-[#8B6914] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
            >
              {saveMut.isPending ? 'Saving...' : `Save Daily Config for ${today}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
