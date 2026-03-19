import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMasterLocations, updateMasterLocation, updateLocation } from '@/api/locations';
import { Toggle } from '@/components/Toggle';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import type { LocationMasterConfig, LocationClassification } from '@/types';

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
  allLocations,
  onClose,
  onSaved,
}: {
  location: LocationMasterConfig;
  allLocations: LocationMasterConfig[];
  onClose: () => void;
  onSaved: (type: 'success' | 'error', msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(location.name);
  const [gpsLat, setGpsLat] = useState(location.gpsLat);
  const [gpsLng, setGpsLng] = useState(location.gpsLng);
  const [geofenceRadius, setGeofenceRadius] = useState(location.geofenceRadius);
  const [mapPixelX, setMapPixelX] = useState(location.mapPixelX);
  const [mapPixelY, setMapPixelY] = useState(location.mapPixelY);
  const [notes, setNotes] = useState(location.notes);
  const [firstVisitBonus, setFirstVisitBonus] = useState(location.firstVisitBonus);
  const [bonusXP, setBonusXP] = useState(location.bonusXP);
  const [coopOnly, setCoopOnly] = useState(location.coopOnly);
  const [chestDropModifier, setChestDropModifier] = useState(location.chestDropModifier);
  const [spaceFact, setSpaceFact] = useState(location.spaceFact ?? '');
  const [minigameAffinity, setMinigameAffinity] = useState<string[]>(
    location.minigameAffinity ?? [],
  );
  const [linkedTo, setLinkedTo] = useState(location.linkedTo ?? '');

  const saveMut = useMutation({
    mutationFn: async () => {
      await updateMasterLocation(location.locationId, {
        name,
        gpsLat,
        gpsLng,
        geofenceRadius,
        mapPixelX,
        mapPixelY,
        notes,
        firstVisitBonus,
        bonusXP,
        coopOnly,
        chestDropModifier,
        spaceFact: spaceFact || null,
        minigameAffinity: minigameAffinity.length > 0 ? minigameAffinity : null,
        linkedTo: linkedTo || null,
      } as Partial<LocationMasterConfig>);
      // Sync coopOnly to the game-flow locations table
      await updateLocation(location.locationId, { coopOnly });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      onSaved('success', 'Location updated.');
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

          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Linked Location</label>
            <select
              value={linkedTo}
              onChange={(e) => setLinkedTo(e.target.value)}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            >
              <option value="">None</option>
              {allLocations
                .filter((l) => l.locationId !== location.locationId)
                .map((l) => (
                  <option key={l.locationId} value={l.locationId}>
                    #{l.qrNumber} {l.name}
                  </option>
                ))}
            </select>
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

  const { data: locations, isLoading, error } = useQuery({
    queryKey: ['master-locations'],
    queryFn: getMasterLocations,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateMasterLocation(id, { active } as Partial<LocationMasterConfig>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-locations'] });
      notify('success', 'Location status updated.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

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

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* Left Panel */}
      <div className={`flex flex-col ${selected ? 'w-3/5' : 'w-full'}`}>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#3D2B1F]">Locations</h1>
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
            allLocations={locations}
            onClose={() => setSelectedId(null)}
            onSaved={notify}
          />
        </div>
      )}
    </div>
  );
}
