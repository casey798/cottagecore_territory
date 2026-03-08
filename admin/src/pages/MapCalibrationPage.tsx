import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getMapConfig, uploadCalibration, getMapUploadUrl } from '@/api/map';
import { computeAffineTransform, gpsToPixel } from '@/utils/affineTransform';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '@/constants/map';
import { FormField } from '@/components/FormField';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import type { CalibrationPoint, AffineMatrix } from '@/types';

interface PointInput {
  pixelX: number;
  pixelY: number;
  gpsLat: string;
  gpsLng: string;
}

const EMPTY_POINT: PointInput = { pixelX: 0, pixelY: 0, gpsLat: '', gpsLng: '' };

export function MapCalibrationPage() {
  const [points, setPoints] = useState<PointInput[]>([]);
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [testLat, setTestLat] = useState('');
  const [testLng, setTestLng] = useState('');
  const [testResult, setTestResult] = useState<{ x: number; y: number } | null>(null);
  const [computedMatrix, setComputedMatrix] = useState<AffineMatrix | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: mapConfig } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: getMapConfig,
  });

  useEffect(() => {
    if (mapConfig?.mapImageUrl && !mapImageUrl) {
      setMapImageUrl(mapConfig.mapImageUrl);
    }
  }, [mapConfig, mapImageUrl]);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, key } = await getMapUploadUrl(file.name);
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      return key;
    },
    onSuccess: (key, file) => {
      const url = URL.createObjectURL(file);
      setMapImageUrl(url);
      setUploadedKey(key);
      setPoints([]);
      setComputedMatrix(null);
      setTestResult(null);
    },
    onError: (err) => setError((err as Error).message),
  });

  const saveMut = useMutation({
    mutationFn: uploadCalibration,
    onSuccess: () => setError(null),
    onError: (err) => setError((err as Error).message),
  });

  const updateScaleFactor = useCallback(() => {
    if (imgRef.current && containerRef.current) {
      const displayWidth = imgRef.current.clientWidth;
      setScaleFactor(MAP_WIDTH / displayWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateScaleFactor);
    return () => window.removeEventListener('resize', updateScaleFactor);
  }, [updateScaleFactor]);

  function handleMapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (points.length >= 4) return;
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    const pixelX = Math.round(displayX * scaleFactor);
    const pixelY = Math.round(displayY * scaleFactor);

    setPoints((prev) => [...prev, { ...EMPTY_POINT, pixelX, pixelY }]);
  }

  function updatePointGps(
    index: number,
    field: 'gpsLat' | 'gpsLng',
    value: string,
  ) {
    setPoints((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  function removePoint(index: number) {
    setPoints((prev) => prev.filter((_, i) => i !== index));
    setComputedMatrix(null);
    setTestResult(null);
  }

  function handleCompute() {
    if (points.length !== 4) {
      setError('Exactly 4 calibration points are required.');
      return;
    }

    for (let i = 0; i < 4; i++) {
      const p = points[i];
      if (!p.gpsLat || !p.gpsLng) {
        setError(`Point ${i + 1} is missing GPS coordinates.`);
        return;
      }
      const lat = parseFloat(p.gpsLat);
      const lng = parseFloat(p.gpsLng);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setError(`Point ${i + 1} has invalid GPS coordinates.`);
        return;
      }
    }

    const calibrationPoints: CalibrationPoint[] = points.map((p) => ({
      pixelX: p.pixelX,
      pixelY: p.pixelY,
      gpsLat: parseFloat(p.gpsLat),
      gpsLng: parseFloat(p.gpsLng),
    }));

    const matrix = computeAffineTransform(calibrationPoints);
    setComputedMatrix(matrix);
    setError(null);

    const imageKey = uploadedKey || mapConfig?.mapImageKey;
    if (!imageKey) {
      setError('Upload a map image first.');
      return;
    }

    saveMut.mutate({
      mapImageKey: imageKey,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      tileSize: TILE_SIZE,
      points: calibrationPoints,
      transformMatrix: matrix,
    });
  }

  function handleTest() {
    if (!computedMatrix) {
      setError('Compute calibration first.');
      return;
    }
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Enter valid test GPS coordinates.');
      return;
    }
    const pixel = gpsToPixel(lat, lng, computedMatrix);
    setTestResult(pixel);
    setError(null);
  }

  function getDisplayCoords(pixelX: number, pixelY: number) {
    return {
      x: pixelX / scaleFactor,
      y: pixelY / scaleFactor,
    };
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#3D2B1F]">
        Map Calibration
      </h1>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="flex gap-6">
        {/* Left panel - Map */}
        <div className="w-3/5" ref={containerRef}>
          <div className="mb-3">
            <label className="cursor-pointer rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210]">
              Upload Campus PNG
              <input
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMut.mutate(file);
                }}
              />
            </label>
            {uploadMut.isPending && (
              <span className="ml-2 text-sm text-[#3D2B1F]/60">
                Uploading...
              </span>
            )}
          </div>

          <div className="relative inline-block rounded border border-[#8B6914]/20 bg-white">
            {mapImageUrl ? (
              <>
                <img
                  ref={imgRef}
                  src={mapImageUrl}
                  alt="Campus map"
                  className="max-w-full cursor-crosshair"
                  onClick={handleMapClick}
                  onLoad={updateScaleFactor}
                  draggable={false}
                />
                {/* Calibration point markers */}
                {points.map((p, i) => {
                  const display = getDisplayCoords(p.pixelX, p.pixelY);
                  return (
                    <div
                      key={i}
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#C0392B] text-xs font-bold text-white shadow"
                      style={{ left: display.x, top: display.y }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
                {/* Test result dot */}
                {testResult && (
                  <div
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2980B9] shadow ring-2 ring-white"
                    style={{
                      left: getDisplayCoords(testResult.x, testResult.y).x,
                      top: getDisplayCoords(testResult.x, testResult.y).y,
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-sm text-[#3D2B1F]/40">
                Upload a campus map PNG to begin
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Controls */}
        <div className="w-2/5">
          <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
            Calibration Points
          </h2>
          <p className="mb-4 text-xs text-[#3D2B1F]/60">
            Click on the map to place up to 4 points, then enter their GPS
            coordinates from Google Maps.
          </p>

          {points.length === 0 && (
            <p className="mb-4 text-sm text-[#3D2B1F]/40">
              No points placed yet. Click on the map.
            </p>
          )}

          {points.map((p, i) => (
            <div
              key={i}
              className="mb-3 rounded border border-[#8B6914]/20 bg-white p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#3D2B1F]">
                  Point #{i + 1}
                </span>
                <button
                  onClick={() => removePoint(i)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
              <p className="mb-2 text-xs text-[#3D2B1F]/60">
                Pixel: ({p.pixelX}, {p.pixelY})
              </p>
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  label="Latitude"
                  type="number"
                  step="0.000001"
                  value={p.gpsLat}
                  onChange={(e) =>
                    updatePointGps(
                      i,
                      'gpsLat',
                      (e.target as HTMLInputElement).value,
                    )
                  }
                />
                <FormField
                  label="Longitude"
                  type="number"
                  step="0.000001"
                  value={p.gpsLng}
                  onChange={(e) =>
                    updatePointGps(
                      i,
                      'gpsLng',
                      (e.target as HTMLInputElement).value,
                    )
                  }
                />
              </div>
            </div>
          ))}

          <button
            onClick={handleCompute}
            disabled={points.length !== 4 || saveMut.isPending}
            className="mb-6 mt-2 w-full rounded bg-[#8B6914] py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {saveMut.isPending ? (
              <LoadingSpinner className="py-0" />
            ) : (
              'Compute & Save'
            )}
          </button>

          {computedMatrix && (
            <div className="mb-4 rounded border border-[#27AE60]/30 bg-[#27AE60]/10 p-3 text-xs">
              <p className="font-semibold text-[#3D2B1F]">
                Calibration saved
              </p>
              <p className="mt-1 font-mono text-[#3D2B1F]/70">
                a={computedMatrix.a.toFixed(2)} b={computedMatrix.b.toFixed(2)}{' '}
                tx={computedMatrix.tx.toFixed(2)}
                <br />
                c={computedMatrix.c.toFixed(2)} d={computedMatrix.d.toFixed(2)}{' '}
                ty={computedMatrix.ty.toFixed(2)}
              </p>
            </div>
          )}

          <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
            Test Calibration
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Test Lat"
              type="number"
              step="0.000001"
              value={testLat}
              onChange={(e) =>
                setTestLat((e.target as HTMLInputElement).value)
              }
            />
            <FormField
              label="Test Lng"
              type="number"
              step="0.000001"
              value={testLng}
              onChange={(e) =>
                setTestLng((e.target as HTMLInputElement).value)
              }
            />
          </div>
          <button
            onClick={handleTest}
            disabled={!computedMatrix}
            className="mt-2 w-full rounded border border-[#8B6914] py-2 text-sm text-[#8B6914] hover:bg-[#8B6914]/10 disabled:opacity-50"
          >
            Test
          </button>
          {testResult && (
            <p className="mt-2 text-sm text-[#3D2B1F]">
              Pixel: ({Math.round(testResult.x)}, {Math.round(testResult.y)})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
