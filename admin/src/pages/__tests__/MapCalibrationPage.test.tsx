import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MapCalibrationPage } from '../MapCalibrationPage';

vi.mock('@/api/map', () => ({
  getMapConfig: vi.fn().mockResolvedValue({
    mapImageUrl: null,
    mapWidth: 2000,
    mapHeight: 1125,
    tileSize: 32,
    transformMatrix: { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 },
  }),
  uploadCalibration: vi.fn().mockResolvedValue({ calibrationId: 'test' }),
  getMapUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'http://example.com',
    key: 'maps/test.png',
  }),
}));

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        isAuthenticated: true,
        token: 'test',
        email: 'admin@test.com',
        logout: vi.fn(),
      }),
    {
      getState: () => ({
        isAuthenticated: true,
        token: 'test',
        email: 'admin@test.com',
        logout: vi.fn(),
        refreshSession: vi.fn(),
      }),
    },
  ),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <MapCalibrationPage />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('MapCalibrationPage', () => {
  it('renders the page title', () => {
    renderPage();
    expect(screen.getByText('Map Calibration')).toBeInTheDocument();
  });

  it('shows upload button', () => {
    renderPage();
    expect(screen.getByText('Upload Campus PNG')).toBeInTheDocument();
  });

  it('shows no points message initially', () => {
    renderPage();
    expect(
      screen.getByText(/No points placed yet/),
    ).toBeInTheDocument();
  });

  it('compute button is disabled without 4 points', () => {
    renderPage();
    const btn = screen.getByText('Compute & Save');
    expect(btn).toBeDisabled();
  });

  it('test button is disabled without calibration', () => {
    renderPage();
    const btn = screen.getByText('Test');
    expect(btn).toBeDisabled();
  });
});
