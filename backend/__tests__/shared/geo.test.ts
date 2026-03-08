import { isWithinGeofence, haversineDistance } from '../../shared/geo';

describe('Geo Utilities', () => {
  // Chennai campus area coordinates
  const CAMPUS_LAT = 13.0;
  const CAMPUS_LNG = 80.2;

  describe('isWithinGeofence', () => {
    it('returns true when player is at the same point (distance 0)', () => {
      expect(
        isWithinGeofence(CAMPUS_LAT, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 50)
      ).toBe(true);
    });

    it('returns true when player is within radius', () => {
      // ~111 meters per 0.001 degrees of latitude at this latitude
      const playerLat = CAMPUS_LAT + 0.0003; // approx 33 meters north
      expect(
        isWithinGeofence(playerLat, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 50)
      ).toBe(true);
    });

    it('returns true when player is exactly on the boundary (distance === radius)', () => {
      // Calculate a point at a known distance
      const distance = haversineDistance(CAMPUS_LAT, CAMPUS_LNG, CAMPUS_LAT + 0.001, CAMPUS_LNG);
      expect(
        isWithinGeofence(CAMPUS_LAT + 0.001, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, distance)
      ).toBe(true);
    });

    it('returns false when player is outside radius', () => {
      // ~555 meters north (0.005 degrees lat)
      const playerLat = CAMPUS_LAT + 0.005;
      expect(
        isWithinGeofence(playerLat, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 50)
      ).toBe(false);
    });

    it('correctly handles known GPS coordinates with known distances (Chennai area)', () => {
      // Two points ~111m apart (0.001 deg lat difference at lat 13)
      const pointA = { lat: 13.0, lng: 80.2 };
      const pointB = { lat: 13.001, lng: 80.2 };

      const dist = haversineDistance(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
      // 0.001 deg lat ~ 111 meters
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(120);

      // Within 150m -> true
      expect(
        isWithinGeofence(pointB.lat, pointB.lng, pointA.lat, pointA.lng, 150)
      ).toBe(true);

      // Within 50m -> false
      expect(
        isWithinGeofence(pointB.lat, pointB.lng, pointA.lat, pointA.lng, 50)
      ).toBe(false);
    });

    it('handles very small radius (1 meter)', () => {
      // Same point should still be within 1 meter
      expect(
        isWithinGeofence(CAMPUS_LAT, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 1)
      ).toBe(true);

      // Even a tiny offset should be outside 1 meter
      const tinyOffset = 0.00002; // ~2.2 meters
      expect(
        isWithinGeofence(CAMPUS_LAT + tinyOffset, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 1)
      ).toBe(false);
    });

    it('handles large radius (1000 meters)', () => {
      // 0.005 deg lat ~ 555 meters, should be within 1000m
      const playerLat = CAMPUS_LAT + 0.005;
      expect(
        isWithinGeofence(playerLat, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 1000)
      ).toBe(true);

      // 0.015 deg lat ~ 1665 meters, should be outside 1000m
      const farPlayerLat = CAMPUS_LAT + 0.015;
      expect(
        isWithinGeofence(farPlayerLat, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG, 1000)
      ).toBe(false);
    });

    it('works with longitude offset', () => {
      // Longitude offset at lat 13: ~108m per 0.001 degrees
      const playerLng = CAMPUS_LNG + 0.001;
      const dist = haversineDistance(CAMPUS_LAT, CAMPUS_LNG, CAMPUS_LAT, playerLng);

      expect(dist).toBeGreaterThan(90);
      expect(dist).toBeLessThan(120);

      expect(
        isWithinGeofence(CAMPUS_LAT, playerLng, CAMPUS_LAT, CAMPUS_LNG, 150)
      ).toBe(true);
    });

    it('works with diagonal offset', () => {
      // Both lat and lng offset
      const playerLat = CAMPUS_LAT + 0.0003;
      const playerLng = CAMPUS_LNG + 0.0003;
      const dist = haversineDistance(playerLat, playerLng, CAMPUS_LAT, CAMPUS_LNG);

      // Should be approximately sqrt(33^2 + 32^2) ~ 46 meters
      expect(dist).toBeGreaterThan(30);
      expect(dist).toBeLessThan(70);

      expect(
        isWithinGeofence(playerLat, playerLng, CAMPUS_LAT, CAMPUS_LNG, 100)
      ).toBe(true);
    });
  });

  describe('haversineDistance', () => {
    it('returns 0 for the same point', () => {
      const distance = haversineDistance(CAMPUS_LAT, CAMPUS_LNG, CAMPUS_LAT, CAMPUS_LNG);
      expect(distance).toBe(0);
    });

    it('is symmetric (A to B equals B to A)', () => {
      const d1 = haversineDistance(13.0, 80.2, 13.005, 80.205);
      const d2 = haversineDistance(13.005, 80.205, 13.0, 80.2);
      expect(d1).toBeCloseTo(d2, 6);
    });
  });
});
