import type { LocationMasterConfig } from '@/types';
import { MAP_WIDTH, MAP_HEIGHT } from '@/constants/map';

function locationHasPixel(loc: LocationMasterConfig): boolean {
  return loc.mapPixelX !== 0 || loc.mapPixelY !== 0;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load map image'));
    img.src = url;
  });
}

export async function exportLocationsMap(
  locations: LocationMasterConfig[],
  mapImageUrl: string,
): Promise<void> {
  // 1. Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // 2. Draw campus map background
  const img = await loadImage(mapImageUrl);
  ctx.drawImage(img, 0, 0, MAP_WIDTH, MAP_HEIGHT);

  // 3. Sort alphabetically and assign 1-based indexes
  const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name));

  // 4. Draw pins using stored mapPixelX / mapPixelY
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < sorted.length; i++) {
    const loc = sorted[i];
    if (!locationHasPixel(loc)) continue;

    const x = loc.mapPixelX;
    const y = loc.mapPixelY;
    const outerColor = loc.active ? '#3D2B1F' : 'rgba(100,100,100,0.7)';

    // Outer filled circle
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = outerColor;
    ctx.fill();

    // Inner parchment circle
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#F5EACB';
    ctx.fill();

    // Index number
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#3D2B1F';
    ctx.fillText(String(i + 1), x, y);
  }

  // 5. Draw legend box (bottom-right)
  const PAD = 12;
  const ENTRY_H = 18;
  const TITLE_H = 28;
  const KEY_H = 30;
  const COL_GAP = 24;
  const MAX_COL_W = 480;
  const LEGEND_MARGIN = 20;

  const twoColumns = sorted.length > 15;
  const midpoint = twoColumns ? Math.ceil(sorted.length / 2) : sorted.length;
  const col1Items = sorted.slice(0, midpoint);
  const col2Items = twoColumns ? sorted.slice(midpoint) : [];

  function entryLabel(idx: number, loc: LocationMasterConfig): string {
    return `${idx}. ${loc.name}${!locationHasPixel(loc) ? ' (no position)' : ''}`;
  }

  // Measure column widths
  ctx.font = '13px sans-serif';
  let col1W = 0;
  for (let i = 0; i < col1Items.length; i++) {
    col1W = Math.max(col1W, ctx.measureText(entryLabel(i + 1, col1Items[i])).width);
  }
  col1W = Math.min(col1W, MAX_COL_W);

  let col2W = 0;
  for (let i = 0; i < col2Items.length; i++) {
    col2W = Math.max(col2W, ctx.measureText(entryLabel(midpoint + i + 1, col2Items[i])).width);
  }
  col2W = Math.min(col2W, MAX_COL_W);

  ctx.font = 'bold 18px sans-serif';
  const titleW = ctx.measureText('Locations').width;

  const innerW = twoColumns
    ? Math.max(titleW, col1W + COL_GAP + col2W)
    : Math.max(titleW, col1W);
  const boxW = PAD * 2 + innerW;
  const maxColRows = Math.max(col1Items.length, col2Items.length);
  const boxH = PAD + TITLE_H + maxColRows * ENTRY_H + KEY_H + PAD;

  const boxX = MAP_WIDTH - LEGEND_MARGIN - boxW;
  const boxY = MAP_HEIGHT - LEGEND_MARGIN - boxH;

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // Title
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#3D2B1F';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Locations', boxX + PAD, boxY + PAD);

  // Entries - column 1
  ctx.font = '13px sans-serif';
  const entryStartY = boxY + PAD + TITLE_H;
  for (let i = 0; i < col1Items.length; i++) {
    const loc = col1Items[i];
    ctx.fillStyle = loc.active ? '#3D2B1F' : '#888888';
    ctx.fillText(entryLabel(i + 1, loc), boxX + PAD, entryStartY + i * ENTRY_H);
  }

  // Entries - column 2
  if (twoColumns) {
    const col2X = boxX + PAD + col1W + COL_GAP;
    for (let i = 0; i < col2Items.length; i++) {
      const loc = col2Items[i];
      ctx.fillStyle = loc.active ? '#3D2B1F' : '#888888';
      ctx.fillText(entryLabel(midpoint + i + 1, loc), col2X, entryStartY + i * ENTRY_H);
    }
  }

  // Legend key at the bottom of the box
  const keyY = boxY + PAD + TITLE_H + maxColRows * ENTRY_H + 6;
  ctx.textBaseline = 'middle';

  // Active key
  ctx.beginPath();
  ctx.arc(boxX + PAD + 7, keyY + KEY_H / 2 - 8, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#3D2B1F';
  ctx.fill();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#3D2B1F';
  ctx.fillText('Active', boxX + PAD + 18, keyY + KEY_H / 2 - 8);

  // Inactive key
  ctx.beginPath();
  ctx.arc(boxX + PAD + 7, keyY + KEY_H / 2 + 8, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(100,100,100,0.7)';
  ctx.fill();
  ctx.fillStyle = '#888888';
  ctx.fillText('Inactive', boxX + PAD + 18, keyY + KEY_H / 2 + 8);

  // 6. Draw title bar at the top
  const TITLE_BAR_H = 44;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, MAP_WIDTH, TITLE_BAR_H);

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('GroveWars \u2014 Campus Locations', 20, TITLE_BAR_H / 2);

  const dateStr = todayDateString();
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, MAP_WIDTH - 20, TITLE_BAR_H / 2);

  // 7. Trigger download
  const filename = `grovewars-locations-${dateStr}.png`;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
