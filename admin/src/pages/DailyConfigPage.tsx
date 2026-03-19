import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getLocations, getMasterLocations, suggestDailyPool, deployAssignments, getSeasonSchedule, saveSeasonSchedule } from '@/api/locations';
import { getMapConfig } from '@/api/map';
import { getDailyConfig, setDailyConfig, applyDailyConfig, sendTestNotification, triggerScheduledJob, getUserByEmail, resetPlayerState } from '@/api/daily';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MapPolygonEditor, type PolygonValue } from '@/components/MapPolygonEditor';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '@/constants/map';
import type { Location, LocationClassification, SuggestedLocation, ScheduleEntry } from '@/types';

const CLASSIFICATION_BADGE: Record<LocationClassification, string> = {
  'Social Hub': 'bg-green-100 text-green-800',
  'Transit / Forced Stay': 'bg-blue-100 text-blue-800',
  'Hidden Gem': 'bg-yellow-100 text-yellow-800',
  'Dead Zone': 'bg-red-100 text-red-800',
  Unvisited: 'bg-gray-100 text-gray-700',
  TBD: 'bg-purple-100 text-purple-800',
};

const TEST_NOTIFICATION_WINDOWS = [
  { value: 'morning', label: 'Morning Break (10:40 AM)' },
  { value: 'lunch', label: 'Lunch Break (12:40 PM)' },
  { value: 'final', label: 'Final Push (5:00 PM)' },
  { value: 'day_start', label: 'Day Start (8:00 AM)' },
  { value: 'capture', label: 'Capture Result' },
  { value: 'asset_expiry', label: 'Asset Expiry Warning' },
] as const;

const IS_DEV = import.meta.env.VITE_STAGE !== 'prod';

const SCHEDULED_JOBS = [
  { value: 'daily_reset', label: 'Trigger Daily Reset', color: '#C0392B' },
  { value: 'daily_scoring', label: 'Trigger Daily Scoring', color: '#8B6914' },
  { value: 'event_morning', label: 'Morning Notif', color: '#D4A843' },
  { value: 'event_lunch', label: 'Lunch Notif', color: '#D4A843' },
  { value: 'event_final', label: 'Final Push Notif', color: '#D4A843' },
  { value: 'asset_expiry', label: 'Asset Expiry', color: '#7D3C98' },
  { value: 'asset_expiry_warning', label: 'Asset Expiry Warning', color: '#7D3C98' },
] as const;

