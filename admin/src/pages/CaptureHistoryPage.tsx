import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCaptureHistory, deleteOverlays, type CaptureHistoryEntry } from '@/api/scores';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';

const CLAN_COLORS: Record<string, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#F1C40F',
  gale: '#27AE60',
  hearth: '#7D3C98',
};

export function CaptureHistoryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['capture-history'],
    queryFn: () => getCaptureHistory(1),
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const sorted = useMemo(
    () => (data ? [...data].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [data],
  );

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;

  function toggleOne(spaceId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((e) => e.spaceId)));
    }
  }

  const deleteMut = useMutation({
    mutationFn: () => deleteOverlays(Array.from(selectedIds)),
    onSuccess: () => {
      setSelectedIds(new Set());
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['capture-history'] });
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-[#3D2B1F]">
        Capture History
      </h1>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={(error as Error).message} />}
      {deleteMut.isError && (
        <div className="mb-4">
          <ErrorAlert message={(deleteMut.error as Error).message} />
        </div>
      )}

      {data && sorted.length === 0 && (
        <p className="text-sm text-[#3D2B1F]/50">
          No captures recorded yet this season.
        </p>
      )}

      {/* Delete toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-sm font-medium text-[#3D2B1F]">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-[#3D2B1F]">
              Confirm Delete
            </h3>
            <p className="mb-5 text-sm text-[#3D2B1F]/70">
              Delete {selectedIds.size} territory overlay{selectedIds.size > 1 ? 's' : ''}? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleteMut.isPending}
                className="rounded border border-[#8B6914]/30 px-4 py-2 text-sm text-[#3D2B1F] hover:bg-[#F5EACB]"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMut.isPending ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#8B6914]/20 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#8B6914]/10 bg-[#F5EACB]">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-[#8B6914]"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-[#3D2B1F]">Date</th>
                <th className="px-4 py-3 font-semibold text-[#3D2B1F]">Space Name</th>
                <th className="px-4 py-3 font-semibold text-[#3D2B1F]">Winning Clan</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry: CaptureHistoryEntry) => (
                <tr
                  key={entry.spaceId}
                  className={`border-b border-[#8B6914]/5 last:border-0 ${
                    selectedIds.has(entry.spaceId) ? 'bg-red-50/50' : ''
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.spaceId)}
                      onChange={() => toggleOne(entry.spaceId)}
                      className="accent-[#8B6914]"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-[#3D2B1F]/70">{entry.date}</td>
                  <td className="px-4 py-2.5 text-[#3D2B1F]">{entry.spaceName}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: CLAN_COLORS[entry.clan] ?? '#888' }}
                      />
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize text-white"
                        style={{ backgroundColor: CLAN_COLORS[entry.clan] ?? '#888' }}
                      >
                        {entry.clan}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
