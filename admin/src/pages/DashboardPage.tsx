import { useQuery } from '@tanstack/react-query';
import { getClanScores } from '@/api/scores';
import { Badge } from '@/components/Badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Link } from 'react-router-dom';
import type { ClanId } from '@/types';

const CLAN_ORDER: ClanId[] = ['ember', 'tide', 'bloom', 'gale', 'hearth'];

export function DashboardPage() {
  const {
    data: clans,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['clanScores'],
    queryFn: getClanScores,
    refetchInterval: 30000,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#3D2B1F]">Dashboard</h1>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={(error as Error).message} />}

      {clans && clans.length === 0 && !isLoading && (
        <p className="mb-8 text-sm text-[#3D2B1F]/50">
          No clan data available. Seed the clans table to get started.
        </p>
      )}

      {clans && clans.length > 0 && (
        <div className="mb-8 grid grid-cols-5 gap-4">
          {CLAN_ORDER.map((clanId) => {
            const clan = clans.find((c) => c.clanId === clanId);
            if (!clan) return null;
            return (
              <div
                key={clanId}
                className="rounded-lg border border-[#8B6914]/20 bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <Badge clan={clanId} />
                  <span className="text-xs text-[#3D2B1F]/50">
                    {clan.spacesCaptured} spaces
                  </span>
                </div>
                <p className="text-2xl font-bold text-[#3D2B1F]">
                  {clan.todayXp} XP
                </p>
                <p className="text-xs text-[#3D2B1F]/60">
                  Season: {clan.seasonXp} XP
                </p>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">
        Quick Links
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/locations', label: 'Manage Locations', desc: 'CRUD campus locations' },
          { to: '/roster', label: 'Import Roster', desc: 'Upload student CSV' },
          { to: '/map-calibration', label: 'Map Calibration', desc: 'Calibrate GPS to pixels' },
          { to: '/daily-config', label: 'Daily Config', desc: 'Set today\'s locations' },
          { to: '/qr-generator', label: 'QR Generator', desc: 'Generate QR codes' },
          { to: '/notifications', label: 'Notifications', desc: 'Send push notifications' },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-[#8B6914]/20 bg-white p-4 transition-colors hover:border-[#D4A843]"
          >
            <p className="font-semibold text-[#3D2B1F]">{link.label}</p>
            <p className="text-xs text-[#3D2B1F]/60">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
