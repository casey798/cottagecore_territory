import { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LocationsPage } from '@/pages/LocationsPage';
import { RosterPage } from '@/pages/RosterPage';
import { MapCalibrationPage } from '@/pages/MapCalibrationPage';
import { DailyConfigPage } from '@/pages/DailyConfigPage';
import { QRGeneratorPage } from '@/pages/QRGeneratorPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { UsersPage } from '@/pages/UsersPage';
import { SeasonPage } from '@/pages/SeasonPage';

const GOOGLE_CLIENT_ID =
  '425457815141-c7qp4l9sjkn5fgcv9t3odnu83j4nd3nh.apps.googleusercontent.com';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#3D2B1F' }}>
          <h1 style={{ color: '#C0392B' }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>
            {this.state.error.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.href = '/login';
            }}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#8B6914',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Go to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedLayout>
                  <DashboardPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/locations"
              element={
                <ProtectedLayout>
                  <LocationsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/roster"
              element={
                <ProtectedLayout>
                  <RosterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/map-calibration"
              element={
                <ProtectedLayout>
                  <MapCalibrationPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/daily-config"
              element={
                <ProtectedLayout>
                  <DailyConfigPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/qr-generator"
              element={
                <ProtectedLayout>
                  <QRGeneratorPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedLayout>
                  <NotificationsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedLayout>
                  <AnalyticsPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedLayout>
                  <UsersPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/season"
              element={
                <ProtectedLayout>
                  <SeasonPage />
                </ProtectedLayout>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </BrowserRouter>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}
