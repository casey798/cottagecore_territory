import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  getSpaces,
  getSpaceDecorations,
  getAllDecorations,
  exportDecorations,
  getDecorationImageManifest,
  type DecorationImageManifestItem,
} from '@/api/spaces';
import { Modal } from '@/components/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { CLAN_COLORS, CLAN_LABELS } from '@/constants/clans';
import type { SpaceDecorationSubmission, DecorationPackCategory } from '@/types';

const ALL_CLANS = ['ember', 'tide', 'bloom', 'gale', 'hearth'] as const;

const PACK_LABELS: Record<DecorationPackCategory, string> = {
  furniture: 'Furniture',
  aesthetics: 'Aesthetics',
  nature: 'Nature',
};

const PDF_CLAN_COLORS: Record<string, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#D4AC0D',
  gale: '#27AE60',
  hearth: '#7D3C98',
};

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function buildFilterLabel(
  spaceId: string,
  spaceName: string | undefined,
  dateFilter: string,
  clanFilter: string,
): string {
  const parts: string[] = [];
  if (spaceId !== 'all' && spaceName) {
    parts.push(spaceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }
  if (dateFilter) parts.push(dateFilter);
  if (clanFilter !== 'all') parts.push(clanFilter);
  return parts.length > 0 ? parts.join('-') : 'all';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ── Main Page ────────────────────────────────────────────

export function DecorationViewerPage() {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [clanFilter, setClanFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<SpaceDecorationSubmission | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const { data: spaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: getSpaces,
  });

  const clanParam = clanFilter !== 'all' ? clanFilter : undefined;

  // Fetch decorations — server-side filtering
  const { data: decorations, isLoading, error } = useQuery({
    queryKey: ['space-decorations', selectedSpaceId, dateFilter, clanFilter],
    queryFn: () => {
      if (selectedSpaceId === 'all') {
        return getAllDecorations({
          startDate: dateFilter || undefined,
          endDate: dateFilter || undefined,
          clan: clanParam,
        });
      }
      return getSpaceDecorations(selectedSpaceId, {
        date: dateFilter || undefined,
        clan: clanParam,
      });
    },
    enabled: selectedSpaceId === 'all' ? true : !!selectedSpaceId,
    staleTime: 1000 * 60 * 60 * 3, // 3 hours — URLs expire in 4h
  });

  const sorted = useMemo(() => {
    if (!decorations) return [];
    return [...decorations].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [decorations]);

  const spaceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of spaces ?? []) map.set(s.spaceId, s.name);
    return map;
  }, [spaces]);

  const getSpaceName = useCallback(
    (sub: SpaceDecorationSubmission) =>
      sub.spaceName || spaceNameMap.get(sub.spaceId) || sub.spaceId,
    [spaceNameMap],
  );

  const activeFilterLabel = buildFilterLabel(
    selectedSpaceId,
    selectedSpaceId !== 'all' ? spaceNameMap.get(selectedSpaceId) : undefined,
    dateFilter,
    clanFilter,
  );

  // ── Shared manifest fetch ──────────────────────────────

  const fetchManifest = useCallback(async (): Promise<DecorationImageManifestItem[]> => {
    const filters: Record<string, string> = {};
    if (selectedSpaceId !== 'all') filters.spaceId = selectedSpaceId;
    if (dateFilter) {
      filters.startDate = dateFilter;
      filters.endDate = dateFilter;
      filters.date = dateFilter;
    }
    if (clanFilter !== 'all') filters.clan = clanFilter;
    const result = await getDecorationImageManifest(filters);
    return result.images;
  }, [selectedSpaceId, dateFilter, clanFilter]);

  // ── CSV export ─────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const csv = await exportDecorations(
        dateFilter || undefined,
        dateFilter || undefined,
      );
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decorations-export-${activeFilterLabel}-${getTodayIST()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setExportMessage('CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  // ── PDF export ─────────────────────────────────────────

  const handlePdfExport = async () => {
    setIsPdfExporting(true);
    setExportMessage(null);
    try {
      const manifest = await fetchManifest();
      if (manifest.length === 0) {
        setExportMessage('No screenshots to export.');
        return;
      }

      const PAGES_PER_PDF = 50;
      const totalParts = Math.ceil(manifest.length / PAGES_PER_PDF);

      if (manifest.length > PAGES_PER_PDF) {
        if (!window.confirm(
          `${manifest.length} images will be split into ${totalParts} PDF files (${PAGES_PER_PDF} pages each). Continue?`
        )) return;
      }

      for (let part = 0; part < totalParts; part++) {
        const startIdx = part * PAGES_PER_PDF;
        const endIdx = Math.min(startIdx + PAGES_PER_PDF, manifest.length);
        const chunk = manifest.slice(startIdx, endIdx);

        setExportMessage(`Generating PDF part ${part + 1} of ${totalParts} (pages ${startIdx + 1}–${endIdx})...`);

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        for (let j = 0; j < chunk.length; j++) {
          if (j > 0) doc.addPage();
          const item = chunk[j];
          const globalIdx = startIdx + j;
          const clanColor = PDF_CLAN_COLORS[item.clan] ?? '#555555';

          // Header strip
          doc.setFillColor(clanColor);
          doc.rect(0, 0, 297, 10, 'F');
          doc.setTextColor('#FFFFFF');
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(`${item.spaceName}  ·  ${item.date}  ·  ${item.displayName || 'Anonymous'}  ·  ${item.clan}`, 5, 6.5);
          doc.text(`${globalIdx + 1} of ${manifest.length}`, 292, 6.5, { align: 'right' });

          // Image area — use a canvas to convert PNG→JPEG to save memory
          let imageLoaded = false;
          try {
            const response = await fetch(item.url);
            if (response.ok) {
              const blob = await response.blob();
              const dataUrl = await blobToDataUrl(blob);
              const img = await loadImage(dataUrl);

              // Convert to compressed JPEG via offscreen canvas
              const canvas = document.createElement('canvas');
              const maxDim = 1200; // cap resolution to save memory
              let cw = img.naturalWidth;
              let ch = img.naturalHeight;
              if (cw > maxDim || ch > maxDim) {
                const s = maxDim / Math.max(cw, ch);
                cw = Math.round(cw * s);
                ch = Math.round(ch * s);
              }
              canvas.width = cw;
              canvas.height = ch;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, cw, ch);
                const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                const scale = Math.min(200 / cw, 143 / ch);
                const fitW = cw * scale;
                const fitH = ch * scale;
                const offsetX = 5 + (200 - fitW) / 2;
                const offsetY = 12 + (143 - fitH) / 2;
                doc.addImage(jpegDataUrl, 'JPEG', offsetX, offsetY, fitW, fitH);
                doc.setDrawColor('#DDDDDD');
                doc.setLineWidth(0.3);
                doc.rect(offsetX, offsetY, fitW, fitH, 'S');
                imageLoaded = true;
              }
              // Release references
              canvas.width = 0;
              canvas.height = 0;
            }
          } catch {
            // Image load failed
          }
          if (!imageLoaded) {
            doc.setFillColor('#CCCCCC');
            doc.rect(5, 12, 200, 143, 'F');
            doc.setTextColor('#666666');
            doc.setFontSize(12);
            doc.text('Screenshot unavailable', 105, 83.5, { align: 'center' });
          }

          // Survey panel
          doc.setFillColor('#FDF6E3');
          doc.rect(5, 158, 287, 45, 'F');
          doc.setDrawColor('#D4A843');
          doc.setLineWidth(0.4);
          doc.rect(5, 158, 287, 45, 'S');

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor('#3D2B1F');
          doc.text('Would you visit this space without the game?', 9, 166);
          const answerColor = item.wouldVisitMore === 'yes' ? '#27AE60' : item.wouldVisitMore === 'maybe' ? '#D4A843' : '#C0392B';
          doc.setTextColor(answerColor);
          const answer = item.wouldVisitMore ? item.wouldVisitMore.charAt(0).toUpperCase() + item.wouldVisitMore.slice(1) : '—';
          doc.text(answer, 120, 166);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor('#3D2B1F');
          doc.text('What would you want this space to be?', 9, 175);
          doc.setFont('helvetica', 'normal');
          const lines1 = doc.splitTextToSize(item.wantSpaceToBe || '—', 200);
          doc.text(lines1.slice(0, 2), 9, 181);

          doc.setFont('helvetica', 'bold');
          doc.text('Why did you choose these items?', 9, 188);
          doc.setFont('helvetica', 'normal');
          const lines2 = doc.splitTextToSize(item.whyChoseItems || '—', 200);
          doc.text(lines2.slice(0, 2), 9, 194);

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor('#7D6355');
          doc.text(
            `Furniture: ${item.furnitureCount}   Aesthetics: ${item.aestheticsCount}   Nature: ${item.natureCount}`,
            289, 199, { align: 'right' },
          );
        }

        const suffix = totalParts > 1 ? `-part${part + 1}of${totalParts}` : '';
        doc.save(`decoration-gallery-${activeFilterLabel}-${getTodayIST()}${suffix}.pdf`);
      }

      setExportMessage(totalParts > 1
        ? `Done — ${totalParts} PDF files saved (${manifest.length} pages total).`
        : null,
      );
    } catch (err) {
      console.error('PDF export failed:', err);
      setExportMessage('PDF export failed.');
    } finally {
      setIsPdfExporting(false);
    }
  };

  // ── ZIP export ─────────────────────────────────────────

  const handleZipExport = async () => {
    setIsZipping(true);
    setExportMessage(null);
    try {
      const manifest = await fetchManifest();
      if (manifest.length === 0) {
        setExportMessage('No screenshots to export.');
        return;
      }
      if (manifest.length > 50) {
        const estMB = (manifest.length * 0.3).toFixed(1);
        if (!window.confirm(`This will download ${manifest.length} images (~${estMB} MB). Continue?`)) return;
      }

      const zip = new JSZip();

      const results = await Promise.allSettled(
        manifest.map(async (item) => {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error('fetch failed');
          const blob = await response.blob();
          zip.file(item.filename, blob);
        }),
      );

      const failCount = results.filter((r) => r.status === 'rejected').length;

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      saveAs(zipBlob, `decoration-screenshots-${activeFilterLabel}-${getTodayIST()}.zip`);

      if (failCount > 0) {
        setExportMessage(`${failCount} image${failCount > 1 ? 's' : ''} could not be downloaded and were skipped.`);
      }
    } catch (err) {
      console.error('ZIP export failed:', err);
      setExportMessage('ZIP export failed.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Decoration Viewer</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || isPdfExporting || isZipping}
            className="rounded bg-[#8B6914] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={handlePdfExport}
            disabled={isPdfExporting}
            className="rounded border border-[#8B6914] px-4 py-2 text-sm font-medium text-[#8B6914] hover:bg-[#F5EACB] disabled:opacity-50"
          >
            {isPdfExporting ? 'Generating PDF...' : 'Export PDF Gallery'}
          </button>
          <button
            onClick={handleZipExport}
            disabled={isZipping}
            className="rounded border border-[#8B6914] px-4 py-2 text-sm font-medium text-[#8B6914] hover:bg-[#F5EACB] disabled:opacity-50"
          >
            {isZipping ? 'Zipping...' : 'Export Images (ZIP)'}
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {exportMessage}
        </div>
      )}

      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={selectedSpaceId}
          onChange={(e) => setSelectedSpaceId(e.target.value)}
          className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
        >
          <option value="all">All Spaces</option>
          {(spaces ?? []).map((s) => (
            <option key={s.spaceId} value={s.spaceId}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="text-xs text-[#8B6914] hover:underline">
            Clear date
          </button>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => setClanFilter('all')}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              clanFilter === 'all'
                ? 'bg-[#8B6914] text-white'
                : 'bg-[#F5EACB] text-[#3D2B1F] hover:bg-[#D4A843]/30'
            }`}
          >
            All
          </button>
          {ALL_CLANS.map((c) => (
            <button
              key={c}
              onClick={() => setClanFilter(c)}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                clanFilter === c
                  ? 'text-white'
                  : 'bg-[#F5EACB] text-[#3D2B1F] hover:bg-[#D4A843]/30'
              }`}
              style={clanFilter === c ? { backgroundColor: CLAN_COLORS[c] } : undefined}
            >
              {CLAN_LABELS[c] ?? c}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#3D2B1F]/50">
          {sorted.length} submission{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={(error as Error).message} />}

      {!isLoading && !error && sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-[#3D2B1F]/50">
          No decoration submissions found for the current filters.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((sub) => (
          <SubmissionCard
            key={sub.userSpaceId}
            submission={sub}
            spaceName={getSpaceName(sub)}
            onClick={() => setSelectedSubmission(sub)}
          />
        ))}
      </div>

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          spaceName={getSpaceName(selectedSubmission)}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
}

// ── Submission Card ─────────────────────────────────────

function SubmissionCard({
  submission,
  spaceName,
  onClick,
}: {
  submission: SpaceDecorationSubmission;
  spaceName: string;
  onClick: () => void;
}) {
  const clanColor = CLAN_COLORS[submission.clan] ?? '#888';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer overflow-hidden rounded-lg border border-[#8B6914]/15 bg-white transition-shadow hover:shadow-md"
    >
      {submission.screenshotUrl ? (
        <img
          src={submission.screenshotUrl}
          alt={`Decoration by ${submission.playerDisplayName ?? submission.userId.slice(0, 8)}`}
          className="h-40 w-full object-cover bg-[#3D2B1F]/5"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-[#3D2B1F]/5">
          <span className="text-xs text-[#3D2B1F]/30">No screenshot</span>
        </div>
      )}

      <div className="p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: clanColor }} />
          <span className="text-sm font-medium text-[#3D2B1F]">
            {submission.playerDisplayName ?? submission.userId.slice(0, 8)}
          </span>
        </div>
        <div className="mb-2 text-xs text-[#3D2B1F]/50">
          {spaceName} &middot; {submission.date}
        </div>
        <div className="flex gap-2 text-xs text-[#3D2B1F]/60">
          {(Object.entries(submission.packUsageSummary ?? {}) as [DecorationPackCategory, number][]).map(
            ([category, count]) =>
              count > 0 && (
                <span key={category} className="rounded bg-[#F5EACB] px-1.5 py-0.5">
                  {PACK_LABELS[category]} {count}
                </span>
              ),
          )}
        </div>
      </div>
    </div>
  );
}

// ── Submission Detail Modal ─────────────────────────────

function SubmissionDetailModal({
  submission,
  spaceName,
  onClose,
}: {
  submission: SpaceDecorationSubmission;
  spaceName: string;
  onClose: () => void;
}) {
  const clanColor = CLAN_COLORS[submission.clan] ?? '#888';
  const totalItems = submission.layout?.placedAssets?.length ?? 0;

  return (
    <Modal isOpen onClose={onClose} title="Decoration Submission" maxWidth="40rem">
      <div className="mb-4 rounded bg-[#3D2B1F]/5 overflow-hidden">
        {submission.screenshotUrl ? (
          <img src={submission.screenshotUrl} alt="Decoration screenshot" className="w-full object-contain max-h-72" />
        ) : (
          <div className="flex h-48 items-center justify-center">
            <span className="text-sm text-[#3D2B1F]/40">No screenshot available</span>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-[#3D2B1F]">
        <div>
          <span className="text-xs font-medium text-[#3D2B1F]/50">Player</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: clanColor }} />
            {submission.playerDisplayName ?? submission.userId.slice(0, 12)}
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-[#3D2B1F]/50">Clan</span>
          <div>{CLAN_LABELS[submission.clan] ?? submission.clan}</div>
        </div>
        <div>
          <span className="text-xs font-medium text-[#3D2B1F]/50">Space</span>
          <div>{spaceName}</div>
        </div>
        <div>
          <span className="text-xs font-medium text-[#3D2B1F]/50">Date</span>
          <div>{submission.date}</div>
        </div>
        <div>
          <span className="text-xs font-medium text-[#3D2B1F]/50">Items Placed</span>
          <div>{totalItems}</div>
        </div>
        <div>
          <span className="text-xs font-medium text-[#3D2B1F]/50">XP Awarded</span>
          <div>{submission.xpAwarded}</div>
        </div>
      </div>

      <div className="mb-4">
        <span className="mb-1 block text-xs font-medium text-[#3D2B1F]/50">Pack Usage</span>
        <div className="flex gap-3">
          {(Object.entries(submission.packUsageSummary ?? {}) as [DecorationPackCategory, number][]).map(
            ([category, count]) => (
              <div key={category} className="rounded border border-[#8B6914]/15 bg-[#F5EACB]/60 px-3 py-1.5 text-sm">
                <span className="font-medium text-[#3D2B1F]">{count}</span>{' '}
                <span className="text-[#3D2B1F]/60">{PACK_LABELS[category]}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-[#8B6914]/15 bg-[#F5EACB]/40 p-4">
        <h4 className="text-sm font-bold text-[#3D2B1F]">Survey Responses</h4>
        <div>
          <span className="block text-xs font-medium text-[#8B6914]">&quot;What do you want this space to be?&quot;</span>
          <p className="text-sm text-[#3D2B1F]">{submission.survey?.wantSpaceToBe || '—'}</p>
        </div>
        <div>
          <span className="block text-xs font-medium text-[#8B6914]">&quot;Why did you choose these items?&quot;</span>
          <p className="text-sm text-[#3D2B1F]">{submission.survey?.whyChoseItems || '—'}</p>
        </div>
        <div>
          <span className="block text-xs font-medium text-[#8B6914]">&quot;Would you visit this space more often?&quot;</span>
          <p className="text-sm text-[#3D2B1F]">
            {submission.survey?.wouldVisitMore === 'yes'
              ? 'Yes'
              : submission.survey?.wouldVisitMore === 'maybe'
                ? 'Maybe'
                : submission.survey?.wouldVisitMore === 'no'
                  ? 'No'
                  : '—'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
