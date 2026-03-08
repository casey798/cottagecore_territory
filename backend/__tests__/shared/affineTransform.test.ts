import {
  computeAffineTransform,
  gpsToPixel,
  pixelToGps,
} from '../../shared/affineTransform';
import { CalibrationPoint, AffineMatrix } from '../../shared/types';

describe('Affine Transform Utilities', () => {
  // Campus-like calibration scenario
  // Point 1: (13.010, 80.230) -> (200, 100)
  // Point 2: (13.015, 80.230) -> (200, 600)
  // Point 3: (13.010, 80.235) -> (1800, 100)
  // Point 4: (13.015, 80.235) -> (1800, 600)
  const calibrationPoints: CalibrationPoint[] = [
    { gpsLat: 13.010, gpsLng: 80.230, pixelX: 200, pixelY: 100 },
    { gpsLat: 13.015, gpsLng: 80.230, pixelX: 200, pixelY: 600 },
    { gpsLat: 13.010, gpsLng: 80.235, pixelX: 1800, pixelY: 100 },
    { gpsLat: 13.015, gpsLng: 80.235, pixelX: 1800, pixelY: 600 },
  ];

  let matrix: AffineMatrix;

  beforeAll(() => {
    matrix = computeAffineTransform(calibrationPoints);
  });

  describe('computeAffineTransform', () => {
    it('computes a valid affine matrix from 4 calibration points', () => {
      expect(matrix).toHaveProperty('a');
      expect(matrix).toHaveProperty('b');
      expect(matrix).toHaveProperty('tx');
      expect(matrix).toHaveProperty('c');
      expect(matrix).toHaveProperty('d');
      expect(matrix).toHaveProperty('ty');

      expect(typeof matrix.a).toBe('number');
      expect(typeof matrix.b).toBe('number');
      expect(typeof matrix.tx).toBe('number');
      expect(typeof matrix.c).toBe('number');
      expect(typeof matrix.d).toBe('number');
      expect(typeof matrix.ty).toBe('number');
    });

    it('throws when fewer than 3 points are provided', () => {
      const twoPoints = calibrationPoints.slice(0, 2);
      expect(() => computeAffineTransform(twoPoints)).toThrow(
        'At least 3 calibration points required'
      );
    });

    it('throws for 0 points', () => {
      expect(() => computeAffineTransform([])).toThrow(
        'At least 3 calibration points required'
      );
    });

    it('accepts exactly 3 points without throwing', () => {
      const threePoints = calibrationPoints.slice(0, 3);
      expect(() => computeAffineTransform(threePoints)).not.toThrow();
    });
  });

  describe('gpsToPixel', () => {
    it('converts calibration point 1 GPS to expected pixel coordinates', () => {
      const pixel = gpsToPixel(13.010, 80.230, matrix);
      expect(pixel.x).toBeCloseTo(200, 0);
      expect(pixel.y).toBeCloseTo(100, 0);
    });

    it('converts calibration point 2 GPS to expected pixel coordinates', () => {
      const pixel = gpsToPixel(13.015, 80.230, matrix);
      expect(pixel.x).toBeCloseTo(200, 0);
      expect(pixel.y).toBeCloseTo(600, 0);
    });

    it('converts calibration point 3 GPS to expected pixel coordinates', () => {
      const pixel = gpsToPixel(13.010, 80.235, matrix);
      expect(pixel.x).toBeCloseTo(1800, 0);
      expect(pixel.y).toBeCloseTo(100, 0);
    });

    it('converts calibration point 4 GPS to expected pixel coordinates', () => {
      const pixel = gpsToPixel(13.015, 80.235, matrix);
      expect(pixel.x).toBeCloseTo(1800, 0);
      expect(pixel.y).toBeCloseTo(600, 0);
    });

    it('converts a midpoint GPS to midpoint pixel', () => {
      const midLat = (13.010 + 13.015) / 2;
      const midLng = (80.230 + 80.235) / 2;
      const pixel = gpsToPixel(midLat, midLng, matrix);
      expect(pixel.x).toBeCloseTo(1000, 0);
      expect(pixel.y).toBeCloseTo(350, 0);
    });
  });

  describe('pixelToGps', () => {
    it('converts pixel (200, 100) back to GPS point 1', () => {
      const gps = pixelToGps(200, 100, matrix);
      expect(gps.lat).toBeCloseTo(13.010, 4);
      expect(gps.lng).toBeCloseTo(80.230, 4);
    });

    it('converts pixel (200, 600) back to GPS point 2', () => {
      const gps = pixelToGps(200, 600, matrix);
      expect(gps.lat).toBeCloseTo(13.015, 4);
      expect(gps.lng).toBeCloseTo(80.230, 4);
    });

    it('converts pixel (1800, 100) back to GPS point 3', () => {
      const gps = pixelToGps(1800, 100, matrix);
      expect(gps.lat).toBeCloseTo(13.010, 4);
      expect(gps.lng).toBeCloseTo(80.235, 4);
    });

    it('converts pixel (1800, 600) back to GPS point 4', () => {
      const gps = pixelToGps(1800, 600, matrix);
      expect(gps.lat).toBeCloseTo(13.015, 4);
      expect(gps.lng).toBeCloseTo(80.235, 4);
    });
  });

  describe('round-trip: GPS -> pixel -> GPS', () => {
    const testPoints = [
      { lat: 13.010, lng: 80.230, label: 'calibration point 1' },
      { lat: 13.015, lng: 80.235, label: 'calibration point 4' },
      { lat: 13.0125, lng: 80.2325, label: 'midpoint' },
      { lat: 13.011, lng: 80.231, label: 'arbitrary interior point' },
    ];

    testPoints.forEach(({ lat, lng, label }) => {
      it(`round-trips correctly for ${label} (${lat}, ${lng})`, () => {
        const pixel = gpsToPixel(lat, lng, matrix);
        const gps = pixelToGps(pixel.x, pixel.y, matrix);

        expect(gps.lat).toBeCloseTo(lat, 4);
        expect(gps.lng).toBeCloseTo(lng, 4);
      });
    });
  });

  describe('round-trip: pixel -> GPS -> pixel', () => {
    const testPixels = [
      { x: 200, y: 100, label: 'top-left' },
      { x: 1800, y: 600, label: 'bottom-right' },
      { x: 1000, y: 350, label: 'center' },
      { x: 500, y: 250, label: 'arbitrary point' },
    ];

    testPixels.forEach(({ x, y, label }) => {
      it(`round-trips correctly for pixel ${label} (${x}, ${y})`, () => {
        const gps = pixelToGps(x, y, matrix);
        const pixel = gpsToPixel(gps.lat, gps.lng, matrix);

        expect(pixel.x).toBeCloseTo(x, 4);
        expect(pixel.y).toBeCloseTo(y, 4);
      });
    });
  });
});
