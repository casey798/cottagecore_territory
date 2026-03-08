import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { importRoster } from '@/api/roster';
import { ErrorAlert } from '@/components/ErrorAlert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { RosterImportResult } from '@/types';

export function RosterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RosterImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: importRoster,
    onSuccess: (data) => {
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  function handleUpload() {
    if (file) uploadMut.mutate(file);
  }

  function downloadTemplate() {
    const csv = 'email,house\nstudent1@student.tce.edu,ember\nstudent2@student.tce.edu,tide\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roster_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#3D2B1F]">
        Roster Import
      </h1>

      <div className="max-w-lg rounded-lg border border-[#8B6914]/20 bg-white p-6">
        <p className="mb-4 text-sm text-[#3D2B1F]/70">
          Upload a CSV file with student roster. Format: <code>email,house</code>
          <br />
          Valid houses: ember, tide, bloom, gale
        </p>

        <div className="mb-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-[#3D2B1F] file:mr-4 file:rounded file:border-0 file:bg-[#8B6914] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#6B5210]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!file || uploadMut.isPending}
            className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {uploadMut.isPending ? (
              <LoadingSpinner className="py-0" />
            ) : (
              'Upload'
            )}
          </button>
          <button
            onClick={downloadTemplate}
            className="rounded border border-[#8B6914] px-4 py-2 text-sm text-[#8B6914] hover:bg-[#8B6914]/10"
          >
            Download Template
          </button>
        </div>

        {uploadMut.isError && (
          <div className="mt-4">
            <ErrorAlert message={(uploadMut.error as Error).message} />
          </div>
        )}

        {result && (
          <div className="mt-6 rounded border border-[#27AE60]/30 bg-[#27AE60]/10 p-4">
            <p className="mb-2 font-semibold text-[#3D2B1F]">
              Import Complete
            </p>
            <p className="text-sm text-[#3D2B1F]">
              {result.imported} imported, {result.skipped} skipped
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-600">Errors:</p>
                <ul className="mt-1 list-inside list-disc text-xs text-red-600">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
