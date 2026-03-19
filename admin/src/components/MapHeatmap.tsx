import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMapConfig } from '@/api/map';

const MAP_FULL_WIDTH = 1920;
const MAP_FULL_HEIGHT = 1080;

export interface HeatmapPoint {
  locationId: string;
  name: string;
  x: number;
  y: number;
  value: number;
  maxValue: number;
  color: string;
  tooltip: string;
}

interface MapHeatmapProps {
  locations: HeatmapPoint[];
  title: string;
  showLegend?: boolean;
}

export function MapHeatmap({ locations, title, showLegend }: MapHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data: mapConfig } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: getMapConfig,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!mapConfig?.mapImageUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = mapConfig.mapImageUrl;
  }, [mapConfig?.mapImageUrl]);

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [updateWidth]);

  if (!mapConfig?.mapImageUrl) {
    return (
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">{title}</h3>
        <p className="py-8 text-center text-sm text-[#3D2B1F]/40">Map not configured</p>
      </div>
    );
  }

  const scale = containerWidth > 0 ? containerWidth / MAP_FULL_WIDTH : 0;
  const displayHeight = MAP_FULL_HEIGHT * scale;

  const hoveredPoint = locations.find((l) => l.locationId === hoveredId);

  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">{title}</h3>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded border border-[#8B6914]/15"
        style={{ height: displayHeight || 300 }}
      >
        {imageLoaded && imgRef.current ? (
          <img
            src={mapConfig.mapImageUrl}
            alt="Campus map"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-[#E8DDB8]"
            style={{ width: '100%', height: displayHeight || 300 }}
          >
            <span className="text-sm text-[#3D2B1F]/40">Loading map...</span>
          </div>
        )}

        {/* Overlay circles */}
        {imageLoaded && scale > 0 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: displayHeight,
              pointerEvents: 'none',
            }}
            viewBox={`0 0 ${containerWidth} ${displayHeight}`}
          >
            {locations.map((loc) => {
              const cx = loc.x * scale;
              const cy = loc.y * scale;
              const r = loc.value === 0
                ? 4
                : 8 + (loc.maxValue > 0 ? (loc.value / loc.maxValue) * 22 : 0);

              return (
                <circle
                  key={loc.locationId}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={loc.color}
                  fillOpacity={0.6}
                  stroke={loc.color}
                  strokeWidth={2}
                  strokeOpacity={1}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setHoveredId(loc.locationId);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }
                  }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                />
              );
            })}
          </svg>
        )}

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded bg-[#3D2B1F] px-3 py-2 text-xs text-white shadow-lg"
            style={{
              left: Math.min(mousePos.x + 12, containerWidth - 200),
              top: mousePos.y - 40,
            }}
          >
            <div className="font-bold">{hoveredPoint.name}</div>
            <div className="mt-0.5 whitespace-pre-line opacity-80">{hoveredPoint.tooltip}</div>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#3D2B1F]/60">
          <span>Low</span>
          <div className="h-2 w-24 rounded-full bg-gradient-to-r from-[#95A5A6] to-[#27AE60]" />
          <span>High</span>
          <span className="ml-4">Circle size = visit count</span>
        </div>
      )}
    </div>
  );
}
