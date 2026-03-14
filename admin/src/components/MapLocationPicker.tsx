import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMapConfig } from '@/api/map';
import { gpsToPixel, pixelToGps } from '@/utils/affineTransform';
import type { AffineMatrix } from '@/types';

const MAP_FULL_WIDTH = 1920;
const MAP_FULL_HEIGHT = 1080;
const DISPLAY_WIDTH = 640;
const SCALE = DISPLAY_WIDTH / MAP_FULL_WIDTH;
const DISPLAY_HEIGHT = MAP_FULL_HEIGHT * SCALE;

interface MapLocationPickerProps {
  lat: number;
  lng: number;
  geofenceRadius: number;
  onCoordinateChange: (lat: number, lng: number) => void;
}

export function MapLocationPicker({
  lat,
  lng,
  geofenceRadius,
  onCoordinateChange,
}: MapLocationPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { data: mapConfig, isLoading } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: getMapConfig,
    staleTime: 5 * 60 * 1000,
  });

  const matrix = mapConfig?.transformMatrix ?? null;

  // Load the map image
  useEffect(() => {
    if (!mapConfig?.mapImageUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = mapConfig.mapImageUrl;
  }, [mapConfig?.mapImageUrl]);

  // Compute marker pixel position from GPS
  const getMarkerPixel = useCallback(
    (m: AffineMatrix) => {
      if (lat === 0 && lng === 0) return null;
      const p = gpsToPixel(lat, lng, m);
      return { x: p.x * SCALE, y: p.y * SCALE };
    },
    [lat, lng],
  );

  // Approximate meters-to-pixels scale using the transform matrix
  const getRadiusPixels = useCallback(
    (m: AffineMatrix) => {
      // Compute how many pixels correspond to a small GPS delta
      // Use the Jacobian: approximate scale as average of x and y scale factors
      const scaleX = Math.sqrt(m.a * m.a + m.c * m.c);
      const scaleY = Math.sqrt(m.b * m.b + m.d * m.d);
      const avgScale = (scaleX + scaleY) / 2;
      // 1 degree of latitude ~ 111,320 meters
      const metersPerDegree = 111320;
      const pixelsPerMeter = avgScale / metersPerDegree;
      return geofenceRadius * pixelsPerMeter * SCALE;
    },
    [geofenceRadius],
  );

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !matrix) return;

    ctx.clearRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

    if (imageLoaded && imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    } else {
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
      ctx.fillStyle = '#3D2B1F';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading map...', DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2);
    }

    const marker = getMarkerPixel(matrix);
    if (!marker) return;

    // Draw geofence circle
    const radiusPx = getRadiusPixels(matrix);
    if (radiusPx > 0) {
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, radiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139, 105, 20, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(212, 168, 67, 0.15)';
      ctx.fill();
    }

    // Draw marker pin
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#8B6914';
    ctx.fill();
    ctx.strokeStyle = '#3D2B1F';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#F5EACB';
    ctx.fill();
  }, [imageLoaded, matrix, lat, lng, geofenceRadius, getMarkerPixel, getRadiusPixels]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!matrix) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Scale up to actual map pixels
      const mapX = cssX / SCALE;
      const mapY = cssY / SCALE;

      const gps = pixelToGps(mapX, mapY, matrix);
      onCoordinateChange(
        parseFloat(gps.lat.toFixed(6)),
        parseFloat(gps.lng.toFixed(6)),
      );
    },
    [matrix, onCoordinateChange],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!matrix) return;
      const marker = getMarkerPixel(matrix);
      if (!marker) {
        handleCanvasClick(e);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const dist = Math.sqrt((cssX - marker.x) ** 2 + (cssY - marker.y) ** 2);

      if (dist < 16) {
        setDragging(true);
      } else {
        handleCanvasClick(e);
      }
    },
    [matrix, getMarkerPixel, handleCanvasClick],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging || !matrix) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      const mapX = cssX / SCALE;
      const mapY = cssY / SCALE;

      const gps = pixelToGps(mapX, mapY, matrix);
      onCoordinateChange(
        parseFloat(gps.lat.toFixed(6)),
        parseFloat(gps.lng.toFixed(6)),
      );
    },
    [dragging, matrix, onCoordinateChange],
  );

  const handleCanvasMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (isLoading) {
    return (
      <div className="mb-3 flex h-20 items-center justify-center rounded border border-[#8B6914]/30 bg-white">
        <span className="text-sm text-[#3D2B1F]/60">Loading map calibration...</span>
      </div>
    );
  }

  if (!mapConfig || !matrix) {
    return (
      <div className="mb-3 rounded border border-[#8B6914]/30 bg-white p-4">
        <p className="text-sm text-[#3D2B1F]/70">
          No map calibration found. Please set up map calibration first.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
        Location on Map
      </label>
      <div className="overflow-hidden rounded border border-[#8B6914]/30">
        <canvas
          ref={canvasRef}
          width={DISPLAY_WIDTH}
          height={DISPLAY_HEIGHT}
          style={{ width: '100%', height: 'auto', cursor: dragging ? 'grabbing' : 'crosshair' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>
      {lat !== 0 || lng !== 0 ? (
        <p className="mt-1 text-xs text-[#3D2B1F]/60">
          Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
        </p>
      ) : (
        <p className="mt-1 text-xs text-[#3D2B1F]/60">
          Click on the map to set location
        </p>
      )}
    </div>
  );
}
