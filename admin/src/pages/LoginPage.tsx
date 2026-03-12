import { useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuthStore } from '@/store/useAuthStore';
import { ErrorAlert } from '@/components/ErrorAlert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BASE_URL } from '@/constants/api';

export function LoginPage() {
  const { isLoading, error, clearError, login, setError, setLoading } =
    useAuthStore();
  const navigate = useNavigate();

  async function handleGoogleSuccess(response: CredentialResponse) {
    const credential = response.credential;
    if (!credential) {
      setError('No credential received from Google');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/admin/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === 'NOT_ADMIN') {
          setError('You are not authorized to access the admin dashboard');
        } else {
          setError(data.error?.message || 'Login failed');
        }
        return;
      }

      login(data.data.token, data.data.email);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Login failed. Please try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5EACB]">
      <div className="w-full max-w-sm rounded-lg border border-[#8B6914]/20 bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#3D2B1F]">
          GroveWars Admin
        </h1>
        <p className="mb-6 text-center text-sm text-[#3D2B1F]/60">
          Sign in with your admin Google account
        </p>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onDismiss={clearError} />
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Sign-In failed')}
              size="large"
              width="320"
              text="signin_with"
            />
          </div>
        )}
      </div>
    </div>
  );
}