const CLAN_COLORS: Record<string, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#F1C40F',
  gale: '#27AE60',
  hearth: '#7D3C98',
};

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
  const [targetName, setTargetName] = useState('');
  const [targetDesc, setTargetDesc] = useState('');
  const [targetOverlay, setTargetOverlay] = useState('default');
  const [polygonValue, setPolygonValue] = useState<PolygonValue>({
    polygonPoints: [],
    cells: [],
  });
  const [quietMode, setQuietMode] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [testWindow, setTestWindow] = useState('morning');
  const [testTargetUserId, setTestTargetUserId] = useState('');
  const [testResult, setTestResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const testNotifMut = useMutation({
    mutationFn: () =>
      sendTestNotification(testWindow, testTargetUserId.trim() || undefined),
    onSuccess: (data) => {
      setTestResult({
        type: 'success',
        message: `Sent "${data.window}" — ${data.deliveryCount} delivered`,
      });
      setTimeout(() => setTestResult(null), 5000);
    },
    onError: (err) => {
      setTestResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send',
      });
      setTimeout(() => setTestResult(null), 8000);
    },
  });

  const [schedResult, setSchedResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [resetEmail, setResetEmail] = useState('');
  const [resetResult, setResetResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const resetPlayerMut = useMutation({
    mutationFn: async () => {
      const email = resetEmail.trim();
      if (!email) throw new Error('Enter a player email');
      const user = await getUserByEmail(email);
      if (!user) throw new Error('No user found with that email');
      await resetPlayerState(user.userId);
      return email;
    },
    onSuccess: (email) => {
      setResetResult({
        type: 'success',
        message: `Player state reset for ${email}`,
      });
      setResetEmail('');
      setTimeout(() => setResetResult(null), 5000);
    },
    onError: (err) => {
      setResetResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Reset failed',
      });
      setTimeout(() => setResetResult(null), 8000);
    },
  });

  const schedMut = useMutation({
    mutationFn: (job: string) => triggerScheduledJob(job),
    onSuccess: (data) => {
      setSchedResult({
        type: 'success',
        message: `[${data.job}] ${data.summary || 'Completed'} (${data.executedAt})`,
      });
    },
    onError: (err) => {
      setSchedResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Job failed',
      });
    },
  });

  // ── Algorithm Suggest state ──────────────────
  const [suggestions, setSuggestions] = useState<SuggestedLocation[]>([]);
  const [suggestChecked, setSuggestChecked] = useState<Set<string>>(new Set());

  const suggestMut = useMutation({
    mutationFn: suggestDailyPool,
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
      setSuggestChecked(
        new Set(data.suggestions.filter((s) => s.included).map((s) => s.locationId)),
      );
    },
    onError: (err) => {
      setNotification({ type: 'error', message: (err as Error).message });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  function acceptSuggested() {
    setSelectedIds(new Set(suggestChecked));
  }

  // ── Deploy Assignments state ───────────────
  const [deployConfirmOpen, setDeployConfirmOpen] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const deployMut = useMutation({
    mutationFn: deployAssignments,
    onSuccess: (data) => {
      setDeployResult({
        type: 'success',
        message: `Assigned ${data.assigned} players (${data.failed} failed) for ${data.date}`,
      });
      setTimeout(() => setDeployResult(null), 8000);
    },
    onError: (err) => {
      setDeployResult({
        type: 'error',
        message: (err as Error).message,
      });
      setTimeout(() => setDeployResult(null), 8000);
    },
  });

  // ── Capture Schedule state ─────────────────
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleRows, setScheduleRows] = useState<ScheduleEntry[]>([]);
  const [schedSaveResult, setSchedSaveResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: masterLocations } = useQuery({
    queryKey: ['master-locations'],
    queryFn: getMasterLocations,
  });

  const { data: existingSchedule } = useQuery({
    queryKey: ['season-schedule'],
    queryFn: getSeasonSchedule,
  });

  useEffect(() => {
    if (existingSchedule && scheduleRows.length === 0) {
      setScheduleRows(existingSchedule);
    }
  }, [existingSchedule]);

  const schedSaveMut = useMutation({
    mutationFn: () => saveSeasonSchedule(scheduleRows),
    onSuccess: () => {
      setSchedSaveResult({ type: 'success', message: 'Schedule saved.' });
      setTimeout(() => setSchedSaveResult(null), 5000);
    },
    onError: (err) => {
      setSchedSaveResult({ type: 'error', message: (err as Error).message });
      setTimeout(() => setSchedSaveResult(null), 5000);
    },
  });

  function addScheduleRow() {
    setScheduleRows((prev) => [...prev, { date: '', captureSpaceId: '' }]);
  }

  function removeScheduleRow(idx: number) {
    setScheduleRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateScheduleRow(idx: number, field: keyof ScheduleEntry, value: string) {
    setScheduleRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  }

  const { data: mapConfig } = useQuery({
    queryKey: ['map-config'],
    queryFn: getMapConfig,
  });

  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  const { data: existingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['daily-config', today],
    queryFn: () => getDailyConfig(today),
  });

  // Pre-fill fields from existing config
  useEffect(() => {
    if (existingConfig) {
      setQuietMode(existingConfig.quietMode ?? false);
      setSelectedIds(new Set(existingConfig.activeLocationIds));
      if (existingConfig.targetSpace) {
        setTargetName(existingConfig.targetSpace.name);
        setTargetDesc(existingConfig.targetSpace.description);
        setTargetOverlay(existingConfig.targetSpace.mapOverlayId);
        if (existingConfig.targetSpace.polygonPoints) {
          setPolygonValue({
            polygonPoints: existingConfig.targetSpace.polygonPoints,
            cells: existingConfig.targetSpace.gridCells ?? [],
          });
        }
      }
    }
  }, [existingConfig]);

  const configStatus = existingConfig?.status ?? null;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!quietMode) {
        if (selectedIds.size === 0) throw new Error('Select at least one location');
        if (!targetName.trim()) throw new Error('Target space name is required');
        if (!targetDesc.trim()) throw new Error('Target space description is required');
      }

      const body: Record<string, unknown> = {
        date: today,
        quietMode,
      };

      if (!quietMode) {
        body.activeLocationIds = Array.from(selectedIds);
        body.targetSpace = {
          name: targetName.trim(),
          description: targetDesc.trim(),
          mapOverlayId: targetOverlay.trim() || 'default',
          polygonPoints: polygonValue.polygonPoints,
          gridCells: polygonValue.cells,
        };
      }

      const result = await setDailyConfig(body as Parameters<typeof setDailyConfig>[0]);
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

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!quietMode) {
        if (selectedIds.size === 0) throw new Error('Select at least one location');
        if (!targetName.trim()) throw new Error('Target space name is required');
        if (!targetDesc.trim()) throw new Error('Target space description is required');
      }

      // Save config first
      const body: Record<string, unknown> = {
        date: today,
        quietMode,
      };

      if (!quietMode) {
        body.activeLocationIds = Array.from(selectedIds);
        body.targetSpace = {
          name: targetName.trim(),
          description: targetDesc.trim(),
          mapOverlayId: targetOverlay.trim() || 'default',
          polygonPoints: polygonValue.polygonPoints,
          gridCells: polygonValue.cells,
        };
      }

      await setDailyConfig(body as Parameters<typeof setDailyConfig>[0]);

      // Then apply immediately
      return applyDailyConfig();
    },
    onSuccess: (data) => {
      setNotification({
        type: 'success',
        message: `Locations applied — ${data.assignedPlayerCount} players will see updated pins immediately`,
      });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setNotification({ type: 'error', message: `Failed to apply locations: ${msg}` });
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
        <div className="flex items-center gap-3">
          {configLoading ? (
            <span className="text-sm text-[#3D2B1F]/50">Checking...</span>
          ) : configStatus ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#27AE60]/10 px-3 py-1 text-sm font-medium text-[#27AE60]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#27AE60]" />
              Config set for today ✓
              {configStatus === 'scoring' && ' (Scoring)'}
              {configStatus === 'complete' && ' (Complete)'}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-[#D4A843]/10 px-3 py-1 text-sm font-medium text-[#D4A843]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#D4A843]" />
              Not configured yet ⚠️
            </span>
          )}
          <span className="rounded bg-[#8B6914]/10 px-3 py-1 text-sm font-medium text-[#8B6914]">
            {today} (IST)
          </span>
        </div>
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

      {existingConfig?.winnerClan && existingConfig.status === 'complete' && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg border-2 p-4"
          style={{
            borderColor: CLAN_COLORS[existingConfig.winnerClan] ?? '#8B6914',
            backgroundColor: `${CLAN_COLORS[existingConfig.winnerClan] ?? '#8B6914'}15`,
          }}
        >
          <span className="text-2xl">🏆</span>
          <span className="text-lg font-bold" style={{ color: CLAN_COLORS[existingConfig.winnerClan] ?? '#8B6914' }}>
            {existingConfig.winnerClan.charAt(0).toUpperCase() + existingConfig.winnerClan.slice(1)}
          </span>
          <span className="text-[#3D2B1F]">
            captured {existingConfig.targetSpace?.name ?? 'the territory'} today
          </span>
        </div>
      )}

      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={(error as Error).message} />}

      {/* Quiet Mode toggle */}
      <div className="mb-4 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#3D2B1F]">Quiet mode</h2>
            <p className="text-sm text-[#3D2B1F]/60">
              Suspends competitive gameplay. Players can still access minigames for practice and check in at locations.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={quietMode}
            onClick={() => setQuietMode((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              quietMode ? 'bg-[#D4A843]' : 'bg-[#A0937D]/40'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                quietMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {quietMode && (
          <div className="mt-3 rounded border border-[#D4A843]/30 bg-[#D4A843]/10 px-3 py-2 text-sm text-[#8B6914]">
            No location pool or target space required. QR generation will be disabled.
          </div>
        )}
      </div>

      {locations && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Location selection */}
          <div className={`rounded-lg border border-[#8B6914]/20 bg-white p-4 ${quietMode ? 'pointer-events-none opacity-40' : ''}`}>
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

          {/* Right: Target space */}
          <div className="space-y-4">
            <div className={`rounded-lg border border-[#8B6914]/20 bg-white p-4 ${quietMode ? 'pointer-events-none opacity-40' : ''}`}>
              <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
                Today's Capturable Space
              </h2>
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
                  Space Name
                </label>
                <input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. North Courtyard"
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
                  placeholder="A shaded courtyard near the main hall..."
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
                  placeholder="overlay-nc"
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                />
              </div>

              {mapConfig?.mapImageUrl && (
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
                    Territory Polygon
                  </label>
                  <MapPolygonEditor
                    mapImageUrl={mapConfig.mapImageUrl}
                    mapWidth={MAP_WIDTH}
                    mapHeight={MAP_HEIGHT}
                    tileSize={TILE_SIZE}
                    value={polygonValue}
                    onChange={setPolygonValue}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || applyMut.isPending}
                className="flex-1 rounded bg-[#8B6914] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
              >
                {saveMut.isPending ? 'Saving...' : 'Save Config'}
              </button>
              <button
                onClick={() => applyMut.mutate()}
                disabled={saveMut.isPending || applyMut.isPending}
                className="flex-1 rounded bg-[#27AE60] px-4 py-3 text-sm font-semibold text-white hover:bg-[#219A52] disabled:opacity-50"
              >
                {applyMut.isPending ? 'Applying...' : 'Save & Apply Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Algorithm Suggest Section */}
      {locations && (
        <div className="mt-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#3D2B1F]">Algorithm Suggest</h2>
            <div className="flex gap-2">
              <button
                onClick={() => suggestMut.mutate()}
                disabled={suggestMut.isPending}
                className="rounded bg-[#8B6914] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
              >
                {suggestMut.isPending ? 'Computing...' : suggestions.length > 0 ? 'Regenerate' : 'Suggest Pool'}
              </button>
              {suggestions.length > 0 && (
                <button
                  onClick={acceptSuggested}
                  className="rounded bg-[#27AE60] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#219A52]"
                >
                  Accept Suggested
                </button>
              )}
            </div>
          </div>
          {suggestions.length > 0 && (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {suggestions.map((s) => (
                <label
                  key={s.locationId}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[#F5EACB]"
                >
                  <input
                    type="checkbox"
                    checked={suggestChecked.has(s.locationId)}
                    onChange={() => {
                      setSuggestChecked((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.locationId)) next.delete(s.locationId);
                        else next.add(s.locationId);
                        return next;
                      });
                    }}
                    className="accent-[#8B6914]"
                  />
                  <span className="w-8 text-sm font-bold text-[#8B6914]">#{s.qrNumber}</span>
                  <span className="flex-1 text-sm text-[#3D2B1F]">{s.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICATION_BADGE[s.classification] ?? 'bg-gray-100 text-gray-700'}`}>
                    {s.classification}
                  </span>
                  <span className="w-10 text-right text-xs font-medium text-[#3D2B1F]/60">
                    {s.score.toFixed(1)}
                  </span>
                  {s.warning && (
                    <span className="flex items-center gap-0.5 rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700">
                      <span>&#9888;</span> {s.warning}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Capture Schedule Section */}
      <div className="mt-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <button
          onClick={() => setScheduleOpen((v) => !v)}
          className="flex w-full items-center justify-between text-lg font-semibold text-[#3D2B1F]"
        >
          <span>Season Capture Schedule</span>
          <span className="text-sm text-[#8B6914]">{scheduleOpen ? '\u25B2' : '\u25BC'}</span>
        </button>
        {scheduleOpen && (
          <div className="mt-3">
            {schedSaveResult && (
              <div
                className={`mb-3 rounded p-2 text-sm ${
                  schedSaveResult.type === 'success'
                    ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                    : 'border border-red-300 bg-red-50 text-red-800'
                }`}
              >
                {schedSaveResult.message}
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#8B6914]/10 text-left text-xs font-medium text-[#3D2B1F]/50">
                  <th className="py-1.5 pr-2">Day</th>
                  <th className="py-1.5 pr-2">Date</th>
                  <th className="py-1.5 pr-2">Space Name</th>
                  <th className="py-1.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[#8B6914]/5">
                    <td className="py-1.5 pr-2 text-[#3D2B1F]/50">Day {idx + 1}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateScheduleRow(idx, 'date', e.target.value)}
                        className="rounded border border-[#8B6914]/30 bg-white px-2 py-1 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={row.captureSpaceId}
                        onChange={(e) => updateScheduleRow(idx, 'captureSpaceId', e.target.value)}
                        className="w-full rounded border border-[#8B6914]/30 bg-white px-2 py-1 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                      >
                        <option value="">Select location...</option>
                        {(masterLocations ?? []).map((l) => (
                          <option key={l.locationId} value={l.locationId}>
                            #{l.qrNumber} {l.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5">
                      <button
                        onClick={() => removeScheduleRow(idx)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex gap-2">
              <button
                onClick={addScheduleRow}
                className="rounded bg-[#F5EACB] px-3 py-1.5 text-sm font-medium text-[#3D2B1F] hover:bg-[#D4A843]/30"
              >
                + Add Day
              </button>
              <button
                onClick={() => schedSaveMut.mutate()}
                disabled={schedSaveMut.isPending}
                className="rounded bg-[#8B6914] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
              >
                {schedSaveMut.isPending ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deploy Assignments Section */}
      <div className="mt-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Deploy Player Assignments</h2>
        <p className="mb-3 text-sm text-[#3D2B1F]/60">
          Compute weighted location assignments for all players based on cluster weights, rotation history, and spatial spread.
        </p>
        {deployResult && (
          <div
            className={`mb-3 rounded p-2 text-sm ${
              deployResult.type === 'success'
                ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                : 'border border-red-300 bg-red-50 text-red-800'
            }`}
          >
            {deployResult.message}
          </div>
        )}
        <button
          onClick={() => setDeployConfirmOpen(true)}
          disabled={deployMut.isPending}
          className="rounded bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A93226] disabled:opacity-50"
        >
          {deployMut.isPending ? 'Deploying...' : 'Deploy Player Assignments'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={deployConfirmOpen}
        onClose={() => setDeployConfirmOpen(false)}
        onConfirm={() => {
          setDeployConfirmOpen(false);
          deployMut.mutate();
        }}
        title="Deploy Assignments"
        message="This will compute and write location assignments for all ~421 players. Continue?"
      />

      {IS_DEV && (
        <div className="mt-6 rounded-lg border border-[#D4A843]/30 bg-[#D4A843]/5 p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
            Test Notifications (Dev Only)
          </h2>
          {testResult && (
            <div
              className={`mb-3 rounded p-2 text-sm ${
                testResult.type === 'success'
                  ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                  : 'border border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {testResult.message}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                Notification Type
              </label>
              <select
                value={testWindow}
                onChange={(e) => setTestWindow(e.target.value)}
                className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              >
                {TEST_NOTIFICATION_WINDOWS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                Target User ID (optional)
              </label>
              <input
                value={testTargetUserId}
                onChange={(e) => setTestTargetUserId(e.target.value)}
                placeholder="Leave empty for all users"
                className="w-64 rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <button
              onClick={() => testNotifMut.mutate()}
              disabled={testNotifMut.isPending}
              className="rounded bg-[#D4A843] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8922E] disabled:opacity-50"
            >
              {testNotifMut.isPending ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>
      )}

      {IS_DEV && (
        <div className="mt-6 rounded-lg border border-red-300/40 bg-red-50/30 p-4">
          <h2 className="mb-2 text-lg font-semibold text-[#3D2B1F]">
            Debug: Trigger Scheduled Jobs (Dev Only)
          </h2>
          <p className="mb-3 rounded bg-red-100 px-3 py-2 text-xs font-medium text-red-700">
            These actions are irreversible and affect live data. Use only for testing.
          </p>
          {schedResult && (
            <div
              className={`mb-3 rounded p-2 text-sm whitespace-pre-wrap ${
                schedResult.type === 'success'
                  ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                  : 'border border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {schedResult.message}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {SCHEDULED_JOBS.map((j) => (
              <button
                key={j.value}
                onClick={() => schedMut.mutate(j.value)}
                disabled={schedMut.isPending}
                className="rounded px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: schedMut.isPending ? '#999' : j.color }}
              >
                {schedMut.isPending && schedMut.variables === j.value
                  ? 'Running...'
                  : j.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {IS_DEV && (
        <div className="mt-6 rounded-lg border border-red-300/40 bg-red-50/30 p-4">
          <h2 className="mb-2 text-lg font-semibold text-[#3D2B1F]">
            Player State Reset (Dev Only)
          </h2>
          <p className="mb-3 rounded bg-red-100 px-3 py-2 text-xs font-medium text-red-700">
            Resets todayXp, sessions, locks, and location assignments for this player.
          </p>
          {resetResult && (
            <div
              className={`mb-3 rounded p-2 text-sm ${
                resetResult.type === 'success'
                  ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                  : 'border border-red-300 bg-red-50 text-red-800'
              }`}
            >
              {resetResult.message}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                Player Email
              </label>
              <input
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-64 rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <button
              onClick={() => resetPlayerMut.mutate()}
              disabled={resetPlayerMut.isPending}
              className="rounded bg-[#D4A843] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8922E] disabled:opacity-50"
            >
              {resetPlayerMut.isPending ? 'Resetting...' : 'Reset Player State'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
