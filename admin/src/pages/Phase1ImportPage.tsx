import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { importClusters, importSpaceMetadata, type ImportResult } from '@/api/season';
import { ErrorAlert } from '@/components/ErrorAlert';

const VALID_CLUSTERS = ['nomad', 'drifter', 'forced', 'seeker', 'disengaged'];

interface ClusterRow {
  email: string;
  cluster: string;
  valid: boolean;
  reason?: string;
}

interface SpaceEntry {
  locationId: string;
  phase1Visits: number;
  phase1Satisfaction: number | null;
  phase1DominantCluster: string | null;
  classification: string;
  sdtDeficit: number;
  isNewSpace: boolean;
}

export function Phase1ImportPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#3D2B1F]">Phase 1 Data Import</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClusterImportSection />
        <SpaceMetadataSection />
      </div>
    </div>
  );
}

// ── Section A: Cluster Import ────────────────────────────────────────

function ClusterImportSection() {
  const [rows, setRows] = useState<ClusterRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: () => {
      const validRows = rows.filter((r) => r.valid).map((r) => ({ email: r.email, cluster: r.cluster }));
      return importClusters(validRows);
    },
    onSuccess: (data) => {
      setResult(data);
      setRows([]);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);

      const parsed: ClusterRow[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip header
        if (i === 0 && line.toLowerCase().startsWith('email')) continue;
        const parts = line.split(',').map((p) => p.trim());
        const email = (parts[0] ?? '').toLowerCase();
        const cluster = (parts[1] ?? '').toLowerCase();

        if (!email || !cluster) {
          parsed.push({ email, cluster, valid: false, reason: 'Empty field' });
        } else if (!VALID_CLUSTERS.includes(cluster)) {
          parsed.push({ email, cluster, valid: false, reason: `Invalid cluster: ${cluster}` });
        } else {
          parsed.push({ email, cluster, valid: true });
        }
      }
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = 'email,cluster\npriya@student.tce.edu,nomad\nraj@student.tce.edu,forced\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cluster_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;
  const clusterCounts: Record<string, number> = {};
  for (const r of rows.filter((r) => r.valid)) {
    clusterCounts[r.cluster] = (clusterCounts[r.cluster] || 0) + 1;
  }

  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-white p-6">
      <h2 className="mb-2 text-lg font-semibold text-[#3D2B1F]">Cluster Assignment Import</h2>
      <p className="mb-4 text-sm text-[#3D2B1F]/70">
        Upload a CSV with two columns: <code>email,cluster</code><br />
        Valid clusters: {VALID_CLUSTERS.join(', ')}
      </p>

      <div className="mb-4">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-[#3D2B1F] file:mr-4 file:rounded file:border-0 file:bg-[#8B6914] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#6B5210]"
        />
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex gap-3 text-xs">
            <span className="rounded bg-green-100 px-2 py-1 text-green-800">{validCount} valid</span>
            {invalidCount > 0 && (
              <span className="rounded bg-red-100 px-2 py-1 text-red-800">{invalidCount} invalid</span>
            )}
            {Object.entries(clusterCounts).map(([c, n]) => (
              <span key={c} className="rounded bg-[#F5EACB] px-2 py-1 text-[#3D2B1F]">{c}: {n}</span>
            ))}
          </div>

          <div className="max-h-48 overflow-y-auto rounded border border-[#8B6914]/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F5EACB]/50 text-[#3D2B1F]/50">
                  <th className="px-2 py-1 text-left">Email</th>
                  <th className="px-2 py-1 text-left">Cluster</th>
                  <th className="px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-[#8B6914]/5">
                    <td className="px-2 py-1">{r.email}</td>
                    <td className="px-2 py-1">{r.cluster}</td>
                    <td className="px-2 py-1">
                      {r.valid ? (
                        <span className="text-green-600">\u2713</span>
                      ) : (
                        <span className="text-red-600">{r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length > 20 && (
                  <tr><td colSpan={3} className="px-2 py-1 text-center text-[#3D2B1F]/40">...and {rows.length - 20} more</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => importMut.mutate()}
          disabled={validCount === 0 || importMut.isPending}
          className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
        >
          {importMut.isPending ? 'Importing...' : `Apply Import (${validCount} rows)`}
        </button>
        <button
          onClick={downloadTemplate}
          className="rounded border border-[#8B6914] px-4 py-2 text-sm text-[#8B6914] hover:bg-[#8B6914]/10"
        >
          Download Template
        </button>
      </div>

      {importMut.isError && <div className="mt-4"><ErrorAlert message={(importMut.error as Error).message} /></div>}

      {result && (
        <div className="mt-4 rounded border border-[#27AE60]/30 bg-[#27AE60]/10 p-4">
          <p className="mb-1 font-semibold text-[#3D2B1F]">Import Complete</p>
          <p className="text-sm text-[#3D2B1F]">
            {result.matched ?? 0} matched, {result.notInRoster ?? 0} not in roster, {result.invalid} invalid
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-600">
              {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section B: Space Metadata Import ─────────────────────────────────

function SpaceMetadataSection() {
  const [entries, setEntries] = useState<SpaceEntry[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: () => importSpaceMetadata(entries as unknown as Array<Record<string, unknown>>),
    onSuccess: (data) => {
      setResult(data);
      setEntries([]);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  function handleFile(file: File | null) {
    if (!file) return;
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!Array.isArray(parsed)) {
          setParseError('JSON must be an array of objects');
          return;
        }
        const valid: SpaceEntry[] = parsed.map((item: Record<string, unknown>) => ({
          locationId: String(item.locationId ?? ''),
          phase1Visits: Number(item.phase1Visits ?? 0),
          phase1Satisfaction: item.phase1Satisfaction != null ? Number(item.phase1Satisfaction) : null,
          phase1DominantCluster: item.phase1DominantCluster != null ? String(item.phase1DominantCluster) : null,
          classification: String(item.classification ?? 'TBD'),
          sdtDeficit: Number(item.sdtDeficit ?? 0),
          isNewSpace: Boolean(item.isNewSpace),
        }));
        setEntries(valid);
        setResult(null);
      } catch {
        setParseError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-white p-6">
      <h2 className="mb-2 text-lg font-semibold text-[#3D2B1F]">Space Metadata Import</h2>
      <p className="mb-4 text-sm text-[#3D2B1F]/70">
        Upload a JSON array with Phase 1 location metadata fields:<br />
        <code className="text-xs">locationId, phase1Visits, phase1Satisfaction, phase1DominantCluster, classification, sdtDeficit, isNewSpace</code>
      </p>

      <div className="mb-4">
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-[#3D2B1F] file:mr-4 file:rounded file:border-0 file:bg-[#8B6914] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#6B5210]"
        />
      </div>

      {parseError && <div className="mb-4"><ErrorAlert message={parseError} /></div>}

      {/* Preview */}
      {entries.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-[#3D2B1F]/50">{entries.length} entries loaded</p>
          <div className="max-h-48 overflow-auto rounded border border-[#8B6914]/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F5EACB]/50 text-[#3D2B1F]/50">
                  <th className="px-2 py-1 text-left">Location ID</th>
                  <th className="px-2 py-1 text-right">Visits</th>
                  <th className="px-2 py-1 text-right">Satisfaction</th>
                  <th className="px-2 py-1 text-left">Cluster</th>
                  <th className="px-2 py-1 text-left">Classification</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 15).map((e, i) => (
                  <tr key={i} className="border-b border-[#8B6914]/5">
                    <td className="px-2 py-1 font-mono text-[10px]">{e.locationId.slice(0, 12)}...</td>
                    <td className="px-2 py-1 text-right">{e.phase1Visits}</td>
                    <td className="px-2 py-1 text-right">{e.phase1Satisfaction?.toFixed(2) ?? '-'}</td>
                    <td className="px-2 py-1">{e.phase1DominantCluster ?? '-'}</td>
                    <td className="px-2 py-1">{e.classification}</td>
                  </tr>
                ))}
                {entries.length > 15 && (
                  <tr><td colSpan={5} className="px-2 py-1 text-center text-[#3D2B1F]/40">...and {entries.length - 15} more</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={() => importMut.mutate()}
        disabled={entries.length === 0 || importMut.isPending}
        className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
      >
        {importMut.isPending ? 'Importing...' : `Apply Import (${entries.length} entries)`}
      </button>

      {importMut.isError && <div className="mt-4"><ErrorAlert message={(importMut.error as Error).message} /></div>}

      {result && (
        <div className="mt-4 rounded border border-[#27AE60]/30 bg-[#27AE60]/10 p-4">
          <p className="mb-1 font-semibold text-[#3D2B1F]">Import Complete</p>
          <p className="text-sm text-[#3D2B1F]">
            {result.updated ?? 0} updated, {result.notFound ?? 0} not found, {result.invalid} invalid
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-600">
              {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
