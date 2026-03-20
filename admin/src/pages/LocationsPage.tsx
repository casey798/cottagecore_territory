import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMasterLocations, createMasterLocation, updateMasterLocation, updateLocation, deleteMasterLocation, importPhase1Data } from '@/api/locations';
import { getMapConfig } from '@/api/map';
import { pixelToGps } from '@/utils/affineTransform';
import { MAP_WIDTH, MAP_HEIGHT } from '@/constants/map';
import { Toggle } from '@/components/Toggle';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import type { LocationMasterConfig, LocationClassification, AffineMatrix } from '@/types';

// ── Constants ────────────────────────────────────────────────────────

const CLASSIFICATION_BADGE: Record<
  LocationClassification,
  string
> = {
  'Social Hub': 'bg-green-100 text-green-800',
  'Transit / Forced Stay': 'bg-blue-100 text-blue-800',
  'Hidden Gem': 'bg-yellow-100 text-yellow-800',
  'Dead Zone': 'bg-red-100 text-red-800',
  Unvisited: 'bg-gray-100 text-gray-700',
  TBD: 'bg-purple-100 text-purple-800',
};

const PRIORITY_BADGE: Record<string, string> = {
  'P1-Critical': 'bg-red-100 text-red-700',
  'P1-Seed': 'bg-orange-100 text-orange-700',
  'P2-High': 'bg-yellow-100 text-yellow-700',
  'P3-Medium': 'bg-gray-100 text-gray-600',
};

const ALL_CLASSIFICATIONS: LocationClassification[] = [
  'Social Hub',
  'Transit / Forced Stay',
  'Hidden Gem',
  'Dead Zone',
  'Unvisited',
  'TBD',
];

type SortKey = 'qrNumber' | 'classification' | 'sdtDeficit' | 'lastActive';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'qrNumber', label: 'QR Number' },
  { value: 'classification', label: 'Classification' },
  { value: 'sdtDeficit', label: 'SDT Deficit (High\u2192Low)' },
  { value: 'lastActive', label: 'Last Active' },
];

const MINIGAMES = [
  { id: 'bloom-sequence', name: 'Bloom Sequence' },
  { id: 'cipher-stones', name: 'Cipher Stones' },
  { id: 'firefly-flow', name: 'Firefly Flow' },
  { id: 'grove-equations', name: 'Grove Equations' },
  { id: 'grove-words', name: 'Grove Words' },
  { id: 'kindred', name: 'Kindred' },
  { id: 'leaf-sort', name: 'Leaf Sort' },
  { id: 'mosaic', name: 'Mosaic' },
  { id: 'number-grove', name: 'Number Grove' },
  { id: 'path-weaver', name: 'Path Weaver' },
  { id: 'pips', name: 'Pips' },
  { id: 'potion-logic', name: 'Potion Logic' },
  { id: 'shift-slide', name: 'Shift Slide' },
  { id: 'stone-pairs', name: 'Stone Pairs' },
  { id: 'vine-trail', name: 'Vine Trail' },
];

// ── Notification hook ────────────────────────────────────────────────

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

// ── Edit Panel ───────────────────────────────────────────────────────

