import {
  computeAffineTransform,
  gpsToPixel,
  pixelToGps,
} from '../affineTransform';
import { CalibrationPoint } from '@/types';

describe('affineTransform', () => {
  const calibrationPoints: CalibrationPoint[] = [
    { gpsLat: 13.0100, gpsLng: 80.2300, pixelX: 100, pixelY: 100 },
    { gpsLat: 13.0100, gpsLng: 80.2400, pixelX: 1900, pixelY: 100 },
    { gpsLat: 13.0200, gpsLng: 80.2300, pixelX: 100, pixelY: 1000 },
    { gpsLat: 13.0200, gpsLng: 80.2400, pixelX: 1900, pixelY: 1000 },
  ];

  const matrix = computeAffineTransform(calibrationPoints);

  it('should compute a valid affine matrix', () => {
    expect(matrix).toHaveProperty('a');
    expect(matrix).toHaveProperty('b');
    expect(matrix).toHaveProperty('c');
    expect(matrix).toHaveProperty('d');
    expect(matrix).toHaveProperty('tx');
    expect(matrix).toHaveProperty('ty');
  });

  it('should transform calibration points accurately', () => {
    for (const p of calibrationPoints) {
      const pixel = gpsToPixel(p.gpsLat, p.gpsLng, matrix);
      expect(pixel.x).toBeCloseTo(p.pixelX, 0);
      expect(pixel.y).toBeCloseTo(p.pixelY, 0);
    }
  });

  it('should round-trip GPS -> pixel -> GPS accurately', () => {
    const testLat = 13.015;
    const testLng = 80.235;
    const pixel = gpsToPixel(testLat, testLng, matrix);
    const gps = pixelToGps(pixel.x, pixel.y, matrix);
    expect(gps.lat).toBeCloseTo(testLat, 4);
    expect(gps.lng).toBeCloseTo(testLng, 4);
  });
});
