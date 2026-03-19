import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClusterWeights, updateClusterWeights, getMasterLocations } from '@/api/locations';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import type { ClusterWeights, Phase1Cluster, LocationMasterConfig } from '@/types';

// ── Constants ────────────────────────────────────────────────────────

const CLUSTERS: Array<{ key: Phase1Cluster | 'null'; label: string }> = [
  { key: 'nomad', label: 'Nomad' },
  { key: 'seeker', label: 'Seeker' },
  { key: 'drifter', label: 'Drifter' },
  { key: 'forced', label: 'Forced' },
  { key: 'disengaged', label: 'Disengaged' },
  { key: 'null', label: 'New User' },
];

const PLAYER_CLUSTERS: Phase1Cluster[] = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged'];

const CLASSIFICATIONS: (keyof ClusterWeights)[] = [
  'Social Hub',
  'Transit / Forced Stay',
  'Hidden Gem',
  'Dead Zone',
  'Unvisited',
];

const DEFAULT_WEIGHTS: Record<string, Record<string, number>> = {
  nomad:      { 'Social Hub': 0.5, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 3.0, 'Dead Zone': 3.0, 'Unvisited': 5.0 },
  seeker:     { 'Social Hub': 3.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 0.5, 'Unvisited': 1.0 },
  drifter:    { 'Social Hub': 2.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.5, 'Dead Zone': 0.5, 'Unvisited': 1.0 },
  forced:     { 'Social Hub': 1.5, 'Transit / Forced Stay': 1.5, 'Hidden Gem': 2.0, 'Dead Zone': 1.0, 'Unvisited': 0.5 },
  disengaged: { 'Social Hub': 2.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 0.3, 'Unvisited': 0.3 },
  null:       { 'Social Hub': 1.0, 'Transit / Forced Stay': 1.0, 'Hidden Gem': 1.0, 'Dead Zone': 1.0, 'Unvisited': 1.0 },
};

const DEFAULT_COUNTS: Record<string, number> = {
  nomad: 5, seeker: 4, drifter: 4, forced: 4, disengaged: 3, null: 4,
};

// ── Page ─────────────────────────────────────────────────────────────

