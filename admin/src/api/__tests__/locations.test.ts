import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../locations';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock auth store to provide a token
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      token: 'test-token',
      refreshSession: vi.fn(),
      logout: vi.fn(),
    }),
  },
}));

function mockResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    json: async () => (ok ? { success: true, data } : { success: false, error: { message: 'Error' } }),
  });
}

describe('locations API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('getLocations returns locations array', async () => {
    const locations = [
      {
        locationId: '1',
        name: 'North Garden',
        gpsLat: 13.01,
        gpsLng: 80.23,
        geofenceRadius: 15,
        category: 'garden',
        active: true,
        chestDropModifier: 1.0,
      },
    ];
    mockResponse({ locations });
    const result = await getLocations();
    expect(result).toEqual(locations);
  });

  it('createLocation sends POST with location data', async () => {
    const newLoc = {
      name: 'Test',
      gpsLat: 13.01,
      gpsLng: 80.23,
      geofenceRadius: 15,
      category: 'garden' as const,
      active: true,
      chestDropModifier: 1.0,
    };
    mockResponse({ ...newLoc, locationId: '2' });
    const result = await createLocation(newLoc);
    expect(result.locationId).toBe('2');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
  });

  it('updateLocation sends PUT', async () => {
    mockResponse({ locationId: '1', name: 'Updated' });
    await updateLocation('1', { name: 'Updated' });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('PUT');
  });

  it('deleteLocation sends DELETE', async () => {
    mockResponse({});
    await deleteLocation('1');
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });
});
