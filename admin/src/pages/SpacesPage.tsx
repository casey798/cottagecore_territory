import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { getSpaces, createSpace, updateSpace, deleteSpace, getSpaceQRCodes, getSpaceDecorations } from '@/api/spaces';
import { exportSpaceDecorations } from '@/api/exports';
import { getAnalyticsSpaces } from '@/api/analytics';
import { getMapConfig } from '@/api/map';
import { MapPolygonEditor, type PolygonValue } from '@/components/MapPolygonEditor';
import { Toggle } from '@/components/Toggle';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { pixelToGps } from '../utils/affineTransform';
import { CLAN_COLORS, CLAN_LABELS } from '@/constants/clans';
import type { Space, MapConfig } from '@/types';

// ── Grid cell computation ────────────────────────────────

const TILE = 16;

function computeGridCells(polygonPoints: { x: number; y: number }[]) {
  if (polygonPoints.length < 3) return { gridCells: [], gridColumns: 0, gridRows: 0 };

  const minX = Math.min(...polygonPoints.map((p) => p.x));
  const minY = Math.min(...polygonPoints.map((p) => p.y));
  const maxX = Math.max(...polygonPoints.map((p) => p.x));
  const maxY = Math.max(...polygonPoints.map((p) => p.y));

  const startCol = Math.floor(minX / TILE);
  const endCol = Math.ceil(maxX / TILE);
  const startRow = Math.floor(minY / TILE);
  const endRow = Math.ceil(maxY / TILE);

  const gridCells: { col: number; row: number }[] = [];
  for (let col = startCol; col < endCol; col++) {
    for (let row = startRow; row < endRow; row++) {
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      if (pointInPolygon(cx, cy, polygonPoints)) {
        gridCells.push({ col: col - startCol, row: row - startRow });
      }
    }
  }

  return { gridCells, gridColumns: endCol - startCol, gridRows: endRow - startRow };
}

function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonCenter(pts: { x: number; y: number }[]): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 };
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  return { x: Math.round(sx / pts.length), y: Math.round(sy / pts.length) };
}

// ── Notification helper ─────────────────────────────────

