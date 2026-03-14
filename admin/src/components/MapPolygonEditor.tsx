import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Cell {
  x: number;
  y: number;
}

export interface PolygonValue {
  polygonPoints: Point[];
  cells: Cell[];
}

interface Props {
  mapImageUrl: string;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  value: PolygonValue;
  onChange: (value: PolygonValue) => void;
  overlayColor?: string;
  readOnly?: boolean;
}

function pointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function computeCells(polygon: Point[], tileSize: number, mapWidth: number, mapHeight: number): Cell[] {
  if (polygon.length < 3) return [];

  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs) / tileSize));
  const maxX = Math.min(Math.floor(mapWidth / tileSize) - 1, Math.floor(Math.max(...xs) / tileSize));
  const minY = Math.max(0, Math.floor(Math.min(...ys) / tileSize));
  const maxY = Math.min(Math.floor(mapHeight / tileSize) - 1, Math.floor(Math.max(...ys) / tileSize));

  const cells: Cell[] = [];
  const halfTile = tileSize / 2;

  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      const cx = gx * tileSize + halfTile;
      const cy = gy * tileSize + halfTile;
      if (pointInPolygon(cx, cy, polygon)) {
        cells.push({ x: gx, y: gy });
      }
    }
  }
  return cells;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function MapPolygonEditor({
  mapImageUrl,
  mapWidth,
  mapHeight,
  tileSize,
  value,
  onChange,
  overlayColor = '#27AE60',
  readOnly = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const polygonClosed = value.polygonPoints.length >= 3 && value.cells.length > 0;

  const scale = containerWidth > 0 ? containerWidth / mapWidth : 1;
  const displayHeight = mapHeight * scale;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const toMap = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): Point => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      return {
        x: Math.round((e.clientX - rect.left) / scale),
        y: Math.round((e.clientY - rect.top) / scale),
      };
    },
    [scale],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly || polygonClosed || draggingIdx !== null) return;
      const pt = toMap(e);
      const pts = value.polygonPoints;

      // Close polygon if clicking near first point
      if (pts.length >= 3) {
        const first = pts[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 15) {
          const cells = computeCells(pts, tileSize, mapWidth, mapHeight);
          onChange({ polygonPoints: pts, cells });
          return;
        }
      }

      onChange({ polygonPoints: [...pts, pt], cells: [] });
    },
    [readOnly, polygonClosed, draggingIdx, toMap, value.polygonPoints, tileSize, mapWidth, mapHeight, onChange],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (readOnly || polygonClosed) return;
      const pts = value.polygonPoints;
      if (pts.length < 3) return;
      const cells = computeCells(pts, tileSize, mapWidth, mapHeight);
      onChange({ polygonPoints: pts, cells });
    },
    [readOnly, polygonClosed, value.polygonPoints, tileSize, mapWidth, mapHeight, onChange],
  );

  const handleMouseDown = useCallback(
    (idx: number, e: React.MouseEvent) => {
      if (readOnly) return;
      e.stopPropagation();
      setDraggingIdx(idx);
    },
    [readOnly],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (draggingIdx === null) return;
      const pt = toMap(e);
      const newPts = [...value.polygonPoints];
      newPts[draggingIdx] = pt;
      if (polygonClosed) {
        const cells = computeCells(newPts, tileSize, mapWidth, mapHeight);
        onChange({ polygonPoints: newPts, cells });
      } else {
        onChange({ polygonPoints: newPts, cells: [] });
      }
    },
    [draggingIdx, toMap, value.polygonPoints, polygonClosed, tileSize, mapWidth, mapHeight, onChange],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  const handleClear = useCallback(() => {
    onChange({ polygonPoints: [], cells: [] });
  }, [onChange]);

  const polylinePoints = useMemo(() => {
    return value.polygonPoints.map((p) => `${p.x * scale},${p.y * scale}`).join(' ');
  }, [value.polygonPoints, scale]);

  const closedPathD = useMemo(() => {
    if (value.polygonPoints.length < 3) return '';
    const pts = value.polygonPoints;
    return (
      `M ${pts[0].x * scale} ${pts[0].y * scale} ` +
      pts
        .slice(1)
        .map((p) => `L ${p.x * scale} ${p.y * scale}`)
        .join(' ') +
      ' Z'
    );
  }, [value.polygonPoints, scale]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {polygonClosed && (
            <span className="rounded bg-[#27AE60]/10 px-2 py-0.5 text-xs font-medium text-[#27AE60]">
              {value.cells.length} cells generated
            </span>
          )}
          {!polygonClosed && value.polygonPoints.length > 0 && (
            <span className="text-xs text-[#3D2B1F]/50">
              {value.polygonPoints.length} points placed — {value.polygonPoints.length < 3 ? 'need at least 3' : 'double-click or click first point to close'}
            </span>
          )}
        </div>
        {!readOnly && value.polygonPoints.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded border border-[#8B6914]/30"
        style={{ height: displayHeight || 'auto' }}
      >
        {containerWidth > 0 && (
          <>
            <img
              src={mapImageUrl}
              alt="Campus map"
              style={{
                width: containerWidth,
                height: displayHeight,
                display: 'block',
              }}
              draggable={false}
            />
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: containerWidth,
                height: displayHeight,
                cursor: readOnly ? 'default' : polygonClosed ? (draggingIdx !== null ? 'grabbing' : 'default') : 'crosshair',
              }}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Closed polygon fill */}
              {polygonClosed && (
                <path
                  d={closedPathD}
                  fill={hexToRgba(overlayColor, 0.2)}
                  stroke={overlayColor}
                  strokeWidth={2}
                />
              )}

              {/* Cell grid overlay */}
              {value.cells.map((cell) => (
                <rect
                  key={`${cell.x}-${cell.y}`}
                  x={cell.x * tileSize * scale}
                  y={cell.y * tileSize * scale}
                  width={tileSize * scale}
                  height={tileSize * scale}
                  fill={hexToRgba(overlayColor, 0.35)}
                />
              ))}

              {/* Open polygon lines */}
              {!polygonClosed && value.polygonPoints.length >= 2 && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={overlayColor}
                  strokeWidth={2}
                />
              )}

              {/* Dashed closing line preview */}
              {!polygonClosed && value.polygonPoints.length >= 3 && (
                <line
                  x1={value.polygonPoints[value.polygonPoints.length - 1].x * scale}
                  y1={value.polygonPoints[value.polygonPoints.length - 1].y * scale}
                  x2={value.polygonPoints[0].x * scale}
                  y2={value.polygonPoints[0].y * scale}
                  stroke={overlayColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              )}

              {/* Vertex dots */}
              {value.polygonPoints.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x * scale}
                  cy={pt.y * scale}
                  r={idx === 0 && !polygonClosed && value.polygonPoints.length >= 3 ? 7 : 5}
                  fill={idx === 0 && !polygonClosed && value.polygonPoints.length >= 3 ? overlayColor : 'white'}
                  stroke={overlayColor}
                  strokeWidth={2}
                  style={{ cursor: readOnly ? 'default' : 'grab' }}
                  onMouseDown={(e) => handleMouseDown(idx, e)}
                />
              ))}
            </svg>
          </>
        )}
      </div>
    </div>
  );
}