export function ClusterConfigPage() {
  const queryClient = useQueryClient();

  const [weights, setWeights] = useState<Record<string, Record<string, number>>>(DEFAULT_WEIGHTS);
  const [counts, setCounts] = useState<Record<string, number>>(DEFAULT_COUNTS);
  const [badPairings, setBadPairings] = useState<Record<string, number[]>>({
    nomad: [], seeker: [], drifter: [], forced: [], disengaged: [],
  });

  // Add pairing form state
  const [addCluster, setAddCluster] = useState<Phase1Cluster>('nomad');
  const [addQr, setAddQr] = useState<number>(0);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['cluster-weights'],
    queryFn: getClusterWeights,
  });

  const { data: masterLocations } = useQuery({
    queryKey: ['master-locations'],
    queryFn: getMasterLocations,
  });

  // Build qr→locationId and locationId→qr maps
  const locByQr = new Map<number, LocationMasterConfig>();
  const locById = new Map<string, LocationMasterConfig>();
  for (const l of masterLocations ?? []) {
    locByQr.set(l.qrNumber, l);
    locById.set(l.locationId, l);
  }

  // Hydrate from server data
  useEffect(() => {
    if (!config) return;
    const w: Record<string, Record<string, number>> = {};
    for (const cluster of CLUSTERS) {
      w[cluster.key] = { ...config.weights[cluster.key] };
    }
    setWeights(w);
    setCounts({ ...config.assignmentCounts });

    // Convert locationId[] back to qrNumber[] for editing
    const bp: Record<string, number[]> = {};
    for (const pc of PLAYER_CLUSTERS) {
      const locIds = config.badPairings[pc] ?? [];
      bp[pc] = locIds
        .map((id) => locById.get(id)?.qrNumber)
        .filter((n): n is number => n !== undefined);
    }
    setBadPairings(bp);
  }, [config, masterLocations]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateClusterWeights({
        weights,
        badPairings,
        assignmentCounts: counts,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster-weights'] });
      setNotification({ type: 'success', message: 'Cluster config saved.' });
      setTimeout(() => setNotification(null), 4000);
    },
    onError: (err) => {
      setNotification({ type: 'error', message: (err as Error).message });
      setTimeout(() => setNotification(null), 6000);
    },
  });

  function resetDefaults() {
    setWeights(JSON.parse(JSON.stringify(DEFAULT_WEIGHTS)));
    setCounts({ ...DEFAULT_COUNTS });
    setBadPairings({
      nomad: [], seeker: [], drifter: [], forced: [], disengaged: [],
    });
  }

  function setWeight(cluster: string, classification: string, value: number) {
    setWeights((prev) => ({
      ...prev,
      [cluster]: { ...prev[cluster], [classification]: value },
    }));
  }

  function setCount(cluster: string, value: number) {
    setCounts((prev) => ({ ...prev, [cluster]: value }));
  }

  function addBadPairing() {
    if (!addQr) return;
    setBadPairings((prev) => {
      const existing = prev[addCluster] ?? [];
      if (existing.includes(addQr)) return prev;
      return { ...prev, [addCluster]: [...existing, addQr] };
    });
    setAddQr(0);
  }

  function removeBadPairing(cluster: string, qr: number) {
    setBadPairings((prev) => ({
      ...prev,
      [cluster]: (prev[cluster] ?? []).filter((q) => q !== qr),
    }));
  }

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Cluster Configuration</h1>
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

      {/* Weights Table */}
      <div className="mb-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
          Cluster Assignment Weights
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#8B6914]/10">
                <th className="py-2 pr-3 text-left text-xs font-medium text-[#3D2B1F]/50">
                  Cluster
                </th>
                {CLASSIFICATIONS.map((c) => (
                  <th
                    key={c}
                    className="px-2 py-2 text-center text-xs font-medium text-[#3D2B1F]/50"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLUSTERS.map((cluster) => (
                <tr key={cluster.key} className="border-b border-[#8B6914]/5">
                  <td className="py-2 pr-3 font-medium text-[#3D2B1F]">
                    {cluster.label}
                  </td>
                  {CLASSIFICATIONS.map((cl) => (
                    <td key={cl} className="px-1 py-1.5 text-center">
                      <input
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={weights[cluster.key]?.[cl] ?? 1.0}
                        onChange={(e) =>
                          setWeight(
                            cluster.key,
                            cl,
                            parseFloat(e.target.value) || 0.1,
                          )
                        }
                        className="w-16 rounded border border-[#8B6914]/20 bg-white px-1.5 py-1 text-center text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Counts */}
      <div className="mb-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
          Assignment Count per Cluster
        </h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {CLUSTERS.map((cluster) => (
            <div key={cluster.key}>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                {cluster.label}
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={counts[cluster.key] ?? 4}
                onChange={(e) =>
                  setCount(cluster.key, parseInt(e.target.value) || 4)
                }
                className="w-full rounded border border-[#8B6914]/20 bg-white px-2 py-1.5 text-center text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bad Pairings */}
      <div className="mb-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Bad Pairings</h2>
        <div className="mb-3 space-y-1">
          {PLAYER_CLUSTERS.map((cluster) =>
            (badPairings[cluster] ?? []).map((qr) => {
              const loc = locByQr.get(qr);
              return (
                <div
                  key={`${cluster}-${qr}`}
                  className="flex items-center gap-2 rounded bg-[#F5EACB] px-3 py-1.5 text-sm"
                >
                  <span className="font-medium capitalize text-[#3D2B1F]">
                    {cluster}
                  </span>
                  <span className="text-[#3D2B1F]/40">&rarr;</span>
                  <span className="text-[#3D2B1F]">
                    #{qr} {loc?.name ?? 'Unknown'}
                  </span>
                  <button
                    onClick={() => removeBadPairing(cluster, qr)}
                    className="ml-auto text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              );
            }),
          )}
          {PLAYER_CLUSTERS.every((c) => (badPairings[c] ?? []).length === 0) && (
            <p className="text-sm text-[#3D2B1F]/40">No bad pairings configured.</p>
          )}
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
              Cluster
            </label>
            <select
              value={addCluster}
              onChange={(e) => setAddCluster(e.target.value as Phase1Cluster)}
              className="rounded border border-[#8B6914]/30 bg-white px-2 py-1.5 text-sm capitalize text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            >
              {PLAYER_CLUSTERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
              Location
            </label>
            <select
              value={addQr}
              onChange={(e) => setAddQr(parseInt(e.target.value) || 0)}
              className="rounded border border-[#8B6914]/30 bg-white px-2 py-1.5 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            >
              <option value={0}>Select...</option>
              {(masterLocations ?? [])
                .sort((a, b) => a.qrNumber - b.qrNumber)
                .map((l) => (
                  <option key={l.qrNumber} value={l.qrNumber}>
                    #{l.qrNumber} {l.name}
                  </option>
                ))}
            </select>
          </div>
          <button
            onClick={addBadPairing}
            disabled={!addQr}
            className="rounded bg-[#F5EACB] px-3 py-1.5 text-sm font-medium text-[#3D2B1F] hover:bg-[#D4A843]/30 disabled:opacity-50"
          >
            + Add Pairing
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={resetDefaults}
          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-gray-300"
        >
          Reset Defaults
        </button>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
