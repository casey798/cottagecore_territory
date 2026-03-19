import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  getAnalyticsOverview,
  getAnalyticsEngagement,
  getAnalyticsClans,
  getAnalyticsLocations,
  getAnalyticsMinigames,
  getAnalyticsFreeRoam,
  getAnalyticsClusters,
  getAnalyticsDecay,
  getClusterMigration,
  type ClusterMigrationData,
} from '@/api/analytics';
import { getSeasonStatus } from '@/api/season';
import type {
  ClanId,
  ClusterKey,
  LocationStatus,
} from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { MapHeatmap, type HeatmapPoint } from '@/components/MapHeatmap';

// ── Constants ────────────────────────────────────────────────────────

const CLAN_COLORS: Record<ClanId, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#F1C40F',
  gale: '#27AE60',
  hearth: '#7D3C98',
};

const CLAN_LABELS: Record<ClanId, string> = {
  ember: 'Ember',
  tide: 'Tide',
  bloom: 'Bloom',
  gale: 'Gale',
  hearth: 'Hearth',
};

const CLAN_IDS: ClanId[] = ['ember', 'tide', 'bloom', 'gale', 'hearth'];

type TabId = 'overview' | 'clans' | 'locations' | 'minigames' | 'free-roam' | 'clusters';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'clans', label: 'Clans' },
  { id: 'locations', label: 'Locations' },
  { id: 'minigames', label: 'Minigames' },
  { id: 'free-roam', label: 'Free-Roam' },
  { id: 'clusters', label: 'Clusters' },
];

const STATUS_EMOJI: Record<LocationStatus, string> = {
  Thriving: '\u2728',
  Activated: '\u2705',
  'Below Baseline': '\u26A0\uFE0F',
  Unactivated: '\u274C',
  New: '\uD83C\uDD95',
};

const STATUS_COLOR: Record<LocationStatus, string> = {
  Thriving: 'text-green-700 bg-green-50',
  Activated: 'text-blue-700 bg-blue-50',
  'Below Baseline': 'text-amber-700 bg-amber-50',
  Unactivated: 'text-red-700 bg-red-50',
  New: 'text-purple-700 bg-purple-50',
};

const PIE_COLORS = ['#C0392B', '#2980B9', '#F1C40F', '#27AE60', '#7D3C98', '#E67E22', '#1ABC9C', '#95A5A6'];

const CLUSTER_CONFIG: Record<ClusterKey, { label: string; color: string; shortLabel: string }> = {
  nomad: { label: 'Campus Nomads', color: '#2ECC71', shortLabel: 'C0' },
  seeker: { label: 'Hidden Gem Seekers', color: '#F39C12', shortLabel: 'C1' },
  drifter: { label: 'Social Drifters', color: '#3498DB', shortLabel: 'C2' },
  forced: { label: 'Forced Occupants', color: '#E74C3C', shortLabel: 'C3' },
  disengaged: { label: 'Disengaged', color: '#95A5A6', shortLabel: 'C4' },
  null: { label: 'New Users', color: '#8E44AD', shortLabel: 'New' },
};

const CLUSTER_KEYS: ClusterKey[] = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged', 'null'];

const SPACE_CLASSIFICATIONS = ['Social Hub', 'Transit / Forced Stay', 'Hidden Gem', 'Dead Zone', 'Unvisited'] as const;

// Phase 1 baseline percentages from Casey's thesis (static, will not change)
const P1_BASELINES: Record<string, Record<string, number>> = {
  nomad: { 'Social Hub': 41.5, 'Transit / Forced Stay': 36.1, 'Hidden Gem': 14.7, 'Dead Zone': 7.2, 'Unvisited': 0.0 },
  drifter: { 'Social Hub': 32.7, 'Transit / Forced Stay': 25.4, 'Hidden Gem': 12.4, 'Dead Zone': 4.9, 'Unvisited': 0.0 },
  forced: { 'Social Hub': 3.3, 'Transit / Forced Stay': 93.5, 'Hidden Gem': 0.0, 'Dead Zone': 1.1, 'Unvisited': 0.0 },
  seeker: { 'Social Hub': 28.0, 'Transit / Forced Stay': 18.0, 'Hidden Gem': 40.0, 'Dead Zone': 10.0, 'Unvisited': 4.0 },
  disengaged: { 'Social Hub': 15.0, 'Transit / Forced Stay': 60.0, 'Hidden Gem': 5.0, 'Dead Zone': 10.0, 'Unvisited': 10.0 },
};

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getSeasonStartDefault(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  ist.setDate(ist.getDate() - 30);
  return ist.toISOString().slice(0, 10);
}

