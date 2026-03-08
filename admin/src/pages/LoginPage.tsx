import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ErrorAlert } from '@/components/ErrorAlert';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const { initiateAuth, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await initiateAuth(email);
      navigate('/verify', { state: { email } });
    } catch {
      // error is set in store
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5EACB]">
      <div className="w-full max-w-sm rounded-lg border border-[#8B6914]/20 bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#3D2B1F]">
          GroveWars Admin
        </h1>
        <p className="mb-6 text-center text-sm text-[#3D2B1F]/60">
          Sign in with your admin email
        </p>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onDismiss={clearError} />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@college.edu"
            required
            className="mb-4 w-full rounded border border-[#8B6914]/30 px-3 py-2 text-sm focus:border-[#D4A843] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full rounded bg-[#8B6914] py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {isLoading ? <LoadingSpinner className="py-0" /> : 'Send Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