function EditPanel({
  location,
  onClose,
  onSaved,
  onDeleted,
  onMoveOnMap,
  onToggleActive,
}: {
  location: LocationMasterConfig;
  onClose: () => void;
  onSaved: (type: 'success' | 'error', msg: string) => void;
  onDeleted: () => void;
  onMoveOnMap?: () => void;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(location.name);
  const [gpsLat, setGpsLat] = useState(location.gpsLat);
  const [gpsLng, setGpsLng] = useState(location.gpsLng);
  const [geofenceRadius, setGeofenceRadius] = useState(location.geofenceRadius);
  const [mapPixelX, setMapPixelX] = useState(location.mapPixelX);
  const [mapPixelY, setMapPixelY] = useState(location.mapPixelY);
  const [formFloor, setFormFloor] = useState(location.floor);
  const [notes, setNotes] = useState(location.notes);
  const [firstVisitBonus, setFirstVisitBonus] = useState(location.firstVisitBonus);
  const [bonusXP, setBonusXP] = useState(location.bonusXP);
  const [coopOnly, setCoopOnly] = useState(location.coopOnly);
  const [chestDropModifier, setChestDropModifier] = useState(location.chestDropModifier);
  const [spaceFact, setSpaceFact] = useState(location.spaceFact ?? '');
  const [minigameAffinity, setMinigameAffinity] = useState<string[]>(
    location.minigameAffinity ?? [],
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Compute normalizedX/normalizedY from pixel coordinates
  const normalizedX = mapPixelX / MAP_WIDTH;
  const normalizedY = mapPixelY / MAP_HEIGHT;

  const saveMut = useMutation({
    mutationFn: async () => {
      await updateMasterLocation(location.locationId, {
        name,
        gpsLat,
        gpsLng,
        geofenceRadius,
        mapPixelX,
        mapPixelY,
        normalizedX,
        normalizedY,
        floor: formFloor,
        notes,
        firstVisitBonus,
        bonusXP,
        coopOnly,
        chestDropModifier,
        spaceFact: spaceFact || null,
        minigameAffinity: minigameAffinity.length > 0 ? minigameAffinity : null,
      } as Partial<LocationMasterConfig>);
      // Sync all shared fields to the legacy locations table
      await updateLocation(location.locationId, {
        name,
        gpsLat,
        gpsLng,
        geofenceRadius,
        chestDropModifier,
        notes,
        coopOnly,
        active: location.active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      onSaved('success', 'Location updated.');
    },
    onError: (err) => onSaved('error', (err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteMasterLocation(location.locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      onSaved('success', `${location.name} deleted.`);
      onDeleted();
    },
    onError: (err) => onSaved('error', (err as Error).message),
  });

  function toggleMinigame(id: string) {
    setMinigameAffinity((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#3D2B1F]">
          #{location.qrNumber} {location.name}
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-[#3D2B1F]/50 hover:text-[#3D2B1F]"
        >
          Close
        </button>
      </div>

      {/* Active toggle */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-[#8B6914]/15 bg-[#F5EACB]/40 p-3">
        <div className="text-sm font-medium text-[#3D2B1F]">Active</div>
        <Toggle
          checked={location.active}
          onChange={(active) => onToggleActive(location.locationId, active)}
        />
      </div>

      {/* Basic Info */}
      <section className="mb-5">
        <h3 className="mb-2 text-sm font-semibold text-[#8B6914]">Basic Info</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">GPS Lat</label>
              <input
                type="number"
                step="0.000001"
                value={gpsLat}
                onChange={(e) => setGpsLat(parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">GPS Lng</label>
              <input
                type="number"
                step="0.000001"
                value={gpsLng}
                onChange={(e) => setGpsLng(parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Geofence Radius (m)</label>
              <input
                type="number"
                min={5}
                max={100}
                value={geofenceRadius}
                onChange={(e) => setGeofenceRadius(parseInt(e.target.value) || 15)}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Floor</label>
              <select
                value={formFloor}
                onChange={(e) => setFormFloor(e.target.value)}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              >
                <option value="outdoor">Outdoor</option>
                <option value="ground">Ground</option>
                <option value="first">First</option>
                <option value="second">Second</option>
                <option value="third">Third</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Map Pixel X</label>
              <input
                type="number"
                step="0.1"
                value={mapPixelX}
                onChange={(e) => setMapPixelX(parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Map Pixel Y</label>
              <input
                type="number"
                step="0.1"
                value={mapPixelY}
                onChange={(e) => setMapPixelY(parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
          </div>
          {onMoveOnMap && (
            <button
              onClick={onMoveOnMap}
              className="rounded border border-[#8B6914]/30 px-3 py-1.5 text-xs font-medium text-[#8B6914] hover:bg-[#F5EACB]"
            >
              Move on Map
            </button>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Phase 1 Research Data */}
      <section className="mb-5 rounded-lg border border-[#8B6914]/15 bg-[#F5EACB]/60 p-3">
        <h3 className="mb-2 text-sm font-semibold text-[#8B6914]">Phase 1 Research Data</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#3D2B1F]">
          <div>Classification: <span className="font-medium">{location.classification}</span></div>
          <div>SDT Deficit: <span className="font-medium">{location.sdtDeficit}/9</span></div>
          <div>Priority: <span className="font-medium">{location.priorityTier ?? 'None'}</span></div>
          <div>Phase 1 Visits: <span className="font-medium">{location.phase1Visits}</span></div>
          <div>Satisfaction: <span className="font-medium">{location.phase1Satisfaction !== null ? `${(location.phase1Satisfaction * 100).toFixed(0)}%` : 'N/A'}</span></div>
          <div>Dominant Cluster: <span className="font-medium">{location.phase1DominantCluster ?? 'N/A'}</span></div>
        </div>
        {location.isNewSpace && (
          <div className="mt-2 rounded bg-[#D4A843]/20 px-2 py-1 text-xs font-medium text-[#8B6914]">
            New Space — No Phase 1 baseline
          </div>
        )}
      </section>

      {/* Mechanic Modifiers */}
      <section className="mb-5">
        <h3 className="mb-2 text-sm font-semibold text-[#8B6914]">Mechanic Modifiers</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#3D2B1F]">First Visit Bonus</div>
              <div className="text-xs text-[#3D2B1F]/50">Awards 50 XP for player's first win here</div>
            </div>
            <Toggle checked={firstVisitBonus} onChange={setFirstVisitBonus} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#3D2B1F]">Bonus XP</div>
              <div className="text-xs text-[#3D2B1F]/50">Awards 50 XP for ALL wins (Dead Zone Revival Events)</div>
            </div>
            <Toggle checked={bonusXP} onChange={setBonusXP} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[#3D2B1F]">Co-op Only</div>
              <div className="text-xs text-[#3D2B1F]/50">Only co-op minigames available at this location</div>
            </div>
            <Toggle checked={coopOnly} onChange={setCoopOnly} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
              Chest Drop Modifier: {chestDropModifier.toFixed(1)}x = {(15 * chestDropModifier).toFixed(1)}%
            </label>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={chestDropModifier}
              onChange={(e) => setChestDropModifier(parseFloat(e.target.value))}
              className="w-full accent-[#8B6914]"
            />
            <div className="flex justify-between text-xs text-[#3D2B1F]/40">
              <span>0.5x</span>
              <span>3.0x</span>
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-[#3D2B1F]">
              <span>Space Fact</span>
              <span className="text-[#3D2B1F]/40">{spaceFact.length}/200</span>
            </label>
            <textarea
              value={spaceFact}
              onChange={(e) => {
                if (e.target.value.length <= 200) setSpaceFact(e.target.value);
              }}
              maxLength={200}
              rows={2}
              placeholder="An interesting fact about this space..."
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Minigame Affinity</label>
            <div className="grid grid-cols-2 gap-1">
              {MINIGAMES.map((mg) => (
                <label
                  key={mg.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-[#F5EACB]"
                >
                  <input
                    type="checkbox"
                    checked={minigameAffinity.includes(mg.id)}
                    onChange={() => toggleMinigame(mg.id)}
                    className="accent-[#8B6914]"
                  />
                  {mg.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="w-full rounded bg-[#8B6914] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
      >
        {saveMut.isPending ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Delete Location */}
      <div className="mt-4 border-t border-[#8B6914]/10 pt-4">
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="w-full rounded bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete Location
          </button>
        ) : (
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <p className="mb-3 text-sm text-red-800">
              Delete {location.name}? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded bg-white px-3 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMut.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Classification dot colors for map ────────────────────────────────

const CLASSIFICATION_DOT: Record<string, string> = {
  'Social Hub': '#2980B9',
  'Transit / Forced Stay': '#95A5A6',
  'Hidden Gem': '#D4A843',
  'Dead Zone': '#C0392B',
  'Unvisited': '#7D3C98',
  'TBD': '#8B6914',
};

// ── Map Placement Mode ──────────────────────────────────────────────

function MapPlacementMode({
  locations,
  onExit,
  onCreated,
  moveTarget,
  onMoved,
}: {
  locations: LocationMasterConfig[];
  onExit: () => void;
  onCreated: (type: 'success' | 'error', msg: string) => void;
  moveTarget?: LocationMasterConfig | null;
  onMoved?: () => void;
}) {
  const queryClient = useQueryClient();
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [pendingPin, setPendingPin] = useState<{ px: number; py: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ px: number; py: number } | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  // Form state
  const [formName, setFormName] = useState('');
  const [formQrNumber, setFormQrNumber] = useState(() => {
    const maxQr = locations.reduce((max, l) => Math.max(max, l.qrNumber), 0);
    return maxQr + 1;
  });
  const [formFloor, setFormFloor] = useState('ground');
  const [formClassification, setFormClassification] = useState<LocationClassification>('TBD');
  const [formGeofenceRadius, setFormGeofenceRadius] = useState(15);
  const [formNotes, setFormNotes] = useState('');
  const [formSpaceFact, setFormSpaceFact] = useState('');
  const [formActive, setFormActive] = useState(true);

  const { data: mapConfig } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: getMapConfig,
    staleTime: 300_000,
  });

  const transform = mapConfig?.transformMatrix as AffineMatrix | undefined;

  const updateScale = useCallback(() => {
    if (imgRef.current) {
      setScaleFactor(MAP_WIDTH / imgRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  function handleMapClick(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const px = Math.round((e.clientX - rect.left) * scaleFactor);
    const py = Math.round((e.clientY - rect.top) * scaleFactor);

    if (moveTarget) {
      // Move mode — update position
      if (!transform) return;
      const gps = pixelToGps(px, py, transform);
      moveMut.mutate({ px, py, gps });
      return;
    }

    if (pendingPin) {
      // Already have a pin — warn
      return;
    }
    setPendingPin({ px, py });
    // Auto-suggest next QR
    const maxQr = locations.reduce((max, l) => Math.max(max, l.qrNumber), 0);
    setFormQrNumber(maxQr + 1);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const px = Math.round((e.clientX - rect.left) * scaleFactor);
    const py = Math.round((e.clientY - rect.top) * scaleFactor);
    setMousePos({ px, py });
  }

  function getDisplay(px: number, py: number) {
    return { x: px / scaleFactor, y: py / scaleFactor };
  }

  const gpsPreview = useMemo(() => {
    if (!mousePos || !transform) return null;
    return pixelToGps(mousePos.px, mousePos.py, transform);
  }, [mousePos, transform]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!pendingPin || !transform) throw new Error('No pin or transform');
      const gps = pixelToGps(pendingPin.px, pendingPin.py, transform);
      return createMasterLocation({
        name: formName.trim(),
        qrNumber: formQrNumber,
        mapPixelX: pendingPin.px,
        mapPixelY: pendingPin.py,
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        normalizedX: pendingPin.px / MAP_WIDTH,
        normalizedY: pendingPin.py / MAP_HEIGHT,
        geofenceRadius: formGeofenceRadius,
        floor: formFloor,
        classification: formClassification,
        active: formActive,
        isNewSpace: true,
        notes: formNotes,
        spaceFact: formSpaceFact || null,
      } as Partial<LocationMasterConfig>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      onCreated('success', `Location #${formQrNumber} '${formName}' created`);
      setPendingPin(null);
      setFormName('');
      setFormNotes('');
      setFormSpaceFact('');
      setFormQrNumber((prev) => prev + 1);
      setAddedCount((c) => c + 1);
    },
    onError: (err) => onCreated('error', (err as Error).message),
  });

  const moveMut = useMutation({
    mutationFn: async ({ px, py, gps }: { px: number; py: number; gps: { lat: number; lng: number } }) => {
      if (!moveTarget) throw new Error('No move target');
      await updateMasterLocation(moveTarget.locationId, {
        mapPixelX: px,
        mapPixelY: py,
        gpsLat: gps.lat,
        gpsLng: gps.lng,
        normalizedX: px / MAP_WIDTH,
        normalizedY: py / MAP_HEIGHT,
      } as Partial<LocationMasterConfig>);
      // Sync GPS to legacy locations table (scanQR reads geofence from here)
      await updateLocation(moveTarget.locationId, { gpsLat: gps.lat, gpsLng: gps.lng });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      onCreated('success', `${moveTarget!.name} moved successfully`);
      onMoved?.();
    },
    onError: (err) => onCreated('error', (err as Error).message),
  });

  const canSave = formName.trim().length > 0 && formQrNumber > 0;

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Map area */}
      <div className="flex flex-1 flex-col" ref={containerRef}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-[#3D2B1F]">
              {moveTarget ? `Move: ${moveTarget.name}` : 'Map Placement Mode'}
            </h2>
            {!moveTarget && (
              <span className="text-sm text-[#3D2B1F]/50">
                {locations.length + addedCount} locations total
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!moveTarget && (
              <label className="flex items-center gap-1.5 text-xs text-[#3D2B1F]">
                <input
                  type="checkbox"
                  checked={quickMode}
                  onChange={(e) => setQuickMode(e.target.checked)}
                  className="accent-[#8B6914]"
                />
                Quick Add
              </label>
            )}
            <button
              onClick={onExit}
              className="rounded bg-[#F5EACB] px-3 py-1.5 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8]"
            >
              {moveTarget ? 'Cancel Move' : 'Exit Map Mode'}
            </button>
          </div>
        </div>

        {/* Coordinate readout */}
        {mousePos && (
          <div className="mb-1 flex gap-4 text-xs text-[#3D2B1F]/50">
            <span>Pixel: ({mousePos.px}, {mousePos.py})</span>
            {gpsPreview && (
              <span>GPS: ({gpsPreview.lat.toFixed(6)}, {gpsPreview.lng.toFixed(6)})</span>
            )}
          </div>
        )}

        <div className="relative flex-1 overflow-auto rounded border border-[#8B6914]/20 bg-white">
          {mapConfig?.mapImageUrl ? (
            <div className="relative inline-block">
              <img
                ref={imgRef}
                src={mapConfig.mapImageUrl}
                alt="Campus map"
                className="max-w-none"
                style={{ cursor: moveTarget ? 'crosshair' : pendingPin ? 'default' : 'crosshair' }}
                onClick={handleMapClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setMousePos(null)}
                onLoad={updateScale}
                draggable={false}
              />

              {/* Existing location dots */}
              {locations.map((loc) => {
                const d = getDisplay(loc.mapPixelX, loc.mapPixelY);
                const isMove = moveTarget?.locationId === loc.locationId;
                return (
                  <div
                    key={loc.locationId}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: d.x, top: d.y }}
                  >
                    <div
                      className="h-3 w-3 rounded-full border border-white shadow"
                      style={{
                        backgroundColor: isMove
                          ? '#C0392B'
                          : loc.active
                          ? (CLASSIFICATION_DOT[loc.classification] ?? '#27AE60')
                          : '#BDC3C7',
                        opacity: isMove ? 1 : loc.active ? 0.9 : 0.4,
                      }}
                    />
                    <div className="pointer-events-none absolute left-1/2 top-4 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-xs text-white group-hover:block">
                      #{loc.qrNumber} {loc.name}
                    </div>
                  </div>
                );
              })}

              {/* Ghost pin following mouse */}
              {!pendingPin && mousePos && !moveTarget && (
                <div
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: mousePos.px / scaleFactor, top: mousePos.py / scaleFactor }}
                >
                  <div className="h-5 w-3 rounded-t-full bg-[#C0392B]/40" />
                </div>
              )}

              {/* Pending pin */}
              {pendingPin && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: getDisplay(pendingPin.px, pendingPin.py).x, top: getDisplay(pendingPin.px, pendingPin.py).y }}
                >
                  <div className="h-4 w-4 animate-pulse rounded-full border-2 border-white bg-[#C0392B] shadow-lg" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-[#3D2B1F]/40">
              No map configured. Go to Map Calibration first.
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Create form */}
      {pendingPin && !moveTarget && (
        <div className="w-80 shrink-0 overflow-y-auto rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-lg font-bold text-[#3D2B1F]">New Location</h3>

          {/* Auto-filled coords */}
          <div className="mb-3 rounded bg-[#F5EACB]/60 p-2 text-xs text-[#3D2B1F]/60">
            <div>Pixel: ({pendingPin.px}, {pendingPin.py})</div>
            {transform && (() => {
              const gps = pixelToGps(pendingPin.px, pendingPin.py, transform);
              return <div>GPS: ({gps.lat.toFixed(6)}, {gps.lng.toFixed(6)})</div>;
            })()}
            <div>Normalized: ({(pendingPin.px / MAP_WIDTH).toFixed(4)}, {(pendingPin.py / MAP_HEIGHT).toFixed(4)})</div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Name *</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. North Courtyard"
                className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">QR #</label>
                <input
                  type="number"
                  value={formQrNumber}
                  onChange={(e) => setFormQrNumber(parseInt(e.target.value) || 1)}
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Classification</label>
                <select
                  value={formClassification}
                  onChange={(e) => setFormClassification(e.target.value as LocationClassification)}
                  className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                >
                  {ALL_CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {!quickMode && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Floor</label>
                    <select
                      value={formFloor}
                      onChange={(e) => setFormFloor(e.target.value)}
                      className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                    >
                      <option value="outdoor">Outdoor</option>
                      <option value="ground">Ground</option>
                      <option value="first">First</option>
                      <option value="second">Second</option>
                      <option value="third">Third</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Geofence (m)</label>
                    <input
                      type="number"
                      value={formGeofenceRadius}
                      onChange={(e) => setFormGeofenceRadius(parseInt(e.target.value) || 15)}
                      min={5}
                      max={100}
                      className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Space Fact</label>
                  <input
                    value={formSpaceFact}
                    onChange={(e) => setFormSpaceFact(e.target.value)}
                    placeholder="Fun fact about this space..."
                    className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Notes</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-[#3D2B1F]">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="accent-[#8B6914]"
                  />
                  Active
                </label>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPendingPin(null)}
              className="flex-1 rounded bg-[#F5EACB] px-3 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8]"
            >
              Cancel
            </button>
            <button
              onClick={() => createMut.mutate()}
              disabled={!canSave || createMut.isPending}
              className="flex-1 rounded bg-[#8B6914] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
            >
              {createMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Move mode info */}
      {moveTarget && (
        <div className="w-64 shrink-0 rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">Move Location</h3>
          <p className="mb-3 text-sm text-[#3D2B1F]/70">
            Click on the map to set the new position for <strong>{moveTarget.name}</strong>.
          </p>
          <div className="text-xs text-[#3D2B1F]/50">
            <div>Current: ({moveTarget.mapPixelX}, {moveTarget.mapPixelY})</div>
          </div>
          {moveMut.isPending && <LoadingSpinner />}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('qrNumber');
  const [search, setSearch] = useState('');
  const [classFilters, setClassFilters] = useState<Set<LocationClassification>>(
    new Set(ALL_CLASSIFICATIONS),
  );
  const [showInactive, setShowInactive] = useState(true);
  const { notification, notify } = useNotification();
  const [mapMode, setMapMode] = useState(false);
  const [moveTarget, setMoveTarget] = useState<LocationMasterConfig | null>(null);
  const phase1FileRef = useRef<HTMLInputElement>(null);

  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['master-locations'],
    queryFn: getMasterLocations,
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await updateMasterLocation(id, { active } as Partial<LocationMasterConfig>);
      await updateLocation(id, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      notify('success', 'Location status updated.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  const phase1ImportMut = useMutation({
    mutationFn: importPhase1Data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      notify('success', `Updated ${result.updated} locations, skipped ${result.skipped}`);
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  function handleExportCsv() {
    if (!locations || locations.length === 0) return;
    const fields: (keyof LocationMasterConfig)[] = [
      'locationId', 'qrNumber', 'name', 'gpsLat', 'gpsLng', 'geofenceRadius',
      'mapPixelX', 'mapPixelY', 'normalizedX', 'normalizedY', 'floor',
      'classification', 'sdtDeficit', 'priorityTier', 'phase1Visits',
      'phase1Satisfaction', 'phase1DominantCluster', 'isNewSpace', 'active',
      'chestDropModifier', 'firstVisitBonus', 'coopOnly', 'bonusXP', 'spaceFact',
      'minigameAffinity', 'notes', 'lastActiveDate', 'totalPhase2GameSessions',
      'totalPhase2FreeRoamCheckins', 'avgPhase2Satisfaction', 'last3DaysVisits',
    ];
    const header = fields.join(',');
    const rows = locations.map((loc) =>
      fields.map((f) => {
        const val = loc[f];
        if (val === null || val === undefined) return '';
        if (f === 'last3DaysVisits' && Array.isArray(val)) return `"${(val as number[]).join('|')}"`;
        if (f === 'minigameAffinity' && Array.isArray(val)) return `"${(val as string[]).join('|')}"`;
        if (typeof val === 'boolean') return String(val);
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        return String(val);
      }).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locations-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePhase1Import(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        phase1ImportMut.mutate(parsed);
      } catch {
        notify('error', 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  function toggleClassFilter(c: LocationClassification) {
    setClassFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!locations) return [];
    let list = locations.filter((l) => {
      if (!classFilters.has(l.classification)) return false;
      if (!showInactive && !l.active) return false;
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'qrNumber':
          return a.qrNumber - b.qrNumber;
        case 'classification':
          return a.classification.localeCompare(b.classification);
        case 'sdtDeficit':
          return b.sdtDeficit - a.sdtDeficit;
        case 'lastActive':
          return (b.lastActiveDate ?? '').localeCompare(a.lastActiveDate ?? '');
        default:
          return 0;
      }
    });
    return list;
  }, [locations, classFilters, showInactive, search, sortKey]);

  const selected = locations?.find((l) => l.locationId === selectedId) ?? null;

  // Map placement mode
  if ((mapMode || moveTarget) && locations) {
    return (
      <>
        {notification && (
          <div
            className={`mb-3 rounded p-2 text-sm ${
              notification.type === 'success'
                ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                : 'border border-red-300 bg-red-50 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}
        <MapPlacementMode
          locations={locations}
          onExit={() => { setMapMode(false); setMoveTarget(null); }}
          onCreated={notify}
          moveTarget={moveTarget}
          onMoved={() => setMoveTarget(null)}
        />
      </>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Left Panel */}
      <div className={`flex flex-col ${selected ? 'w-3/5' : 'w-full'}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#3D2B1F]">Locations</h1>
            <button
              onClick={() => { setMapMode(true); setSelectedId(null); }}
              className="rounded bg-[#27AE60] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#219A52]"
            >
              + Add on Map
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!locations || locations.length === 0}
              className="rounded border border-[#8B6914]/30 px-3 py-1.5 text-sm font-medium text-[#8B6914] hover:bg-[#F5EACB] disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => phase1FileRef.current?.click()}
              disabled={phase1ImportMut.isPending}
              className="rounded border border-[#8B6914]/30 px-3 py-1.5 text-sm font-medium text-[#8B6914] hover:bg-[#F5EACB] disabled:opacity-50"
            >
              {phase1ImportMut.isPending ? 'Importing...' : 'Import Phase 1 Data'}
            </button>
            <input
              ref={phase1FileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handlePhase1Import}
            />
          </div>
          <span className="text-sm text-[#3D2B1F]/50">
            {filtered.length}/{locations?.length ?? 0} shown
          </span>
        </div>

        {notification && (
          <div
            className={`mb-3 rounded p-2 text-sm ${
              notification.type === 'success'
                ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
                : 'border border-red-300 bg-red-50 text-red-800'
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-3 space-y-2 rounded-lg border border-[#8B6914]/20 bg-white p-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-48 rounded border border-[#8B6914]/30 bg-white px-3 py-1.5 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-[#8B6914]/30 bg-white px-3 py-1.5 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-[#3D2B1F]">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="accent-[#8B6914]"
              />
              Show inactive
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CLASSIFICATIONS.map((c) => (
              <button
                key={c}
                onClick={() => toggleClassFilter(c)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  classFilters.has(c)
                    ? CLASSIFICATION_BADGE[c]
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <LoadingSpinner />}
        {error && <ErrorAlert message={(error as Error).message} />}

        {/* Location List */}
        <div className="flex-1 space-y-1 overflow-y-auto">
          {filtered.map((loc) => (
            <div
              key={loc.locationId}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:border-[#D4A843] ${
                selectedId === loc.locationId
                  ? 'border-[#8B6914] bg-[#D4A843]/10'
                  : 'border-[#8B6914]/10 bg-white'
              } ${!loc.active ? 'opacity-50' : ''}`}
              onClick={() => setSelectedId(loc.locationId)}
            >
              <span className="w-10 text-center text-lg font-bold text-[#8B6914]">
                #{loc.qrNumber}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-[#3D2B1F]">{loc.name}</span>
                  {loc.coopOnly && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Co-op
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASSIFICATION_BADGE[loc.classification]}`}
                  >
                    {loc.classification}
                  </span>
                  {loc.priorityTier && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[loc.priorityTier] ?? ''}`}
                    >
                      {loc.priorityTier}
                    </span>
                  )}
                  <span className="text-xs text-[#3D2B1F]/40">
                    SDT {loc.sdtDeficit}/9
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-[#3D2B1F]/50">
                {loc.isNewSpace ? (
                  <span className="rounded bg-[#D4A843]/20 px-1.5 py-0.5 text-xs font-medium text-[#8B6914]">
                    New
                  </span>
                ) : (
                  <>
                    <div>{loc.phase1Visits} visits</div>
                    {loc.phase1Satisfaction !== null && (
                      <div>{(loc.phase1Satisfaction * 100).toFixed(0)}% sat.</div>
                    )}
                  </>
                )}
              </div>
              <div
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Toggle
                  checked={loc.active}
                  onChange={(active) =>
                    toggleMut.mutate({ id: loc.locationId, active })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      {selected && locations && (
        <div className="w-2/5 rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <EditPanel
            key={selected.locationId}
            location={selected}
            onClose={() => setSelectedId(null)}
            onSaved={notify}
            onDeleted={() => setSelectedId(null)}
            onMoveOnMap={() => {
              setMoveTarget(selected);
              setSelectedId(null);
            }}
            onToggleActive={(id, active) => toggleMut.mutate({ id, active })}
          />
        </div>
      )}
    </div>
  );
}