function formatDate(dateStr: unknown): string {
  if (typeof dateStr !== 'string') return String(dateStr ?? '');
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(seconds: number | null): string {
  if (seconds === null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function pct(value: unknown, decimals = 0): string {
  const v = typeof value === 'number' ? value : 0;
  return `${(v * 100).toFixed(decimals)}%`;
}

// ── Shared Components ────────────────────────────────────────────────

function MetricCard({
  label, value, subtitle, delta,
}: {
  label: string;
  value: string;
  subtitle?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
      <div className="mb-1 text-xs font-medium uppercase text-[#3D2B1F]/50">{label}</div>
      <div className="text-2xl font-bold text-[#3D2B1F]">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {subtitle && <span className="text-xs text-[#3D2B1F]/60">{subtitle}</span>}
        {delta != null && delta !== 0 && (
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {delta > 0 ? '\u25B2' : '\u25BC'} {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label, sortKey, currentSort, currentDir, onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="cursor-pointer select-none py-2 pr-2 text-xs uppercase text-[#3D2B1F]/50 hover:text-[#3D2B1F]"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (currentDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
    </th>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [startDate, setStartDate] = useState(() => getSeasonStartDefault());
  const [endDate, setEndDate] = useState(() => getTodayIST());

  const { data: seasonStatus } = useQuery({
    queryKey: ['season-status'],
    queryFn: getSeasonStatus,
    staleTime: 5 * 60 * 1000,
  });

  // Once season status loads, use seasonStartDate as default if available
  const [seasonDateApplied, setSeasonDateApplied] = useState(false);
  useEffect(() => {
    if (seasonStatus?.seasonStartDate && !seasonDateApplied) {
      setStartDate(seasonStatus.seasonStartDate);
      setSeasonDateApplied(true);
    }
  }, [seasonStatus, seasonDateApplied]);

  const seasonStart = seasonStatus?.seasonStartDate || getSeasonStartDefault();

  function setPreset(preset: 'today' | '7d' | 'season') {
    const today = getTodayIST();
    setEndDate(today);
    if (preset === 'today') {
      setStartDate(today);
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
    } else {
      setStartDate(seasonStart);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#3D2B1F]">Analytics</h1>
        <div className="flex flex-wrap items-end gap-2">
          {(['today', '7d', 'season'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className="rounded border border-[#8B6914]/30 px-3 py-1.5 text-xs font-medium text-[#3D2B1F] hover:bg-[#F5EACB]"
            >
              {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 days' : 'All season'}
            </button>
          ))}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-[#8B6914]/30 bg-white px-2 py-1.5 text-xs text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-[#8B6914]/30 bg-white px-2 py-1.5 text-xs text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-[#8B6914]/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-[#D4A843] text-[#3D2B1F]'
                : 'text-[#3D2B1F]/50 hover:text-[#3D2B1F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab startDate={startDate} endDate={endDate} />}
      {activeTab === 'clans' && <ClansTab startDate={startDate} endDate={endDate} />}
      {activeTab === 'locations' && <LocationsTab startDate={startDate} endDate={endDate} />}
      {activeTab === 'minigames' && <MinigamesTab startDate={startDate} endDate={endDate} />}
      {activeTab === 'free-roam' && <FreeRoamTab startDate={startDate} endDate={endDate} />}
      {activeTab === 'clusters' && <ClustersTab startDate={startDate} endDate={endDate} />}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────

function OverviewTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [showClanBreakdown, setShowClanBreakdown] = useState(false);

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => getAnalyticsOverview(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: engagement, isLoading: engLoading, error: engError } = useQuery({
    queryKey: ['analytics-engagement', startDate, endDate],
    queryFn: () => getAnalyticsEngagement(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  const { data: decay } = useQuery({
    queryKey: ['analytics-decay'],
    queryFn: () => getAnalyticsDecay(),
    staleTime: 5 * 60 * 1000,
  });

  // Build decay alerts from backend response
  const alerts = useMemo(() => {
    const result: Array<{ level: 'red' | 'yellow'; text: string; suggestion: string }> = [];
    if (!decay) return result;
    const a = decay.alerts;

    if (a.dauDecline.triggered) {
      result.push({
        level: 'red',
        text: `DAU declining sharply \u2014 down ${a.dauDecline.dropPercent}% from peak of ${a.dauDecline.peakDau} on ${formatDate(a.dauDecline.peakDate)}`,
        suggestion: 'Consider a Dead Zone Revival Event or notification blast',
      });
    }
    for (const clan of a.clanDisengagement.clans) {
      const name = CLAN_LABELS[clan.clanId as ClanId] ?? clan.clanId;
      result.push({
        level: 'yellow',
        text: `${name} disengaging \u2014 participation below 30% for 2+ days`,
        suggestion: `Send targeted hype notification to ${name}`,
      });
    }
    for (const mg of a.minigameAbandonment.minigames) {
      result.push({
        level: 'yellow',
        text: `${mg.minigameId} abandonment at ${Math.round(mg.abandonmentRate * 100)}%`,
        suggestion: 'Consider removing from rotation temporarily',
      });
    }
    if (a.sessionsPerPlayerLow.triggered) {
      result.push({
        level: 'yellow',
        text: `Players doing minimum \u2014 ${a.sessionsPerPlayerLow.value} sessions/player today`,
        suggestion: 'Fresh event or hype notification recommended',
      });
    }
    if (a.unactivatedSpaces.triggered) {
      const names = a.unactivatedSpaces.locations.map((l) => l.name).join(', ');
      result.push({
        level: 'yellow',
        text: `${a.unactivatedSpaces.locations.length} priority spaces with 0 visits: ${names}`,
        suggestion: 'Add to daily location pool with increased frequency',
      });
    }
    return result;
  }, [decay]);

  return (
    <div className="space-y-6">
      {overviewLoading && <LoadingSpinner />}
      {overviewError && <ErrorAlert message={(overviewError as Error).message} />}

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="DAU"
            value={overview.today.dau.toLocaleString()}
            subtitle={`${overview.today.dauPercent}% of roster`}
            delta={overview.deltas.dau}
          />
          <MetricCard
            label="Sessions Today"
            value={overview.today.sessionsToday.toLocaleString()}
            delta={overview.deltas.sessions}
          />
          <MetricCard
            label="Avg Sessions / Player"
            value={overview.today.avgSessionsPerPlayer.toFixed(1)}
          />
          <MetricCard
            label="Locations Visited"
            value={`${overview.today.uniqueLocationsVisited} / ${overview.today.totalActiveLocations}`}
            delta={overview.deltas.locations}
          />
        </div>
      )}

      {/* Decay Alerts */}
      {decay && alerts.length === 0 && (
        <div className="rounded border-l-4 border-green-500 bg-green-50 px-4 py-3 text-sm text-green-800">
          \u2705 All engagement metrics healthy
        </div>
      )}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded border-l-4 px-4 py-3 ${
                a.level === 'red'
                  ? 'border-red-500 bg-red-50'
                  : 'border-yellow-500 bg-yellow-50'
              }`}
            >
              <div className={`text-sm font-medium ${a.level === 'red' ? 'text-red-800' : 'text-yellow-800'}`}>
                {a.level === 'red' ? '\u26A0\uFE0F' : '\uD83D\uDCA1'} {a.text}
              </div>
              <div className={`mt-1 text-xs ${a.level === 'red' ? 'text-red-600' : 'text-yellow-600'}`}>
                {a.suggestion}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Engagement Chart */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#3D2B1F]">Engagement Over Time</h3>
          <label className="flex items-center gap-2 text-xs text-[#3D2B1F]/60">
            <input
              type="checkbox"
              checked={showClanBreakdown}
              onChange={(e) => setShowClanBreakdown(e.target.checked)}
              className="accent-[#8B6914]"
            />
            Per-clan breakdown
          </label>
        </div>
        {engLoading && <LoadingSpinner />}
        {engError && <ErrorAlert message={(engError as Error).message} />}
        {engagement && engagement.days.length > 0 && (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={engagement.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} />
              <Legend />
              {showClanBreakdown ? (
                CLAN_IDS.map((clanId) => (
                  <Line
                    key={clanId}
                    type="monotone"
                    dataKey={`perClanDau.${clanId}`}
                    name={CLAN_LABELS[clanId]}
                    stroke={CLAN_COLORS[clanId]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))
              ) : (
                <>
                  <Line type="monotone" dataKey="dau" name="DAU" stroke="#3D2B1F" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="totalSessions" name="Sessions" stroke="#D4A843" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="totalCheckins" name="Check-ins" stroke="#7BA3C4" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        {engagement && engagement.days.length === 0 && (
          <p className="py-8 text-center text-sm text-[#3D2B1F]/40">No data for selected range</p>
        )}
      </div>
    </div>
  );
}

// ── Clans Tab ────────────────────────────────────────────────────────

function ClansTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-clans', startDate, endDate],
    queryFn: () => getAnalyticsClans(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;
  if (!data) return null;

  const territories = Object.entries(data.territoriesCaptured.clans)
    .map(([clanId, v]) => ({ clanId: clanId as ClanId, ...v }))
    .sort((a, b) => b.count - a.count);

  const streaks = Object.entries(data.streakStats.clans)
    .map(([clanId, v]) => ({ clanId: clanId as ClanId, ...v }))
    .sort((a, b) => b.avgStreak - a.avgStreak);

  return (
    <div className="space-y-6">
      {/* Clan XP Over Time */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Clan XP Over Time</h3>
        {data.clanXpOverTime.days.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.clanXpOverTime.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} />
              <Legend />
              {CLAN_IDS.map((id) => (
                <Line key={id} type="monotone" dataKey={id} name={CLAN_LABELS[id]} stroke={CLAN_COLORS[id]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[#3D2B1F]/40">No data</p>
        )}
      </div>

      {/* Participation Rate */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Clan Participation Rate</h3>
        {data.clanParticipation.days.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.clanParticipation.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                interval={data.clanParticipation.days.length > 7 ? 1 : 0}
              />
              <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} formatter={(v) => pct(v)} />
              <Legend />
              {CLAN_IDS.map((id) => (
                <Bar key={id} dataKey={id} name={CLAN_LABELS[id]} fill={CLAN_COLORS[id]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[#3D2B1F]/40">No data</p>
        )}
      </div>

      {/* Territories Table */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Territories Captured</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
              <th className="py-2 pr-2">Clan</th>
              <th className="py-2 pr-2 text-right">Count</th>
              <th className="py-2">Days Won</th>
            </tr>
          </thead>
          <tbody>
            {territories.map((t) => (
              <tr key={t.clanId} className="border-b border-[#8B6914]/10">
                <td className="py-2 pr-2">
                  <span className="inline-block h-3 w-3 rounded-full mr-2" style={{ backgroundColor: CLAN_COLORS[t.clanId] }} />
                  {CLAN_LABELS[t.clanId]}
                </td>
                <td className="py-2 pr-2 text-right font-bold">{t.count}</td>
                <td className="py-2 text-xs text-[#3D2B1F]/60">{t.days.map(formatDate).join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Streak Stats */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Average Streak Per Clan</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
              <th className="py-2 pr-2">Clan</th>
              <th className="py-2 pr-2 text-right">Avg Streak</th>
              <th className="py-2 pr-2 text-right">Longest</th>
              <th className="py-2 text-right">3+ Day Streak</th>
            </tr>
          </thead>
          <tbody>
            {streaks.map((s) => (
              <tr key={s.clanId} className="border-b border-[#8B6914]/10">
                <td className="py-2 pr-2">
                  <span className="inline-block h-3 w-3 rounded-full mr-2" style={{ backgroundColor: CLAN_COLORS[s.clanId] }} />
                  {CLAN_LABELS[s.clanId]}
                </td>
                <td className="py-2 pr-2 text-right">{s.avgStreak.toFixed(1)}</td>
                <td className="py-2 pr-2 text-right font-bold">{s.longestStreak}</td>
                <td className="py-2 text-right">{s.streakCount3Plus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Locations Tab ────────────────────────────────────────────────────

function LocationsTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [sortKey, setSortKey] = useState('change');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-locations', startDate, endDate],
    queryFn: () => getAnalyticsLocations(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data.locations].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortKey];
      const bVal = (b as unknown as Record<string, unknown>)[sortKey];
      const av = typeof aVal === 'number' ? aVal : typeof aVal === 'string' ? aVal : 0;
      const bv = typeof bVal === 'number' ? bVal : typeof bVal === 'string' ? bVal : 0;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;
  if (!data) return null;

  const STATUS_HEATMAP_COLORS: Record<string, string> = {
    Thriving: '#27AE60',
    Activated: '#2ECC71',
    'Below Baseline': '#E74C3C',
    Unactivated: '#95A5A6',
    New: '#3498DB',
  };

  const maxTotal = Math.max(...data.locations.map((l) => l.total), 1);
  const heatmapPoints: HeatmapPoint[] = data.locations
    .filter((l) => l.mapPixelX > 0 && l.mapPixelY > 0)
    .map((l) => ({
      locationId: l.locationId,
      name: l.name,
      x: l.mapPixelX,
      y: l.mapPixelY,
      value: l.total,
      maxValue: maxTotal,
      color: STATUS_HEATMAP_COLORS[l.status] ?? '#95A5A6',
      tooltip: `${l.total} visits (${l.gameSessions} game, ${l.freeRoamCheckins} free-roam)\nSatisfaction: ${l.avgSatisfaction?.toFixed(2) ?? 'N/A'}\nStatus: ${l.status}`,
    }));

  return (
    <div className="space-y-6">
    {heatmapPoints.length > 0 && (
      <MapHeatmap locations={heatmapPoints} title="Location Activity Heatmap" showLegend />
    )}
    <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Location Performance</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#8B6914]/20">
              <th className="py-2 pr-2 text-xs uppercase text-[#3D2B1F]/50">#</th>
              <SortHeader label="Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Class" sortKey="classification" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Sessions" sortKey="gameSessions" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Checkins" sortKey="freeRoamCheckins" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Total" sortKey="total" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Avg Sat." sortKey="avgSatisfaction" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <th className="py-2 pr-2 text-xs uppercase text-[#3D2B1F]/50">Sentiment</th>
              <SortHeader label="Phase 1" sortKey="phase1Visits" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Change" sortKey="change" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((loc) => {
              const sentTotal = loc.sentimentBreakdown.yes + loc.sentimentBreakdown.maybe + loc.sentimentBreakdown.no;
              return (
                <tr key={loc.locationId} className="border-b border-[#8B6914]/10 text-[#3D2B1F]">
                  <td className="py-2 pr-2 text-xs text-[#3D2B1F]/40">{loc.qrNumber}</td>
                  <td className="py-2 pr-2 font-medium">{loc.name}</td>
                  <td className="py-2 pr-2 text-xs">{loc.classification}</td>
                  <td className="py-2 pr-2 text-right">{loc.gameSessions}</td>
                  <td className="py-2 pr-2 text-right">{loc.freeRoamCheckins}</td>
                  <td className="py-2 pr-2 text-right font-bold">{loc.total}</td>
                  <td className="py-2 pr-2 text-right">{loc.avgSatisfaction?.toFixed(2) ?? '-'}</td>
                  <td className="py-2 pr-2 text-xs">
                    {sentTotal > 0
                      ? `${Math.round((loc.sentimentBreakdown.yes / sentTotal) * 100)}/${Math.round((loc.sentimentBreakdown.maybe / sentTotal) * 100)}/${Math.round((loc.sentimentBreakdown.no / sentTotal) * 100)}`
                      : '-'}
                  </td>
                  <td className="py-2 pr-2 text-right">{loc.phase1Visits}</td>
                  <td className={`py-2 pr-2 text-right font-medium ${loc.change > 0 ? 'text-green-600' : loc.change < 0 ? 'text-red-600' : ''}`}>
                    {loc.change > 0 ? '+' : ''}{loc.change}
                  </td>
                  <td className="py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[loc.status]}`}>
                      {STATUS_EMOJI[loc.status]} {loc.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

// ── Minigames Tab ────────────────────────────────────────────────────

function MinigamesTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-minigames', startDate, endDate],
    queryFn: () => getAnalyticsMinigames(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;
  if (!data) return null;

  const byWinRate = [...data.minigames].sort((a, b) => b.winRate - a.winRate);

  function wrColor(rate: number): string {
    if (rate >= 0.7) return '#27AE60';
    if (rate >= 0.4) return '#F1C40F';
    return '#C0392B';
  }

  return (
    <div className="space-y-6">
      {/* Win Rate Chart */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Win Rate by Minigame</h3>
        {byWinRate.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(byWinRate.length * 36, 200)}>
            <BarChart data={byWinRate} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => pct(v)} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="minigameId" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => pct(v, 1)} />
              <Bar dataKey="winRate" name="Win Rate">
                {byWinRate.map((entry, i) => (
                  <Cell key={i} fill={wrColor(entry.winRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[#3D2B1F]/40">No data</p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Minigame Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                <th className="py-2 pr-2">Minigame</th>
                <th className="py-2 pr-2 text-right">Plays</th>
                <th className="py-2 pr-2 text-right">Wins</th>
                <th className="py-2 pr-2 text-right">Win Rate</th>
                <th className="py-2 pr-2 text-right">Avg Time</th>
                <th className="py-2 pr-2 text-right">Abandon %</th>
                <th className="py-2 text-right">Co-op %</th>
              </tr>
            </thead>
            <tbody>
              {data.minigames.map((mg) => (
                <tr key={mg.minigameId} className="border-b border-[#8B6914]/10">
                  <td className="py-2 pr-2 font-medium text-[#3D2B1F]">{mg.minigameId}</td>
                  <td className="py-2 pr-2 text-right">{mg.totalPlays.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right">{mg.wins.toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right">
                    <span style={{ color: wrColor(mg.winRate) }} className="font-medium">{pct(mg.winRate)}</span>
                  </td>
                  <td className="py-2 pr-2 text-right">{formatTime(mg.avgTimeSeconds)}</td>
                  <td className="py-2 pr-2 text-right">
                    <span style={{ color: wrColor(1 - mg.abandonmentRate) }}>{pct(mg.abandonmentRate)}</span>
                  </td>
                  <td className="py-2 text-right">{pct(mg.coopPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Free-Roam Tab ────────────────────────────────────────────────────

function FreeRoamTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-freeRoam', startDate, endDate],
    queryFn: () => getAnalyticsFreeRoam(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  const { data: locData } = useQuery({
    queryKey: ['analytics-locations', startDate, endDate],
    queryFn: () => getAnalyticsLocations(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;
  if (!data) return null;

  const pieData = Object.entries(data.activityCategoryBreakdown).map(([name, value]) => ({ name, value }));
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // Build checkin heatmap from location data
  const checkinHeatmapPoints: HeatmapPoint[] = [];
  if (locData) {
    const maxCheckins = Math.max(...locData.locations.map((l) => l.freeRoamCheckins), 1);
    for (const loc of locData.locations) {
      if (loc.mapPixelX <= 0 || loc.mapPixelY <= 0 || loc.freeRoamCheckins === 0) continue;
      const sentByLoc = data.sentimentByLocation.find((s) => s.locationId === loc.locationId);
      const yesPct = sentByLoc && sentByLoc.total > 0 ? Math.round((sentByLoc.yes / sentByLoc.total) * 100) : 0;
      checkinHeatmapPoints.push({
        locationId: loc.locationId,
        name: loc.name,
        x: loc.mapPixelX,
        y: loc.mapPixelY,
        value: loc.freeRoamCheckins,
        maxValue: maxCheckins,
        color: '#8E44AD',
        tooltip: `${loc.freeRoamCheckins} voluntary check-ins\nSentiment: ${yesPct}% positive`,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total Check-ins" value={data.totalCheckins.toLocaleString()} />
        <MetricCard label="Unique Users" value={data.uniqueUsers.toLocaleString()} />
        <MetricCard
          label="Avg Sentiment"
          value={`${pct(data.avgSentiment.yes)} Yes`}
          subtitle={`${pct(data.avgSentiment.maybe)} Maybe / ${pct(data.avgSentiment.no)} No`}
        />
        <MetricCard
          label="Control Signal"
          value={`${pct(data.controlSignal.nonAssignedPercent)} Non-assigned`}
          subtitle={`${data.controlSignal.nonAssigned} of ${data.controlSignal.assigned + data.controlSignal.nonAssigned} check-ins`}
        />
      </div>

      {/* Daily checkins line chart */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Daily Check-ins</h3>
        {data.dailyCheckins.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.dailyCheckins}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} />
              <Line type="monotone" dataKey="count" name="Check-ins" stroke="#7BA3C4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[#3D2B1F]/40">No data</p>
        )}
      </div>

      {/* Control signal trend */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Non-Assigned Location Visits (Control Signal)</h3>
        {/* Stacked bar summary */}
        <div className="mb-4 flex h-6 overflow-hidden rounded-full">
          <div
            className="flex items-center justify-center text-xs font-bold text-white"
            style={{ width: pct(data.controlSignal.assignedPercent), backgroundColor: '#27AE60' }}
          >
            {data.controlSignal.assignedPercent > 0.1 ? `Assigned ${pct(data.controlSignal.assignedPercent)}` : ''}
          </div>
          <div
            className="flex items-center justify-center text-xs font-bold text-white"
            style={{ width: pct(data.controlSignal.nonAssignedPercent), backgroundColor: '#E67E22' }}
          >
            {data.controlSignal.nonAssignedPercent > 0.1 ? `Non-assigned ${pct(data.controlSignal.nonAssignedPercent)}` : ''}
          </div>
        </div>
        {data.controlSignal.daily.length > 0 && (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.controlSignal.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => pct(v)} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} formatter={(v) => pct(v, 1)} />
              <Line type="monotone" dataKey="nonAssignedPercent" name="Non-assigned %" stroke="#E67E22" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Checkin heatmap */}
      {checkinHeatmapPoints.length > 0 && (
        <MapHeatmap
          locations={checkinHeatmapPoints}
          title="Free-Roam Check-in Density (Game Sessions Excluded)"
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sentiment by Location */}
        <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Sentiment by Location</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                  <th className="py-2 pr-2">Location</th>
                  <th className="py-2 pr-2 text-right">Total</th>
                  <th className="py-2 pr-2 text-right">Yes %</th>
                  <th className="py-2 pr-2 text-right">Maybe %</th>
                  <th className="py-2 text-right">No %</th>
                </tr>
              </thead>
              <tbody>
                {data.sentimentByLocation.slice(0, 20).map((loc) => (
                  <tr key={loc.locationId} className="border-b border-[#8B6914]/10">
                    <td className="py-1.5 pr-2 text-[#3D2B1F]">{loc.name}</td>
                    <td className="py-1.5 pr-2 text-right">{loc.total}</td>
                    <td className="py-1.5 pr-2 text-right text-green-600">{loc.total > 0 ? Math.round((loc.yes / loc.total) * 100) : 0}%</td>
                    <td className="py-1.5 pr-2 text-right text-amber-600">{loc.total > 0 ? Math.round((loc.maybe / loc.total) * 100) : 0}%</td>
                    <td className="py-1.5 text-right text-red-600">{loc.total > 0 ? Math.round((loc.no / loc.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sentiment by Cluster */}
        <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Sentiment by Cluster</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                <th className="py-2 pr-2">Cluster</th>
                <th className="py-2 pr-2 text-right">Total</th>
                <th className="py-2 pr-2 text-right">Yes %</th>
                <th className="py-2 pr-2 text-right">Maybe %</th>
                <th className="py-2 text-right">No %</th>
              </tr>
            </thead>
            <tbody>
              {data.sentimentByCluster.map((cl) => (
                <tr key={cl.cluster} className="border-b border-[#8B6914]/10">
                  <td className="py-1.5 pr-2 text-[#3D2B1F] capitalize">{cl.cluster === 'null' ? 'New users' : cl.cluster}</td>
                  <td className="py-1.5 pr-2 text-right">{cl.total}</td>
                  <td className="py-1.5 pr-2 text-right text-green-600">{cl.total > 0 ? Math.round((cl.yes / cl.total) * 100) : 0}%</td>
                  <td className="py-1.5 pr-2 text-right text-amber-600">{cl.total > 0 ? Math.round((cl.maybe / cl.total) * 100) : 0}%</td>
                  <td className="py-1.5 text-right text-red-600">{cl.total > 0 ? Math.round((cl.no / cl.total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Category Pie */}
      {pieData.length > 0 && (
        <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Activity Category Distribution</h3>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <ResponsiveContainer width={280} height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                  {pieData.map((_d, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => { const n = typeof v === 'number' ? v : 0; return `${n} (${pieTotal > 0 ? Math.round((n / pieTotal) * 100) : 0}%)`; }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[#3D2B1F]">{d.name}</span>
                  <span className="text-[#3D2B1F]/50">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Clusters Tab ─────────────────────────────────────────────────────

function ClustersTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [sortKey, setSortKey] = useState('participationRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-clusters', startDate, endDate],
    queryFn: () => getAnalyticsClusters(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={(error as Error).message} />;
  if (!data) return null;

  const overview = data.clusterOverview;

  // Build sorted table rows
  const tableRows = CLUSTER_KEYS.map((ck) => ({ ck, ...overview[ck] }));
  tableRows.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    const an = typeof av === 'number' ? av : 0;
    const bn = typeof bv === 'number' ? bv : 0;
    return sortDir === 'desc' ? bn - an : an - bn;
  });

  return (
    <div className="space-y-6">
      {/* A) Cluster Overview Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {CLUSTER_KEYS.map((ck) => {
          const c = overview[ck];
          const cfg = CLUSTER_CONFIG[ck];
          if (!c) return null;
          const sentTotal = c.sentimentBreakdown.yes + c.sentimentBreakdown.maybe + c.sentimentBreakdown.no;
          const yesPct = sentTotal > 0 ? Math.round((c.sentimentBreakdown.yes / sentTotal) * 100) : 0;

          return (
            <div
              key={ck}
              className={`rounded-lg border-2 p-4 ${c.rosterCount === 0 ? 'opacity-40' : ''}`}
              style={{ borderColor: cfg.color, backgroundColor: `${cfg.color}08` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="rounded-full bg-[#3D2B1F]/10 px-2 py-0.5 text-xs font-medium text-[#3D2B1F]">
                  {c.rosterCount} users
                </span>
              </div>
              {c.rosterCount === 0 ? (
                <p className="text-xs text-[#3D2B1F]/40">No users</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#3D2B1F]">
                  <div>Avg DAU: <span className="font-bold">{c.dau.toFixed(1)}</span></div>
                  <div>Participation: <span className="font-bold">{pct(c.participationRate)}</span></div>
                  <div>Sessions/day: <span className="font-bold">{c.avgSessionsPerDay.toFixed(1)}</span></div>
                  <div>Avg Streak: <span className="font-bold">{c.avgStreak.toFixed(1)}</span></div>
                  <div className="col-span-2">
                    Sentiment: <span className="font-bold text-green-600">{yesPct}% Yes</span>
                    {c.avgSatisfaction !== null && (
                      <span className="ml-2 text-[#3D2B1F]/50">Sat: {c.avgSatisfaction.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* B) Cluster x Space Type Heatmap */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-[#3D2B1F]">Cluster × Space Type Distribution</h3>
        <p className="mb-3 text-xs text-[#3D2B1F]/40">Phase 2 visit percentages with Phase 1 baseline deltas</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#8B6914]/20 text-[#3D2B1F]/50 uppercase">
                <th className="py-2 pr-3">Cluster</th>
                {SPACE_CLASSIFICATIONS.map((cls) => (
                  <th key={cls} className="py-2 px-2 text-center">{cls}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLUSTER_KEYS.map((ck) => {
                const cfg = CLUSTER_CONFIG[ck];
                const p2 = data.clusterSpaceTypeMatrix.clusters[ck];
                const p1 = P1_BASELINES[ck]; // undefined for 'null' (new users)

                return (
                  <tr key={ck} className="border-b border-[#8B6914]/10">
                    <td className="py-2 pr-3">
                      <span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ backgroundColor: cfg.color }} />
                      <span className="font-medium text-[#3D2B1F]">{cfg.label}</span>
                    </td>
                    {SPACE_CLASSIFICATIONS.map((cls) => {
                      const p2Val = (p2?.[cls] ?? 0) * 100;
                      const p1Val = p1?.[cls];
                      const delta = p1Val != null ? p2Val - p1Val : null;
                      // Color intensity: ratio of p2Val to max possible
                      const intensity = Math.min(p2Val / 60, 1);
                      const bgColor = `${cfg.color}${Math.round(intensity * 40).toString(16).padStart(2, '0')}`;

                      return (
                        <td key={cls} className="py-2 px-2 text-center" style={{ backgroundColor: bgColor }}>
                          <div className="font-bold text-[#3D2B1F]">{p2Val.toFixed(1)}%</div>
                          {delta !== null ? (
                            <div className={`text-[10px] font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-[#3D2B1F]/40'}`}>
                              {delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : ''} {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#3D2B1F]/30">&mdash;</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* C) Cluster Satisfaction Over Time */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Cluster Satisfaction Over Time</h3>
        {data.clusterSatisfactionOverTime.days.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.clusterSatisfactionOverTime.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8DDB8" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={formatDate} />
              <Legend />
              {CLUSTER_KEYS.map((ck) => (
                <Line
                  key={ck}
                  type="monotone"
                  dataKey={ck}
                  name={CLUSTER_CONFIG[ck].label}
                  stroke={CLUSTER_CONFIG[ck].color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-[#3D2B1F]/40">No data</p>
        )}
      </div>

      {/* D) Cluster Engagement Comparison Table */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#3D2B1F]">Cluster Engagement Comparison</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#8B6914]/20">
              <th className="py-2 pr-2 text-xs uppercase text-[#3D2B1F]/50">Cluster</th>
              <SortHeader label="Roster" sortKey="rosterCount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Avg DAU" sortKey="dau" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Participation %" sortKey="participationRate" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Sessions/Day" sortKey="avgSessionsPerDay" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="Avg Streak" sortKey="avgStreak" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              const cfg = CLUSTER_CONFIG[row.ck];
              return (
                <tr key={row.ck} className="border-b border-[#8B6914]/10">
                  <td className="py-2 pr-2">
                    <span className="inline-block h-3 w-3 rounded-full mr-2" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </td>
                  <td className="py-2 pr-2 text-right">{row.rosterCount}</td>
                  <td className="py-2 pr-2 text-right">{row.dau.toFixed(1)}</td>
                  <td className="py-2 pr-2 text-right font-medium">{pct(row.participationRate)}</td>
                  <td className="py-2 pr-2 text-right">{row.avgSessionsPerDay.toFixed(1)}</td>
                  <td className="py-2 text-right">{row.avgStreak.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* E) Cluster Migration Preview */}
      <ClusterMigrationPreview />
    </div>
  );
}

// ── Cluster Migration Preview ────────────────────────────────────────

const MIGRATION_CLUSTER_IDS = ['nomad', 'seeker', 'drifter', 'forced', 'disengaged'] as const;

function ClusterMigrationPreview() {
  const [migrationData, setMigrationData] = useState<ClusterMigrationData | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const migrationMut = useMutation({
    mutationFn: getClusterMigration,
    onSuccess: (data) => {
      setMigrationData(data);
      setMigrationError(null);
    },
    onError: (err) => {
      setMigrationError(err instanceof Error ? err.message : 'Failed to compute migration');
    },
  });

  const summary = useMemo(() => {
    if (!migrationData) return null;
    let leastStable = '';
    let leastStablePct = 100;
    const summaryLines: string[] = [];

    for (const cid of MIGRATION_CLUSTER_IDS) {
      const row = migrationData.migrations[cid];
      if (!row || row.total === 0) continue;
      const stillKey = `still${cid.charAt(0).toUpperCase() + cid.slice(1)}`;
      const stillPct = Math.round(((row[stillKey] || 0) / row.total) * 100);
      if (stillPct < leastStablePct) {
        leastStablePct = stillPct;
        leastStable = cid;
      }
    }

    if (leastStable) {
      const row = migrationData.migrations[leastStable];
      const cfg = CLUSTER_CONFIG[leastStable as keyof typeof CLUSTER_CONFIG];
      const movedPct = 100 - leastStablePct;
      const destinations: string[] = [];
      for (const dest of MIGRATION_CLUSTER_IDS) {
        if (dest === leastStable) continue;
        const toKey = `to${dest.charAt(0).toUpperCase() + dest.slice(1)}`;
        const count = row[toKey] || 0;
        if (count > 0) {
          const destCfg = CLUSTER_CONFIG[dest as keyof typeof CLUSTER_CONFIG];
          destinations.push(`${destCfg.label} (${Math.round((count / row.total) * 100)}%)`);
        }
      }
      summaryLines.push(
        `${movedPct}% of ${cfg.label} have shifted to other clusters. Most common: ${destinations.slice(0, 3).join(', ')}`
      );
    }

    const nu = migrationData.newUsers;
    if (nu.total > 0) {
      const parts = MIGRATION_CLUSTER_IDS
        .map(c => ({ c, pct: Math.round((nu[c] / nu.total) * 100) }))
        .filter(x => x.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .map(x => `${x.pct}% ${CLUSTER_CONFIG[x.c as keyof typeof CLUSTER_CONFIG].label}`);
      summaryLines.push(`${nu.total} users without Phase 1 data classified as: ${parts.join(', ')}`);
    }

    return summaryLines;
  }, [migrationData]);

  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-[#3D2B1F]">Cluster Migration Preview</h3>
      <p className="mb-3 text-xs text-[#3D2B1F]/40">
        Heuristic estimate — full K-means analysis in thesis post-hoc
      </p>

      {!migrationData && !migrationMut.isPending && (
        <button
          onClick={() => migrationMut.mutate()}
          className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210]"
        >
          Compute Migration
        </button>
      )}

      {migrationMut.isPending && (
        <div className="flex items-center gap-2 py-4">
          <LoadingSpinner />
          <span className="text-sm text-[#3D2B1F]/50">Computing cluster migrations...</span>
        </div>
      )}

      {migrationError && <ErrorAlert message={migrationError} />}

      {migrationData && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#8B6914]/20 text-[#3D2B1F]/50 uppercase">
                  <th className="py-2 pr-2">Original</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 px-2 text-right">Still Same</th>
                  {MIGRATION_CLUSTER_IDS.map(c => (
                    <th key={c} className="py-2 px-2 text-center">
                      &rarr; {CLUSTER_CONFIG[c as keyof typeof CLUSTER_CONFIG].shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MIGRATION_CLUSTER_IDS.map(cid => {
                  const row = migrationData.migrations[cid];
                  if (!row) return null;
                  const cfg = CLUSTER_CONFIG[cid as keyof typeof CLUSTER_CONFIG];
                  const stillKey = `still${cid.charAt(0).toUpperCase() + cid.slice(1)}`;
                  const stillCount = row[stillKey] || 0;
                  const stillPct = row.total > 0 ? Math.round((stillCount / row.total) * 100) : 0;

                  const stillBg = stillPct >= 70
                    ? 'bg-green-100 text-green-800'
                    : stillPct >= 50
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800';

                  const isPositive = (from: string, to: string) =>
                    (from === 'forced' && (to === 'nomad' || to === 'seeker')) ||
                    (from === 'disengaged' && to !== 'disengaged');

                  return (
                    <tr key={cid} className="border-b border-[#8B6914]/10">
                      <td className="py-2 pr-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full mr-1.5" style={{ backgroundColor: cfg.color }} />
                        <span className="font-medium text-[#3D2B1F]">{cfg.label}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-[#3D2B1F]">{row.total}</td>
                      <td className={`py-2 px-2 text-right font-bold rounded ${stillBg}`}>
                        {stillCount} ({stillPct}%)
                      </td>
                      {MIGRATION_CLUSTER_IDS.map(dest => {
                        if (dest === cid) {
                          return <td key={dest} className="py-2 px-2 text-center text-[#3D2B1F]/20">&mdash;</td>;
                        }
                        const toKey = `to${dest.charAt(0).toUpperCase() + dest.slice(1)}`;
                        const count = row[toKey] || 0;
                        const p = row.total > 0 ? Math.round((count / row.total) * 100) : 0;
                        return (
                          <td key={dest} className={`py-2 px-2 text-center ${count > 0 && isPositive(cid, dest) ? 'text-green-700 font-medium' : 'text-[#3D2B1F]/70'}`}>
                            {count > 0 ? `${count} (${p}%)` : '0'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {summary && summary.length > 0 && (
            <div className="space-y-1">
              {summary.map((line, i) => (
                <p key={i} className="text-sm text-[#3D2B1F]/70">{line}</p>
              ))}
            </div>
          )}

          <p className="text-xs text-[#3D2B1F]/30">
            Computed at {new Date(migrationData.computedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
