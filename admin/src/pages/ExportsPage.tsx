import { useState } from 'react';
import {
  exportGameSessions,
  exportCheckins,
  exportPlayerProfiles,
  exportPlayerAssignments,
  exportCaptureHistory,
  exportLocations,
  exportDailyConfigs,
  exportNotificationHistory,
  exportLocationSummary,
  exportAssetCollectionByClan,
  exportAssetDropsByLocation,
  exportClusterHistory,
} from '@/api/exports';

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function get14DaysAgo(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  ist.setDate(ist.getDate() - 14);
  return ist.toISOString().slice(0, 10);
}

interface ExportCardConfig {
  id: string;
  title: string;
  description: string;
  useDateRange: boolean;
  featured?: boolean;
  onExport: (startDate: string, endDate: string) => Promise<void>;
}

const EXPORT_CARDS: ExportCardConfig[] = [
  {
    id: 'game-sessions',
    title: 'Game Sessions',
    description: 'Every minigame play record with session type, result, dwell time, and post-visit sentiment. Includes competitive, practice, and free-roam sessions.',
    useDateRange: true,
    onExport: exportGameSessions,
  },
  {
    id: 'checkins',
    title: 'Free-Roam Check-ins',
    description: 'Passive location visits without QR scan. Includes activity category, floor, duration, satisfaction, and sentiment per visit.',
    useDateRange: true,
    onExport: exportCheckins,
  },
  {
    id: 'player-profiles',
    title: 'Player Profiles',
    description: 'All registered players with XP, streaks, clan, Phase 1 cluster, and live computed cluster.',
    useDateRange: false,
    onExport: exportPlayerProfiles,
  },
  {
    id: 'player-assignments',
    title: 'Player Assignments',
    description: 'Which locations were assigned to each player each day, including cluster weights used.',
    useDateRange: true,
    onExport: exportPlayerAssignments,
  },
  {
    id: 'capture-history',
    title: 'Capture History',
    description: 'Every territory capture event with per-clan XP snapshot and total day XP.',
    useDateRange: true,
    onExport: exportCaptureHistory,
  },
  {
    id: 'locations',
    title: 'Locations Master',
    description: 'All 27 campus locations with GPS coordinates, classification, Phase 1 baseline visit counts, and satisfaction scores.',
    useDateRange: false,
    onExport: exportLocations,
  },
  {
    id: 'daily-configs',
    title: 'Daily Configs',
    description: 'Admin configuration per day: active location pool, target space, winner clan.',
    useDateRange: true,
    onExport: exportDailyConfigs,
  },
  {
    id: 'notification-history',
    title: 'Notification History',
    description: 'All push notifications sent: target audience, type, message, delivery count.',
    useDateRange: true,
    onExport: exportNotificationHistory,
  },
  {
    id: 'location-summary',
    title: 'Location Activity Summary',
    description: 'Core research table. One row per location per day combining game sessions, free-roam visits, dwell time, sentiment, and cluster breakdown vs Phase 1 baseline.',
    useDateRange: true,
    featured: true,
    onExport: exportLocationSummary,
  },
  {
    id: 'asset-collection-by-clan',
    title: 'Asset Collection by Clan',
    description: 'Every collectible asset ranked by collection count per clan (ascending). Shows drop distribution across all 5 clans.',
    useDateRange: true,
    onExport: exportAssetCollectionByClan,
  },
  {
    id: 'asset-drops-by-location',
    title: 'Asset Drops by Location',
    description: 'Which locations generated which drops for each clan. Includes rarity breakdown per location.',
    useDateRange: true,
    onExport: exportAssetDropsByLocation,
  },
  {
    id: 'cluster-history',
    title: 'Daily Cluster History',
    description: "Each player's behavioural cluster assignment per day across the season, with feature snapshots and change flags. Use for cluster migration Sankey diagrams.",
    useDateRange: true,
    onExport: exportClusterHistory,
  },
];

export function ExportsPage() {
  const [startDate, setStartDate] = useState(() => get14DaysAgo());
  const [endDate, setEndDate] = useState(() => getTodayIST());
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>({});

  async function handleExport(card: ExportCardConfig) {
    setLoadingStates((prev) => ({ ...prev, [card.id]: true }));
    setErrorStates((prev) => ({ ...prev, [card.id]: null }));

    try {
      await card.onExport(startDate, endDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setErrorStates((prev) => ({ ...prev, [card.id]: message }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [card.id]: false }));
    }
  }

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Research Data Exports</h1>
        <p className="mt-1 text-sm text-[#3D2B1F]/60">
          Download CSV data for thesis analysis. All exports respect the selected date range.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3D2B1F]/60">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-[#8B6914]/30 bg-white px-3 py-1.5 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3D2B1F]/60">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-[#8B6914]/30 bg-white px-3 py-1.5 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXPORT_CARDS.map((card) => {
          const isLoading = loadingStates[card.id] ?? false;
          const errorMsg = errorStates[card.id] ?? null;

          return (
            <div
              key={card.id}
              className={`flex flex-col rounded-lg border bg-white p-5 ${
                card.featured
                  ? 'border-[#D4A843] bg-[#FDFAF0] shadow-md'
                  : 'border-[#8B6914]/20'
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#3D2B1F]">{card.title}</h3>
                {card.featured && (
                  <span className="rounded-full bg-[#D4A843] px-2 py-0.5 text-[10px] font-bold text-white">
                    Thesis
                  </span>
                )}
              </div>
              <p className="mb-4 flex-1 text-xs leading-relaxed text-[#3D2B1F]/60">
                {card.description}
              </p>
              {!card.useDateRange && (
                <p className="mb-2 text-[10px] text-[#3D2B1F]/40">No date range — exports all data</p>
              )}
              <button
                onClick={() => handleExport(card)}
                disabled={isLoading}
                className={`mt-auto flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium text-white transition-colors ${
                  isLoading
                    ? 'cursor-not-allowed bg-[#8B6914]/50'
                    : 'bg-[#8B6914] hover:bg-[#6B5010]'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  'Download CSV'
                )}
              </button>
              {errorMsg && (
                <p className="mt-2 text-xs text-red-600">{errorMsg}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
