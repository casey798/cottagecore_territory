import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { generateQR, getDailyConfig, resetQR } from '@/api/daily';
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

export function QRGeneratorPage() {
  const today = useMemo(() => getTodayIST(), []);
  const [date, setDate] = useState(today);

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
      generateMut.reset();
      generateMut.mutate();
    },
  });

  const noConfig = !configLoading && !config;
  const hasQrCodes = !!generateMut.data?.qrCodes?.length;

  // Auto-load existing QR codes when config is available
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
      <h1 className="mb-4 text-2xl font-bold text-[#3D2B1F]">QR Generator</h1>

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
        QR codes persist until manually reset
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
              <button
                onClick={() => resetMut.mutate()}
                disabled={resetMut.isPending || generateMut.isPending}
                className="rounded bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A93226] disabled:opacity-50"
              >
                {resetMut.isPending ? 'Resetting...' : 'Reset & Regenerate'}
              </button>
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
