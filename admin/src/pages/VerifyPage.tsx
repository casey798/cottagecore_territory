import { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ErrorAlert } from '@/components/ErrorAlert';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function VerifyPage() {
  const [code, setCode] = useState('');
  const { verifyCode, initiateAuth, isLoading, error, clearError, email } =
    useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const stateEmail = (location.state as { email?: string })?.email;

  if (!email && !stateEmail) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await verifyCode(code);
      navigate('/dashboard', { replace: true });
    } catch {
      // error is set in store
    }
  }

  async function handleResend() {
    const targetEmail = email || stateEmail;
    if (targetEmail) {
      try {
        await initiateAuth(targetEmail);
      } catch {
        // error is set in store
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5EACB]">
      <div className="w-full max-w-sm rounded-lg border border-[#8B6914]/20 bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#3D2B1F]">
          Verify Code
        </h1>
        <p className="mb-6 text-center text-sm text-[#3D2B1F]/60">
          Enter the 6-digit code sent to {email || stateEmail}
        </p>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onDismiss={clearError} />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="000000"
            maxLength={6}
            className="mb-4 w-full rounded border border-[#8B6914]/30 px-3 py-2 text-center text-2xl tracking-[0.5em] focus:border-[#D4A843] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="mb-3 w-full rounded bg-[#8B6914] py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {isLoading ? <LoadingSpinner className="py-0" /> : 'Verify'}
          </button>
        </form>
        <button
          onClick={handleResend}
          disabled={isLoading}
          className="w-full text-sm text-[#8B6914] hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}
