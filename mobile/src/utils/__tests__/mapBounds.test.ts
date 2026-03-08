import { isWithinMapBounds, getEdgeIndicator } from '../mapBounds';

const MAP_W = 2000;
const MAP_H = 1125;

describe('isWithinMapBounds', () => {
  it('returns true for a position in the center', () => {
    expect(isWithinMapBounds({ x: 1000, y: 500 }, MAP_W, MAP_H)).toBe(true);
  });

  it('returns true for position just inside margin', () => {
    expect(isWithinMapBounds({ x: 16, y: 16 }, MAP_W, MAP_H)).toBe(true);
    expect(isWithinMapBounds({ x: MAP_W - 16, y: MAP_H - 16 }, MAP_W, MAP_H)).toBe(true);
  });

  it('returns false for position outside left edge', () => {
    expect(isWithinMapBounds({ x: -50, y: 500 }, MAP_W, MAP_H)).toBe(false);
  });

  it('returns false for position outside right edge', () => {
    expect(isWithinMapBounds({ x: MAP_W + 100, y: 500 }, MAP_W, MAP_H)).toBe(false);
  });

  it('returns false for position outside top edge', () => {
    expect(isWithinMapBounds({ x: 500, y: -30 }, MAP_W, MAP_H)).toBe(false);
  });

  it('returns false for position outside bottom edge', () => {
    expect(isWithinMapBounds({ x: 500, y: MAP_H + 50 }, MAP_W, MAP_H)).toBe(false);
  });

  it('returns false for position within margin zone', () => {
    expect(isWithinMapBounds({ x: 10, y: 500 }, MAP_W, MAP_H)).toBe(false);
  });

  it('respects custom margin', () => {
    expect(isWithinMapBounds({ x: 10, y: 500 }, MAP_W, MAP_H, 5)).toBe(true);
  });
});

describe('getEdgeIndicator', () => {
  it('places arrow on left edge when player is far left', () => {
    const result = getEdgeIndicator({ x: -200, y: 500 }, MAP_W, MAP_H);
    expect(result.edgeX).toBe(20); // edgeMargin default
    expect(result.edgeY).toBe(500);
    // Angle should point left (roughly 180°)
    expect(result.angleDeg).toBeCloseTo(180, -1);
  });

  it('places arrow on right edge when player is far right', () => {
    const result = getEdgeIndicator({ x: MAP_W + 300, y: 500 }, MAP_W, MAP_H);
    expect(result.edgeX).toBe(MAP_W - 20);
    expect(result.edgeY).toBe(500);
    // Angle should point right (roughly 0°)
    expect(result.angleDeg).toBeCloseTo(0, -1);
  });

  it('places arrow on top edge when player is above', () => {
    const result = getEdgeIndicator({ x: 1000, y: -100 }, MAP_W, MAP_H);
    expect(result.edgeX).toBe(1000);
    expect(result.edgeY).toBe(20);
    // Angle should point up (roughly -90°)
    expect(result.angleDeg).toBeCloseTo(-90, -1);
  });

  it('places arrow on bottom edge when player is below', () => {
    const result = getEdgeIndicator({ x: 1000, y: MAP_H + 200 }, MAP_W, MAP_H);
    expect(result.edgeX).toBe(1000);
    expect(result.edgeY).toBe(MAP_H - 20);
    // Angle should point down (roughly 90°)
    expect(result.angleDeg).toBeCloseTo(90, -1);
  });

  it('handles corner case (top-left)', () => {
    const result = getEdgeIndicator({ x: -100, y: -100 }, MAP_W, MAP_H);
    // Should clamp to corner area with margin
    expect(result.edgeX).toBe(20);
    expect(result.edgeY).toBeLessThanOrEqual(20);
  });

  it('respects custom edgeMargin', () => {
    const result = getEdgeIndicator({ x: -200, y: 500 }, MAP_W, MAP_H, 40);
    expect(result.edgeX).toBe(40);
  });
});