function useNotification() {
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function notify(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  return { notification, notify };
}

// ── Form state ──────────────────────────────────────────

interface FormState {
  name: string;
  gpsLat: number;
  gpsLng: number;
  geofenceRadius: number;
  mapPixelX: number;
  mapPixelY: number;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  gpsLat: 0,
  gpsLng: 0,
  geofenceRadius: 15,
  mapPixelX: 0,
  mapPixelY: 0,
  notes: '',
};

// ── Main component ──────────────────────────────────────

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getSeasonStartDefault(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  ist.setDate(ist.getDate() - 30);
  return ist.toISOString().slice(0, 10);
}

type ViewMode = 'manage' | 'activity';

export function SpacesPage() {
  const queryClient = useQueryClient();
  const { notification, notify } = useNotification();

  // Data queries
  const { data: spaces, isLoading, error } = useQuery({
    queryKey: ['spaces'],
    queryFn: getSpaces,
  });
  const { data: mapConfig } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: getMapConfig,
  });
  const { data: spacesAnalytics } = useQuery({
    queryKey: ['analytics-spaces', getSeasonStartDefault(), getTodayIST()],
    queryFn: () => getAnalyticsSpaces(getSeasonStartDefault(), getTodayIST()),
    staleTime: 5 * 60 * 1000,
  });

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('manage');
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [polygon, setPolygon] = useState<PolygonValue>({ polygonPoints: [], cells: [] });
  const [deleteTarget, setDeleteTarget] = useState<Space | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [showQRPanel, setShowQRPanel] = useState(false);
  const [exportingDecorations, setExportingDecorations] = useState(false);

  const isFormOpen = isCreating || editingSpace !== null;

  // Mutations
  const createMut = useMutation({
    mutationFn: createSpace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      notify('success', 'Space created');
      closeForm();
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ spaceId, body }: { spaceId: string; body: Partial<Space> }) =>
      updateSpace(spaceId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      notify('success', 'Space updated');
      closeForm();
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteSpace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      notify('success', 'Space deleted');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ spaceId, active }: { spaceId: string; active: boolean }) =>
      updateSpace(spaceId, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
    onError: (err) => notify('error', (err as Error).message),
  });

  // Form helpers
  const openCreate = useCallback(() => {
    setEditingSpace(null);
    setIsCreating(true);
    setForm(EMPTY_FORM);
    setPolygon({ polygonPoints: [], cells: [] });
    setSelectedSpaceId(null);
  }, []);

  const openEdit = useCallback((space: Space) => {
    setIsCreating(false);
    setEditingSpace(space);
    setForm({
      name: space.name,
      gpsLat: space.gpsLat,
      gpsLng: space.gpsLng,
      geofenceRadius: space.geofenceRadius,
      mapPixelX: space.mapPixelX,
      mapPixelY: space.mapPixelY,
      notes: space.notes ?? '',
    });
    // Convert absolute grid cells back to map pixel cells for the polygon editor
    // The polygon editor uses {x, y} cells where x/y are absolute tile indices
    const cells = space.gridCells.map((c) => {
      const minX = Math.min(...space.polygonPoints.map((p) => p.x));
      const minY = Math.min(...space.polygonPoints.map((p) => p.y));
      const startCol = Math.floor(minX / TILE);
      const startRow = Math.floor(minY / TILE);
      return { x: c.col + startCol, y: c.row + startRow };
    });
    setPolygon({ polygonPoints: space.polygonPoints, cells });
    setSelectedSpaceId(space.spaceId);
  }, []);

  const closeForm = useCallback(() => {
    setIsCreating(false);
    setEditingSpace(null);
    setForm(EMPTY_FORM);
    setPolygon({ polygonPoints: [], cells: [] });
  }, []);

  const handlePolygonChange = useCallback((val: PolygonValue) => {
    setPolygon(val);
    if (val.polygonPoints.length >= 3 && val.cells.length > 0) {
      const center = polygonCenter(val.polygonPoints);
      setForm((prev) => ({ ...prev, mapPixelX: center.x, mapPixelY: center.y }));
      if (mapConfig?.transformMatrix) {
        const gps = pixelToGps(center.x, center.y, mapConfig.transformMatrix);
        setForm((f) => ({ ...f, gpsLat: gps.lat, gpsLng: gps.lng }));
      }
    }
  }, [mapConfig]);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      notify('error', 'Name is required');
      return;
    }
    if (polygon.polygonPoints.length < 3 || polygon.cells.length === 0) {
      notify('error', 'Draw a closed polygon on the map first');
      return;
    }

    const { gridCells, gridColumns, gridRows } = computeGridCells(polygon.polygonPoints);

    const body = {
      name: form.name.trim(),
      polygonPoints: polygon.polygonPoints,
      gridCells,
      gridColumns,
      gridRows,
      gpsLat: form.gpsLat,
      gpsLng: form.gpsLng,
      geofenceRadius: form.geofenceRadius,
      mapPixelX: form.mapPixelX,
      mapPixelY: form.mapPixelY,
      notes: form.notes || undefined,
    };

    if (editingSpace) {
      updateMut.mutate({ spaceId: editingSpace.spaceId, body });
    } else {
      createMut.mutate(body);
    }
  }, [form, polygon, editingSpace, createMut, updateMut, notify]);

  // Overlay polygons for all saved spaces (except the one being edited)
  const savedPolygonOverlays = useMemo(() => {
    if (!spaces || !mapConfig) return [];
    return spaces
      .filter((s) => s.polygonPoints.length >= 3)
      .filter((s) => s.spaceId !== editingSpace?.spaceId);
  }, [spaces, mapConfig, editingSpace]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;

  const sortedSpaces = [...(spaces ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const handleExportDecorations = async () => {
    setExportingDecorations(true);
    try {
      const today = getTodayIST();
      const start = getSeasonStartDefault();
      await exportSpaceDecorations(start, today);
      notify('success', 'Decoration CSV downloaded');
    } catch (err) {
      notify('error', (err as Error).message);
    } finally {
      setExportingDecorations(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Header with view toggle + actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Spaces</h1>
          <div className="flex rounded border border-[#8B6914]/30">
            <button
              onClick={() => setViewMode('manage')}
              className={`px-3 py-1 text-xs font-medium ${
                viewMode === 'manage'
                  ? 'bg-[#8B6914] text-white'
                  : 'text-[#8B6914] hover:bg-[#F5EACB]'
              }`}
            >
              Manage
            </button>
            <button
              onClick={() => setViewMode('activity')}
              className={`px-3 py-1 text-xs font-medium ${
                viewMode === 'activity'
                  ? 'bg-[#8B6914] text-white'
                  : 'text-[#8B6914] hover:bg-[#F5EACB]'
              }`}
            >
              Activity
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportDecorations}
            disabled={exportingDecorations}
            className="rounded border border-[#8B6914]/30 px-3 py-1.5 text-sm font-medium text-[#8B6914] hover:bg-[#F5EACB] disabled:opacity-50"
          >
            {exportingDecorations ? 'Exporting...' : 'Export Decorations CSV'}
          </button>
          <button
            onClick={() => setShowQRPanel((v) => !v)}
            className={`rounded border px-3 py-1.5 text-sm font-medium ${
              showQRPanel
                ? 'border-[#8B6914] bg-[#D4A843]/20 text-[#8B6914]'
                : 'border-[#8B6914]/30 text-[#8B6914] hover:bg-[#F5EACB]'
            }`}
          >
            QR Codes
          </button>
          <button
            onClick={openCreate}
            className="rounded bg-[#8B6914] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6B5210]"
          >
            + New Space
          </button>
        </div>
      </div>

      {/* ── Activity summary cards (when in activity mode) ── */}
      {viewMode === 'activity' && spacesAnalytics && (
        <SpaceActivitySummary analytics={spacesAnalytics} />
      )}

    <div className="flex flex-1 gap-4 overflow-hidden">
      {/* ── Left panel: space list + form ── */}
      <div className="flex w-1/3 min-w-[320px] flex-col">

        {notification && (
          <div
            className={`mb-3 rounded px-3 py-2 text-sm font-medium ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Space list */}
        <div className="flex-1 space-y-1 overflow-y-auto">
          {sortedSpaces.map((space) => (
            <SpaceListItem
              key={space.spaceId}
              space={space}
              isSelected={selectedSpaceId === space.spaceId}
              viewMode={viewMode}
              onClick={() => setSelectedSpaceId(space.spaceId)}
              onEdit={(e) => {
                e.stopPropagation();
                openEdit(space);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                setDeleteTarget(space);
              }}
              onToggleActive={(active) =>
                toggleActiveMut.mutate({ spaceId: space.spaceId, active })
              }
            />
          ))}
          {sortedSpaces.length === 0 && (
            <p className="py-8 text-center text-sm text-[#3D2B1F]/50">
              No spaces yet. Click "+ New Space" to start.
            </p>
          )}
        </div>

        {/* Form panel */}
        {isFormOpen && (
          <div className="mt-3 space-y-3 rounded-lg border border-[#8B6914]/20 bg-white p-4">
            <h3 className="text-sm font-bold text-[#3D2B1F]">
              {editingSpace ? `Edit: ${editingSpace.name}` : 'New Space'}
            </h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">GPS Lat</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.gpsLat}
                  readOnly={!!mapConfig?.transformMatrix}
                  onChange={(e) => setForm((f) => ({ ...f, gpsLat: parseFloat(e.target.value) || 0 }))}
                  className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${
                    mapConfig?.transformMatrix
                      ? 'border-[#8B6914]/15 bg-[#F5EACB] text-[#3D2B1F]/60 cursor-default'
                      : 'border-[#8B6914]/30 bg-white text-[#3D2B1F] focus:border-[#D4A843]'
                  }`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">GPS Lng</label>
                <input
                  type="number"
                  step="0.000001"
                  value={form.gpsLng}
                  readOnly={!!mapConfig?.transformMatrix}
                  onChange={(e) => setForm((f) => ({ ...f, gpsLng: parseFloat(e.target.value) || 0 }))}
                  className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${
                    mapConfig?.transformMatrix
                      ? 'border-[#8B6914]/15 bg-[#F5EACB] text-[#3D2B1F]/60 cursor-default'
                      : 'border-[#8B6914]/30 bg-white text-[#3D2B1F] focus:border-[#D4A843]'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                  Geofence (m)
                </label>
                <input
                  type="number"
                  value={form.geofenceRadius}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, geofenceRadius: parseInt(e.target.value) || 15 }))
                  }
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                  Map Pixel ({form.mapPixelX}, {form.mapPixelY})
                </label>
                <div className="rounded bg-[#F5EACB] px-3 py-2 text-xs text-[#3D2B1F]/60">
                  Auto-calculated from polygon center
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>

            {polygon.cells.length > 0 && (
              <div className="rounded bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                {polygon.cells.length} grid cells in polygon
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
                className="rounded bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B5210] disabled:opacity-50"
              >
                {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={closeForm}
                className="rounded border border-[#8B6914]/30 px-4 py-2 text-sm text-[#3D2B1F] hover:bg-[#F5EACB]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: QR codes panel OR campus map ── */}
      <div className="flex flex-1 flex-col">
        {showQRPanel ? (
          <div className="flex-1 overflow-y-auto rounded-lg border border-[#8B6914]/20 bg-white p-4">
            <SpaceQRPanel />
          </div>
        ) : mapConfig?.mapImageUrl ? (
          <div className="relative flex-1 overflow-hidden rounded-lg border border-[#8B6914]/20">
            <MapWithOverlays
              mapConfig={mapConfig}
              spaces={savedPolygonOverlays}
              editingPolygon={isFormOpen ? polygon : null}
              onEditingPolygonChange={isFormOpen ? handlePolygonChange : undefined}
              selectedSpaceId={selectedSpaceId}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-[#8B6914]/20 bg-white">
            <p className="text-sm text-[#3D2B1F]/50">
              No campus map uploaded. Upload one in Map Calibration first.
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.spaceId);
        }}
        title="Delete Space"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
    </div>
  );
}

// ── Space Activity Summary ────────────────────────────────

function SpaceActivitySummary({ analytics }: { analytics: import('@/types').AnalyticsSpacesData }) {
  const { totals, clanLeaderboard, sentimentBreakdown } = analytics;
  const sentTotal = sentimentBreakdown.overall.yes + sentimentBreakdown.overall.maybe + sentimentBreakdown.overall.no;

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded border border-[#8B6914]/20 bg-white p-3">
          <div className="text-xs font-medium uppercase text-[#3D2B1F]/50">Total Decorations</div>
          <div className="text-xl font-bold text-[#3D2B1F]">{totals.totalDecorations}</div>
        </div>
        <div className="rounded border border-[#8B6914]/20 bg-white p-3">
          <div className="text-xs font-medium uppercase text-[#3D2B1F]/50">Space XP</div>
          <div className="text-xl font-bold text-[#3D2B1F]">{totals.totalSpaceXp}</div>
        </div>
        <div className="rounded border border-[#8B6914]/20 bg-white p-3">
          <div className="text-xs font-medium uppercase text-[#3D2B1F]/50">Minigame XP</div>
          <div className="text-xl font-bold text-[#3D2B1F]">{totals.totalMinigameXp}</div>
        </div>
        <div className="rounded border border-[#8B6914]/20 bg-white p-3">
          <div className="text-xs font-medium uppercase text-[#3D2B1F]/50">Unique Decorators</div>
          <div className="text-xl font-bold text-[#3D2B1F]">{totals.uniqueDecorators}</div>
        </div>
        <div className="rounded border border-[#8B6914]/20 bg-white p-3">
          <div className="text-xs font-medium uppercase text-[#3D2B1F]/50">Sentiment</div>
          <div className="text-xl font-bold text-green-600">
            {sentTotal > 0 ? `${Math.round((sentimentBreakdown.overall.yes / sentTotal) * 100)}%` : '—'}{' '}
            <span className="text-xs font-normal text-[#3D2B1F]/50">positive</span>
          </div>
        </div>
      </div>

      {/* Clan breakdown row */}
      <div className="grid grid-cols-5 gap-2">
        {clanLeaderboard.map((clan) => (
          <div
            key={clan.clanId}
            className="rounded border bg-white px-3 py-2"
            style={{ borderColor: CLAN_COLORS[clan.clanId] + '40' }}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CLAN_COLORS[clan.clanId] }}
              />
              <span className="text-xs font-bold text-[#3D2B1F]">{CLAN_LABELS[clan.clanId] ?? clan.clanId}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-[10px] text-[#3D2B1F]/70">
              <div>XP: <span className="font-bold">{clan.totalXp}</span></div>
              <div>Dec: <span className="font-bold">{clan.spacesDecorated}</span></div>
              <div>Users: <span className="font-bold">{clan.activeUsers}</span></div>
              <div>Rate: <span className="font-bold">{Math.round(clan.assignmentCompletionRate * 100)}%</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Space List Item ──────────────────────────────────────

function SpaceListItem({
  space,
  isSelected,
  viewMode,
  onClick,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  space: Space;
  isSelected: boolean;
  viewMode: ViewMode;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleActive: (active: boolean) => void;
}) {
  // Fetch decoration data for this space when in activity mode
  const { data: decorations } = useQuery({
    queryKey: ['space-decorations', space.spaceId],
    queryFn: () => getSpaceDecorations(space.spaceId),
    enabled: viewMode === 'activity',
    staleTime: 60 * 1000,
  });

  const stats = useMemo(() => {
    if (!decorations || decorations.length === 0) return null;
    const uniqueUsers = new Set(decorations.map((d) => d.userId)).size;
    const sentYes = decorations.filter((d) => d.survey?.wouldVisitMore === 'yes').length;
    const sentTotal = decorations.filter((d) => d.survey?.wouldVisitMore).length;
    const totalXp = decorations.reduce((s, d) => s + d.xpAwarded, 0);
    const clanCounts: Record<string, number> = {};
    for (const d of decorations) {
      clanCounts[d.clan] = (clanCounts[d.clan] || 0) + 1;
    }
    return { count: decorations.length, uniqueUsers, sentYes, sentTotal, totalXp, clanCounts };
  }, [decorations]);

  return (
    <div
      className={`rounded border px-3 py-2 text-sm ${
        isSelected
          ? 'border-[#8B6914] bg-[#D4A843]/20'
          : 'border-[#8B6914]/15 bg-white hover:bg-[#F5EACB]/60'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-[#3D2B1F]">{space.name}</div>
          <div className="text-xs text-[#3D2B1F]/50">
            QR #{space.qrNumber} &middot; {space.gridCells.length} cells
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Toggle checked={space.active} onChange={onToggleActive} />
          <button onClick={onEdit} className="rounded border border-[#8B6914]/30 px-2 py-0.5 text-xs text-[#8B6914] hover:bg-[#F5EACB]">
            Edit
          </button>
          <button onClick={onDelete} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">
            Del
          </button>
        </div>
      </div>

      {/* Activity stats (when in activity mode) */}
      {viewMode === 'activity' && stats && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#8B6914]/10 pt-2 text-[10px] text-[#3D2B1F]/70">
          <span>{stats.count} submissions</span>
          <span>{stats.uniqueUsers} decorators</span>
          <span>{stats.totalXp} XP</span>
          {stats.sentTotal > 0 && (
            <span className="text-green-600">
              {Math.round((stats.sentYes / stats.sentTotal) * 100)}% positive
            </span>
          )}
          <div className="flex gap-1">
            {Object.entries(stats.clanCounts).map(([clan, count]) => (
              <span
                key={clan}
                className="rounded px-1 py-0.5 text-white"
                style={{ backgroundColor: CLAN_COLORS[clan] ?? '#888', fontSize: '9px' }}
              >
                {count}
              </span>
            ))}
          </div>
        </div>
      )}
      {viewMode === 'activity' && !stats && decorations !== undefined && (
        <div className="mt-2 border-t border-[#8B6914]/10 pt-2 text-[10px] text-[#3D2B1F]/30">
          No decorations yet
        </div>
      )}
    </div>
  );
}

// ── Space QR Code Panel ─────────────────────────────────

function downloadSpacePng(base64: string, spaceName: string) {
  const a = document.createElement('a');
  a.href = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  a.download = `SpaceQR-${spaceName.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
  a.click();
}

function SpaceQRPanel() {
  const queryClient = useQueryClient();
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const { data: qrCodes, isLoading, error: queryError } = useQuery({
    queryKey: ['space-qrs'],
    queryFn: getSpaceQRCodes,
  });

  const generateMut = useMutation({
    mutationFn: getSpaceQRCodes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-qrs'] });
    },
  });

  const codes = qrCodes ?? [];
  const newCount = codes.filter((q) => !q.alreadyExisted).length;
  const existingCount = codes.filter((q) => q.alreadyExisted).length;

  const handleDownloadPdf = useCallback(async () => {
    if (!codes.length) return;
    setPdfGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      for (let i = 0; i < codes.length; i++) {
        if (i > 0) doc.addPage();
        const qr = codes[i];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(qr.spaceName, pageW / 2, 25, { align: 'center' });

        const imgSize = 150;
        const imgX = (pageW - imgSize) / 2;
        const imgY = 40;
        if (qr.qrImageBase64) {
          let b64 = qr.qrImageBase64;
          if (b64.startsWith('data:')) b64 = b64.split(',')[1];
          doc.addImage(b64, 'PNG', imgX, imgY, imgSize, imgSize);
        }

        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        const payloadY = imgY + imgSize + 8;
        const maxTextW = pageW - 30;
        const lines = doc.splitTextToSize(qr.qrPayload, maxTextW);
        doc.text(lines, pageW / 2, payloadY, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('GroveWars — Permanent Space QR', pageW / 2, pageH - 15, { align: 'center' });
      }
      doc.save('GroveWars-Space-QR.pdf');
    } finally {
      setPdfGenerating(false);
    }
  }, [codes]);

  return (
    <div>
      {codes.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="rounded bg-[#8B6914] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {generateMut.isPending ? 'Generating...' : 'Generate All Space QRs'}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex items-center gap-2 rounded bg-[#27AE60] px-4 py-2 text-sm font-semibold text-white hover:bg-[#219A52] disabled:opacity-50"
          >
            {pdfGenerating && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {pdfGenerating ? 'Generating PDF...' : 'Download All PDF'}
          </button>
        </div>
      )}

      <p className="mb-4 text-xs text-[#3D2B1F]/50">
        Permanent QRs never expire. Each space gets its own secret. Only generates for spaces that don't have one yet.
      </p>

      {isLoading && <LoadingSpinner />}
      {queryError && (
        <ErrorAlert message={queryError instanceof Error ? queryError.message : 'Failed to load space QRs'} />
      )}

      {!isLoading && !queryError && codes.length === 0 && (
        <div className="rounded border border-[#D4A843]/30 bg-[#D4A843]/10 p-4 text-sm text-[#8B6914]">
          No active spaces found. Create and activate spaces before generating QR codes.
        </div>
      )}

      {codes.length > 0 && (
        <>
          <p className="mb-4 text-sm text-[#3D2B1F]/70">
            {codes.length} spaces — {existingCount} already had QRs{newCount > 0 ? `, ${newCount} newly generated` : ''}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {codes.map((qr) => (
              <div key={qr.spaceId} className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-[#3D2B1F]">{qr.spaceName}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      #{qr.qrNumber}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      qr.alreadyExisted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {qr.alreadyExisted ? 'Has QR' : 'New'}
                    </span>
                  </div>
                </div>

                {qr.qrImageBase64 ? (
                  <img
                    src={qr.qrImageBase64.startsWith('data:') ? qr.qrImageBase64 : `data:image/png;base64,${qr.qrImageBase64}`}
                    alt={`QR code for ${qr.spaceName}`}
                    className="mx-auto mb-2 h-48 w-48"
                  />
                ) : (
                  <div className="mx-auto mb-2 flex h-48 w-48 items-center justify-center rounded bg-[#F5EACB] text-center text-xs text-[#8B6914]">
                    QR generation failed
                  </div>
                )}

                {qr.qrGeneratedAt && (
                  <p className="mb-2 text-xs text-[#3D2B1F]/40">
                    Generated: {new Date(qr.qrGeneratedAt).toLocaleDateString()}
                  </p>
                )}

                <p className="mb-3 break-all text-xs text-[#3D2B1F]/40">{qr.qrPayload}</p>

                <div className="mb-2 flex gap-2">
                  {qr.qrImageBase64 && (
                    <button
                      onClick={() => downloadSpacePng(qr.qrImageBase64, qr.spaceName)}
                      className="flex-1 rounded border border-[#8B6914]/30 px-2 py-1 text-xs font-medium text-[#8B6914] hover:bg-[#F5EACB]"
                    >
                      Download PNG
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Map with saved polygon overlays + editable polygon ──

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function svgPath(pts: { x: number; y: number }[], scale: number): string {
  if (pts.length < 3) return '';
  return (
    `M ${pts[0].x * scale} ${pts[0].y * scale} ` +
    pts.slice(1).map((p) => `L ${p.x * scale} ${p.y * scale}`).join(' ') +
    ' Z'
  );
}

function MapWithOverlays({
  mapConfig,
  spaces,
  editingPolygon,
  onEditingPolygonChange,
  selectedSpaceId,
}: {
  mapConfig: MapConfig;
  spaces: Space[];
  editingPolygon: PolygonValue | null;
  onEditingPolygonChange?: (val: PolygonValue) => void;
  selectedSpaceId: string | null;
}) {
  // If we're editing a polygon, show the interactive editor
  if (editingPolygon && onEditingPolygonChange) {
    return (
      <div className="h-full overflow-auto">
        <MapPolygonEditor
          mapImageUrl={mapConfig.mapImageUrl}
          mapWidth={mapConfig.mapWidth}
          mapHeight={mapConfig.mapHeight}
          tileSize={TILE}
          value={editingPolygon}
          onChange={onEditingPolygonChange}
          overlayColor="#27AE60"
        />
      </div>
    );
  }

  // Read-only view of all spaces
  return (
    <ReadOnlyMapView
      mapConfig={mapConfig}
      spaces={spaces}
      selectedSpaceId={selectedSpaceId}
    />
  );
}

function ReadOnlyMapView({
  mapConfig,
  spaces,
  selectedSpaceId,
}: {
  mapConfig: MapConfig;
  spaces: Space[];
  selectedSpaceId: string | null;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const scale = containerWidth > 0 ? containerWidth / mapConfig.mapWidth : 1;
  const displayHeight = mapConfig.mapHeight * scale;

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {containerWidth > 0 && (
        <div className="relative" style={{ width: containerWidth, height: displayHeight }}>
          <img
            src={mapConfig.mapImageUrl}
            alt="Campus map"
            style={{ width: containerWidth, height: displayHeight, display: 'block' }}
            draggable={false}
          />
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: containerWidth,
              height: displayHeight,
              pointerEvents: 'none',
            }}
          >
            {spaces.map((space) => {
              const isSelected = space.spaceId === selectedSpaceId;
              const color = space.active ? '#27AE60' : '#888';
              return (
                <g key={space.spaceId}>
                  <path
                    d={svgPath(space.polygonPoints, scale)}
                    fill={hexToRgba(color, isSelected ? 0.35 : 0.15)}
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {/* Label at center */}
                  <text
                    x={space.mapPixelX * scale}
                    y={space.mapPixelY * scale}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={color}
                    fontSize={11}
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {space.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
