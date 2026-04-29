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
  exportClusterHistory,
  exportSpaceAssignments,
  exportDecorationSurveys,
  exportSentimentTimeSeries,
  exportAssetPlacements,
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

// ── Section definitions ──────────────────────────────────

const SECTION_1_CARDS: ExportCardConfig[] = [
  {
    id: 'space-assignments',
    title: 'Space Assignments',
    description: 'Who was assigned which Dead Zone spaces each day and whether they completed them. Shows decoration coverage and per-player engagement.',
    useDateRange: true,
    onExport: exportSpaceAssignments,
  },
  {
    id: 'decoration-surveys',
    title: 'Decoration Surveys',
    description: 'All space decoration submissions with all three survey responses: desired space use, item reasoning, and intrinsic motivation (wouldVisitMore). Primary thesis dataset.',
    useDateRange: true,
    featured: true,
    onExport: exportDecorationSurveys,
  },
  {
    id: 'sentiment-time-series',
    title: 'Sentiment Time Series',
    description: 'All three motivation signals — minigame sentiment, decoration survey (wouldVisitMore), and check-in sentiment — aggregated by date and cluster. Direct input for statistical analysis.',
    useDateRange: true,
    featured: true,
    onExport: exportSentimentTimeSeries,
  },
  {
    id: 'asset-placements',
    title: 'Asset Placements',
    description: 'One row per placed asset per decoration. Shows which items (by name) were placed in each space, by whom, with grid coordinates. Use for asset popularity and spatial analysis.',
    useDateRange: true,
    onExport: exportAssetPlacements,
  },
];

const SECTION_2_CARDS: ExportCardConfig[] = [
  {
    id: 'game-sessions',
    title: 'Game Sessions',
    description: 'Every minigame play with result, dwell time, leave reason, and post-game sentiment. Note: spaceSentiment is only collected on wins (~50% of sessions).',
    useDateRange: true,
    onExport: exportGameSessions,
  },
];

const SECTION_3_CARDS: ExportCardConfig[] = [
  {
    id: 'checkins',
    title: 'Free-Roam Check-ins',
    description: 'Passive location visits without QR scan. Includes activity category, floor level, dwell duration, satisfaction rating, and sentiment.',
    useDateRange: true,
    onExport: exportCheckins,
  },
  {
    id: 'location-summary',
    title: 'Location Activity Summary',
    description: 'Core research table. One row per location per day combining game sessions, check-ins, dwell time, sentiment, and cluster breakdown vs Phase 1 baseline.',
    useDateRange: true,
    featured: true,
    onExport: exportLocationSummary,
  },
];

const SECTION_4_CARDS: ExportCardConfig[] = [
  {
    id: 'player-profiles',
    title: 'Player Profiles',
    description: 'All registered players with XP, streaks, clan, and Phase 1 cluster assignment.',
    useDateRange: false,
    onExport: exportPlayerProfiles,
  },
  {
    id: 'player-assignments',
    title: 'Player Assignments (Minigame Locations)',
    description: 'Which campus locations were assigned to each player each day for minigame play.',
    useDateRange: true,
    onExport: exportPlayerAssignments,
  },
  {
    id: 'capture-history',
    title: 'Capture History',
    description: 'Territory capture events with per-clan XP snapshots. Shows competitive dynamics over the season.',
    useDateRange: true,
    onExport: exportCaptureHistory,
  },
  {
    id: 'locations',
    title: 'Locations Master',
    description: 'All campus locations with GPS coordinates, classification, and Phase 1 baseline visit counts.',
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
    description: 'All push notifications sent with target audience, type, and delivery count.',
    useDateRange: true,
    onExport: exportNotificationHistory,
  },
  {
    id: 'cluster-history',
    title: 'Daily Cluster History',
    description: "Each player's behavioural cluster assignment per day across the season, with feature snapshots and change flags.",
    useDateRange: true,
    onExport: exportClusterHistory,
  },
];

// ── Page component ───────────────────────────────────────

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

  function renderCard(card: ExportCardConfig) {
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
  }

  function renderSection(label: string, cards: ExportCardConfig[]) {
    return (
      <div className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8B6914]">
          {label}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(renderCard)}
        </div>
      </div>
    );
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

      {renderSection('Primary Research — Space Decoration System', SECTION_1_CARDS)}
      {renderSection('Secondary Research — Minigame System', SECTION_2_CARDS)}
      {renderSection('Passive Behaviour — Free-Roam', SECTION_3_CARDS)}
      {renderSection('Reference Data', SECTION_4_CARDS)}
    </div>
  );
}
