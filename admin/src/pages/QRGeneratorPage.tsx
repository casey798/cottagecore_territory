import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { generateQR, getDailyConfig, resetQR, generatePermanentQRs, regenerateLocationQR } from '@/api/daily';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type QrMode = 'permanent' | 'daily';

function useNotification() {
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  function notify(type: 'success' | 'error', message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  return { notification, notify };
}

function downloadPng(base64: string, locationName: string) {
  const a = document.createElement('a');
  a.href = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  a.download = `QR-${locationName.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
  a.click();
}

// ── Permanent QRs Tab ───────────────────────────────────────────────

function PermanentQRsTab() {
  const queryClient = useQueryClient();
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [confirmRegenId, setConfirmRegenId] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const { notification, notify } = useNotification();

  // CRITICAL FIX 1: Use useQuery instead of mutation for data loading
  const { data: queryData, isLoading, error: queryError } = useQuery({
    queryKey: ['permanent-qrs'],
    queryFn: generatePermanentQRs,
  });

  // Separate mutation for explicit "Generate All" action
  const generateMut = useMutation({
    mutationFn: generatePermanentQRs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permanent-qrs'] });
      notify('success', 'Permanent QRs generated.');
    },
    onError: (err) => notify('error', (err as Error).message),
  });

  // Per-location regeneration
  const regenerateMut = useMutation({
    mutationFn: async (locationId: string) => {
      setRegeneratingId(locationId);
      await regenerateLocationQR(locationId);
      // After invalidation, re-generate so the cleared location gets a new secret
      await generatePermanentQRs();
    },
    onSuccess: () => {
      setRegeneratingId(null);
      setConfirmRegenId(null);
      queryClient.invalidateQueries({ queryKey: ['permanent-qrs'] });
      notify('success', 'QR regenerated. Print and replace the physical QR.');
    },
    onError: (err) => {
      const msg = (err as Error).message;
      notify('error', `Failed to regenerate QR. The physical QR may still be valid — try again. (${msg})`);
      setRegeneratingId(null);
      setConfirmRegenId(null);
    },
  });

  const qrCodes = queryData?.qrCodes ?? [];
  const newCount = qrCodes.filter((q) => !q.alreadyExisted).length;
  const existingCount = qrCodes.filter((q) => q.alreadyExisted).length;

  const handleDownloadPdf = useCallback(async () => {
    if (!qrCodes.length) return;
    setPdfGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      for (let i = 0; i < qrCodes.length; i++) {
        if (i > 0) doc.addPage();
        const qr = qrCodes[i];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(qr.locationName, pageW / 2, 25, { align: 'center' });

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
        doc.text('GroveWars — Permanent QR', pageW / 2, pageH - 15, { align: 'center' });
      }
      doc.save('GroveWars-Permanent-QR.pdf');
    } finally {
      setPdfGenerating(false);
    }
  }, [qrCodes]);

  return (
    <div>
      {/* Notification banner */}
      {notification && (
        <div
          className={`mb-4 rounded p-2 text-sm ${
            notification.type === 'success'
              ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {qrCodes.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="rounded bg-[#8B6914] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {generateMut.isPending ? 'Generating...' : 'Generate All Permanent QRs'}
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
        Permanent QRs never expire. Each location gets its own secret. Only generates for locations that don't have one yet.
      </p>

      {isLoading && <LoadingSpinner />}
      {queryError && (
        <ErrorAlert message={queryError instanceof Error ? queryError.message : 'Failed to load permanent QRs'} />
      )}

      {/* LOW FIX 5: Empty state */}
      {!isLoading && !queryError && qrCodes.length === 0 && (
        <div className="rounded border border-[#D4A843]/30 bg-[#D4A843]/10 p-4 text-sm text-[#8B6914]">
          No locations found in location master config. Add locations via the Locations page before generating QRs.
        </div>
      )}

      {qrCodes.length > 0 && (
        <>
          <p className="mb-4 text-sm text-[#3D2B1F]/70">
            {qrCodes.length} locations — {existingCount} already had QRs{newCount > 0 ? `, ${newCount} newly generated` : ''}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {qrCodes.map((qr) => (
              <div key={qr.locationId} className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-[#3D2B1F]">{qr.locationName}</h3>
                  <div className="flex items-center gap-1.5">
                    {/* HIGH FIX 4: Active/inactive badge */}
                    {!qr.active && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Inactive
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      qr.alreadyExisted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {qr.alreadyExisted ? 'Has QR' : 'New'}
                    </span>
                  </div>
                </div>

                {/* HIGH FIX 4: Inactive note */}
                {!qr.active && (
                  <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                    This location is not in the active pool — QR exists but cannot be scanned until activated
                  </p>
                )}

                {qr.qrImageBase64 ? (
                  <img
                    src={qr.qrImageBase64.startsWith('data:') ? qr.qrImageBase64 : `data:image/png;base64,${qr.qrImageBase64}`}
                    alt={`QR code for ${qr.locationName}`}
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

                {/* LOW FIX 6: Per-location PNG download */}
                <div className="mb-2 flex gap-2">
                  {qr.qrImageBase64 && (
                    <button
                      onClick={() => downloadPng(qr.qrImageBase64, qr.locationName)}
                      className="flex-1 rounded border border-[#8B6914]/30 px-2 py-1 text-xs font-medium text-[#8B6914] hover:bg-[#F5EACB]"
                    >
                      Download PNG
                    </button>
                  )}
                </div>

                {/* Regenerate with confirmation */}
                {confirmRegenId === qr.locationId ? (
                  <div className="rounded border border-red-200 bg-red-50 p-2">
                    <p className="mb-2 text-xs text-red-800">
                      This will invalidate the physical QR for {qr.locationName}. You will need to reprint and replace it.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmRegenId(null)}
                        className="flex-1 rounded bg-white px-2 py-1 text-xs font-medium text-[#3D2B1F] hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => regenerateMut.mutate(qr.locationId)}
                        disabled={regenerateMut.isPending}
                        className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {regeneratingId === qr.locationId ? 'Regenerating...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRegenId(qr.locationId)}
                    className="w-full rounded border border-[#C0392B]/30 px-2 py-1 text-xs font-medium text-[#C0392B] hover:bg-red-50"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Daily QRs Tab ───────────────────────────────────────────────────

function DailyQRsTab() {
  const today = useMemo(() => getTodayIST(), []);
  const [date, setDate] = useState(today);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['daily-config', date],
    queryFn: () => getDailyConfig(date),
  });

  const generateMut = useMutation({
    mutationFn: () => generateQR(date),
  });

  const resetMut = useMutation({
    mutationFn: () => resetQR(date),
    onSuccess: () => {
      setConfirmReset(false);
      generateMut.reset();
      generateMut.mutate();
    },
  });

  const noConfig = !configLoading && !config;
  const hasQrCodes = !!generateMut.data?.qrCodes?.length;

  useEffect(() => {
    if (config && !generateMut.data && !generateMut.isPending) {
      generateMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, date]);

  const [pdfGenerating, setPdfGenerating] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    const qrCodes = generateMut.data?.qrCodes;
    if (!qrCodes?.length) return;

    setPdfGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 0));

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      for (let i = 0; i < qrCodes.length; i++) {
        if (i > 0) doc.addPage();
        const qr = qrCodes[i];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(qr.locationName, pageW / 2, 25, { align: 'center' });

        const imgSize = 150;
        const imgX = (pageW - imgSize) / 2;
        const imgY = 40;
        if (qr.qrImageBase64) {
          let b64 = qr.qrImageBase64;
          if (b64.startsWith('data:')) {
            b64 = b64.split(',')[1];
          }
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
        doc.text(`GroveWars — Valid for: ${date}`, pageW / 2, pageH - 15, {
          align: 'center',
        });
      }

      doc.save(`GroveWars-QR-${date}.pdf`);
    } finally {
      setPdfGenerating(false);
    }
  }, [generateMut.data, date]);

  return (
    <div>
      <div className="mb-2 flex items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              generateMut.reset();
              setConfirmReset(false);
            }}
            className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
          />
        </div>
        <button
          onClick={() => generateMut.mutate()}
          disabled={generateMut.isPending || noConfig}
          className="rounded bg-[#8B6914] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
        >
          {generateMut.isPending ? 'Generating...' : hasQrCodes ? 'Regenerate QR Codes' : 'Generate QR Codes'}
        </button>
      </div>

      <p className="mb-6 text-xs text-[#3D2B1F]/50">
        Daily QR codes expire at end of day. Use Permanent QRs for physical placement.
      </p>

      {configLoading && <LoadingSpinner />}

      {noConfig && (
        <div className="rounded border border-[#D4A843]/30 bg-[#D4A843]/10 p-4 text-sm text-[#8B6914]">
          No daily config found for this date. Set up the daily config first.
        </div>
      )}

      {generateMut.isError && (
        <ErrorAlert
          message={
            generateMut.error instanceof Error
              ? generateMut.error.message
              : 'Failed to generate QR codes'
          }
        />
      )}

      {generateMut.data && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-[#3D2B1F]/70">
              {generateMut.data.qrCodes.length} QR codes generated for {date}
            </p>
            <div className="flex gap-2">
              {/* HIGH FIX 3: Confirmation dialog for reset */}
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  disabled={resetMut.isPending || generateMut.isPending}
                  className="rounded bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A93226] disabled:opacity-50"
                >
                  Regenerate Images
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
                  <p className="max-w-xs text-xs text-red-800">
                    This will clear all generated QR images for {date} and regenerate them. If you have already printed today's QRs, you will need to reprint them. The QR codes will be functionally identical since the daily secret is unchanged.
                  </p>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="shrink-0 rounded bg-white px-3 py-1 text-xs font-medium text-[#3D2B1F] hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => resetMut.mutate()}
                    disabled={resetMut.isPending}
                    className="shrink-0 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {resetMut.isPending ? 'Resetting...' : 'Regenerate Images'}
                  </button>
                </div>
              )}
              <button
                onClick={() => handleDownloadPdf()}
                disabled={pdfGenerating || !generateMut.data.qrCodes.length}
                className="flex items-center gap-2 rounded bg-[#27AE60] px-4 py-2 text-sm font-semibold text-white hover:bg-[#219A52] disabled:opacity-50"
              >
                {pdfGenerating && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {pdfGenerating ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generateMut.data.qrCodes.map((qr) => (
              <div
                key={qr.locationId}
                className="rounded-lg border border-[#8B6914]/20 bg-white p-4"
              >
                <h3 className="mb-2 font-semibold text-[#3D2B1F]">
                  {qr.locationName}
                </h3>
                {qr.qrImageBase64 ? (
                  <img
                    src={qr.qrImageBase64.startsWith('data:') ? qr.qrImageBase64 : `data:image/png;base64,${qr.qrImageBase64}`}
                    alt={`QR code for ${qr.locationName}`}
                    className="mx-auto mb-2 h-48 w-48"
                  />
                ) : (
                  <div className="mx-auto mb-2 flex h-48 w-48 items-center justify-center rounded bg-[#F5EACB] text-center text-xs text-[#8B6914]">
                    QR generation failed for this location
                  </div>
                )}
                <p className="break-all text-xs text-[#3D2B1F]/40">
                  {qr.qrPayload}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export function QRGeneratorPage() {
  const [mode, setMode] = useState<QrMode>('permanent');

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-[#3D2B1F]">QR Generator</h1>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[#8B6914]/20 bg-[#F5EACB]/50 p-1">
        <button
          onClick={() => setMode('permanent')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'permanent'
              ? 'bg-white text-[#3D2B1F] shadow-sm'
              : 'text-[#3D2B1F]/50 hover:text-[#3D2B1F]'
          }`}
        >
          Permanent QRs
        </button>
        <button
          onClick={() => setMode('daily')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'daily'
              ? 'bg-white text-[#3D2B1F] shadow-sm'
              : 'text-[#3D2B1F]/50 hover:text-[#3D2B1F]'
          }`}
        >
          Daily QRs
        </button>
      </div>

      {mode === 'permanent' ? <PermanentQRsTab /> : <DailyQRsTab />}
    </div>
  );
}
