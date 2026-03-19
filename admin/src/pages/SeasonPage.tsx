import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  resetSeason,
  getHallOfFame,
  getSeasonStatus,
  fetchExportCsv,
  type ExportType,
  type HallOfFameData,
} from '@/api/season';
import { getClanScores } from '@/api/scores';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

const CLAN_COLORS: Record<string, string> = {
  ember: '#C0392B',
  tide: '#2980B9',
  bloom: '#F1C40F',
  gale: '#27AE60',
  hearth: '#7D3C98',
};

const CLAN_LABELS: Record<string, string> = {
  ember: 'Ember',
  tide: 'Tide',
  bloom: 'Bloom',
  gale: 'Gale',
  hearth: 'Hearth',
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

interface ExportItem {
  key: ExportType;
  label: string;
  dateScoped: boolean;
}

const EXPORTS: ExportItem[] = [
  { key: 'game-sessions', label: 'Game Sessions', dateScoped: true },
  { key: 'player-profiles', label: 'Player Profiles', dateScoped: false },
  { key: 'daily-configs', label: 'Daily Configs', dateScoped: true },
  { key: 'player-assignments', label: 'Player Assignments', dateScoped: true },
  { key: 'capture-history', label: 'Capture History', dateScoped: true },
  { key: 'locations', label: 'Locations Master', dateScoped: false },
  { key: 'notification-history', label: 'Notification History', dateScoped: true },
];

function triggerDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}

export function SeasonPage() {
  const today = useMemo(() => getTodayIST(), []);
  const [startDate, setStartDate] = useState(() => getSeasonStartDefault());
  const [endDate, setEndDate] = useState(() => getTodayIST());
  const [downloadingExports, setDownloadingExports] = useState<Record<string, boolean>>({});
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Season controls state
  const [showEndModal, setShowEndModal] = useState(false);
  // showStartModal state removed — merged into end season flow
  const [confirmText, setConfirmText] = useState('');
  const [resetTerritories, setResetTerritories] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState(2);
  const [seasonNotification, setSeasonNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Queries
  const { data: seasonStatus } = useQuery({
    queryKey: ['season-status'],
    queryFn: getSeasonStatus,
    staleTime: 60_000,
  });

  const { data: clanScores, isLoading: scoresLoading } = useQuery({
    queryKey: ['clan-scores'],
    queryFn: getClanScores,
  });

  const {
    data: hallOfFame,
    isLoading: hofLoading,
    error: hofError,
  } = useQuery({
    queryKey: ['hall-of-fame'],
    queryFn: getHallOfFame,
  });

  // Season reset mutation
  const resetMut = useMutation({
    mutationFn: resetSeason,
    onSuccess: (data) => {
      setSeasonNotification({
        type: 'success',
        message: `Season reset complete: ${data.usersReset} users, ${data.clansReset} clans${data.territoriesReset ? `, ${data.territoriesReset} territories` : ''} reset. New season: ${data.newSeasonNumber}`,
      });
      setShowEndModal(false);
      setConfirmText('');
      setTimeout(() => setSeasonNotification(null), 8000);
    },
    onError: (err) => {
      setSeasonNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Season reset failed',
      });
      setTimeout(() => setSeasonNotification(null), 8000);
    },
  });

  // Export handlers
  async function handleExportSingle(item: ExportItem) {
    setDownloadingExports((prev) => ({ ...prev, [item.key]: true }));
    setExportError(null);
    try {
      const sd = item.dateScoped ? startDate : undefined;
      const ed = item.dateScoped ? endDate : undefined;
      const csv = await fetchExportCsv(item.key, sd, ed);
      const filename = item.dateScoped
        ? `${item.key}_${startDate}_to_${endDate}.csv`
        : `${item.key}_${today}.csv`;
      triggerDownload(csv, filename);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
      setTimeout(() => setExportError(null), 8000);
    } finally {
      setDownloadingExports((prev) => ({ ...prev, [item.key]: false }));
    }
  }

  async function handleExportAll() {
    setDownloadingAll(true);
    setExportError(null);
    try {
      const results = await Promise.all(
        EXPORTS.map(async (item) => {
          const sd = item.dateScoped ? startDate : undefined;
          const ed = item.dateScoped ? endDate : undefined;
          const csv = await fetchExportCsv(item.key, sd, ed);
          const filename = item.dateScoped
            ? `${item.key}_${startDate}_to_${endDate}.csv`
            : `${item.key}_${today}.csv`;
          return { filename, csv };
        }),
      );

      const zip = new JSZip();
      for (const { filename, csv } of results) {
        zip.file(filename, csv);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `grovewars_export_${startDate}_to_${endDate}.zip`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
      setTimeout(() => setExportError(null), 8000);
    } finally {
      setDownloadingAll(false);
    }
  }

  // Compute season stats from hall of fame data
  const totalTerritoriesPerClan = hallOfFame?.territoriesPerClan ?? {};

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#3D2B1F]">Season Management</h1>

      {seasonNotification && (
        <div
          className={`mb-4 rounded p-3 text-sm ${
            seasonNotification.type === 'success'
              ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {seasonNotification.message}
        </div>
      )}

      {/* ── SECTION 1: Season Status ──────────────────────────────────── */}
      <div className="mb-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#3D2B1F]">Season Status</h2>
          {seasonStatus?.seasonStartDate && (
            <div className="text-right text-xs text-[#3D2B1F]/60">
              <span className="font-semibold text-[#3D2B1F]">Season {seasonStatus.seasonNumber}</span>
              {' \u2014 '}
              Started {seasonStatus.seasonStartDate}
              {seasonStatus.seasonEndDate
                ? ` \u2014 Ended ${seasonStatus.seasonEndDate}`
                : ` \u2014 Day ${Math.max(1, Math.ceil((Date.now() - new Date(seasonStatus.seasonStartDate + 'T00:00:00').getTime()) / 86400000) + 1)}`}
            </div>
          )}
        </div>
        {scoresLoading || hofLoading ? (
          <LoadingSpinner />
        ) : hofError ? (
          <ErrorAlert message={(hofError as Error).message} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Unique Players"
                value={hallOfFame?.seasonStats.totalUniquePlayers ?? 0}
              />
              <StatCard
                label="Game Sessions"
                value={hallOfFame?.seasonStats.totalGameSessions ?? 0}
              />
              <StatCard
                label="Territories Captured"
                value={Object.values(totalTerritoriesPerClan).reduce((a, b) => a + b, 0)}
              />
              <StatCard
                label="Longest Streak"
                value={hallOfFame?.longestStreakHolders?.[0]?.bestStreak ?? 0}
              />
            </div>

            {/* Clan territory cards */}
            {clanScores && clanScores.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {clanScores.map((clan) => (
                  <div
                    key={clan.clanId}
                    className="rounded-lg border-2 p-3 text-center"
                    style={{
                      borderColor: CLAN_COLORS[clan.clanId] ?? '#8B6914',
                      backgroundColor: `${CLAN_COLORS[clan.clanId] ?? '#8B6914'}10`,
                    }}
                  >
                    <div
                      className="text-xs font-bold uppercase"
                      style={{ color: CLAN_COLORS[clan.clanId] ?? '#8B6914' }}
                    >
                      {CLAN_LABELS[clan.clanId] ?? clan.clanId}
                    </div>
                    <div className="mt-1 text-xl font-bold text-[#3D2B1F]">
                      {clan.spacesCaptured}
                    </div>
                    <div className="text-xs text-[#3D2B1F]/50">territories</div>
                    <div className="mt-1 text-xs text-[#3D2B1F]/60">
                      {clan.seasonXp} XP
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Data Export ─────────────────────────────────────── */}
      <div className="mb-6 rounded-lg border-2 border-[#8B6914]/30 bg-white p-4">
        <h2 className="mb-1 text-lg font-semibold text-[#3D2B1F]">Data Export</h2>
        <p className="mb-4 text-sm text-[#3D2B1F]/50">
          Export a snapshot of current data. Date-scoped exports filter by the selected range.
        </p>

        {exportError && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {exportError}
          </div>
        )}

        {/* Date range picker */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>
          <button
            onClick={handleExportAll}
            disabled={downloadingAll}
            className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            {downloadingAll ? 'Preparing ZIP...' : 'Download All (ZIP)'}
          </button>
        </div>

        {/* Individual export buttons */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORTS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleExportSingle(item)}
              disabled={downloadingExports[item.key]}
              className="flex items-center justify-between rounded border border-[#8B6914]/20 bg-[#F5EACB]/50 px-4 py-3 text-left text-sm font-medium text-[#3D2B1F] hover:bg-[#F5EACB] disabled:opacity-50"
            >
              <span>
                {item.label}
                {!item.dateScoped && (
                  <span className="ml-1 text-xs text-[#3D2B1F]/40">(full snapshot)</span>
                )}
              </span>
              {downloadingExports[item.key] ? (
                <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#8B6914] border-t-transparent" />
              ) : (
                <span className="ml-2 text-[#8B6914]">CSV</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: Season Controls ────────────────────────────────── */}
      <div className="mb-6 rounded-lg border border-red-300/40 bg-red-50/30 p-4">
        <h2 className="mb-1 text-lg font-semibold text-[#3D2B1F]">Season Controls</h2>
        <p className="mb-4 rounded bg-red-100 px-3 py-2 text-xs font-medium text-red-700">
          These actions are irreversible and reset live data. Export your data first.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setShowEndModal(true);
              setConfirmText('');
              setResetTerritories(false);
              setNewSeasonNumber(2);
            }}
            className="rounded bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A93226]"
          >
            End Season & Reset
          </button>
        </div>
      </div>

      {/* ── SECTION 4: Hall of Fame ───────────────────────────────────── */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#3D2B1F]">Hall of Fame</h2>
          {hallOfFame && (
            <button
              onClick={() => generateLobbyPoster(hallOfFame, seasonStatus?.seasonNumber ?? 1, seasonStatus?.seasonStartDate, seasonStatus?.seasonEndDate)}
              className="rounded bg-[#8B6914] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6B5210]"
            >
              Export for Lobby Poster (PDF)
            </button>
          )}
        </div>
        {hofLoading ? (
          <LoadingSpinner />
        ) : hofError ? (
          <ErrorAlert message={(hofError as Error).message} />
        ) : hallOfFame ? (
          <HallOfFameSection data={hallOfFame} />
        ) : (
          <p className="text-sm text-[#3D2B1F]/50">No data available.</p>
        )}
      </div>

      {/* ── End Season Modal ──────────────────────────────────────────── */}
      {showEndModal && (
        <ConfirmModal
          title="End Season & Reset"
          description="This will reset ALL player XP (seasonXp, todayXp, currentStreak, bestStreak) to 0 and reset all clan stats. This cannot be undone."
          confirmLabel="Reset Season"
          onConfirm={() =>
            resetMut.mutate({ resetTerritories, newSeasonNumber })
          }
          onCancel={() => {
            setShowEndModal(false);
            setConfirmText('');
          }}
          isPending={resetMut.isPending}
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        >
          <div className="mb-3 space-y-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
                New Season Number
              </label>
              <input
                type="number"
                value={newSeasonNumber}
                onChange={(e) => setNewSeasonNumber(parseInt(e.target.value) || 1)}
                min={1}
                className="w-24 rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#3D2B1F]">
              <input
                type="checkbox"
                checked={resetTerritories}
                onChange={(e) => setResetTerritories(e.target.checked)}
                className="accent-[#8B6914]"
              />
              Also reset territories (archive current captures)
            </label>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}

// ── Lobby Poster PDF Generator ──────────────────────────────────────────

function generateLobbyPoster(
  data: HallOfFameData,
  seasonNumber: number,
  startDate?: string | null,
  endDate?: string | null,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // ~297
  const pageH = doc.internal.pageSize.getHeight(); // ~210
  const margin = 15;
  const leftColW = (pageW - margin * 2) * 0.58;
  const rightColX = margin + leftColW + 10;

  // Title
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(`GROVEWARS — SEASON ${seasonNumber} RESULTS`, pageW / 2, margin + 10, { align: 'center' });

  // Subtitle (dates)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const dateRange = startDate && endDate ? `${startDate} — ${endDate}` : startDate ? `Started ${startDate}` : '';
  if (dateRange) {
    doc.text(dateRange, pageW / 2, margin + 18, { align: 'center' });
  }

  let y = margin + 28;

  // ── LEFT COLUMN ──

  // Winning clan
  if (data.winningClan) {
    const winnerName = CLAN_LABELS[data.winningClan.clanId] ?? data.winningClan.clanId;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`WINNING CLAN: ${winnerName.toUpperCase()}`, margin, y);
    y += 8;
  }

  // Territories summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const terrParts = Object.entries(data.territoriesPerClan)
    .sort(([, a], [, b]) => b - a)
    .map(([c, n]) => `${CLAN_LABELS[c] ?? c} ${n}`);
  doc.text(`Territories: ${terrParts.join(', ')}`, margin, y);
  y += 10;

  // Top 10 players
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOP PLAYERS (Season XP):', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  for (const player of data.topPlayers.slice(0, 10)) {
    const clanLabel = CLAN_LABELS[player.clan] ?? player.clan;
    doc.text(`${player.rank}. ${player.displayName} (${clanLabel}) — ${player.seasonXp} XP`, margin + 2, y);
    y += 5;
  }
  y += 4;

  // Longest streaks
  if (data.longestStreakHolders.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('LONGEST STREAKS:', margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const holder of data.longestStreakHolders.slice(0, 5)) {
      const clanLabel = CLAN_LABELS[holder.clan] ?? holder.clan;
      doc.text(`${holder.displayName} (${clanLabel}) — ${holder.bestStreak} day streak`, margin + 2, y);
      y += 5;
    }
  }

  // ── RIGHT COLUMN ──
  let ry = margin + 28;

  // Season stats
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SEASON STATS:', rightColX, ry);
  ry += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Unique Players: ${data.seasonStats.totalUniquePlayers}`, rightColX + 2, ry);
  ry += 5;
  doc.text(`Total Game Sessions: ${data.seasonStats.totalGameSessions}`, rightColX + 2, ry);
  ry += 5;
  const totalTerritories = Object.values(data.territoriesPerClan).reduce((a, b) => a + b, 0);
  doc.text(`Territories Captured: ${totalTerritories}`, rightColX + 2, ry);
  ry += 10;

  // Clan standings
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CLAN STANDINGS:', rightColX, ry);
  ry += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Clan', rightColX + 2, ry);
  doc.text('Territories', rightColX + 40, ry);
  ry += 5;

  doc.setFont('helvetica', 'normal');
  const sortedClans = Object.entries(data.territoriesPerClan).sort(([, a], [, b]) => b - a);
  for (const [clanId, count] of sortedClans) {
    doc.text(CLAN_LABELS[clanId] ?? clanId, rightColX + 2, ry);
    doc.text(String(count), rightColX + 40, ry);
    ry += 5;
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Generated by GroveWars Admin Dashboard', pageW / 2, pageH - 8, { align: 'center' });

  doc.save(`grovewars_season_${seasonNumber}_poster.pdf`);
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-[#F5EACB]/30 p-3 text-center">
      <div className="text-2xl font-bold text-[#3D2B1F]">{value.toLocaleString()}</div>
      <div className="text-xs text-[#3D2B1F]/50">{label}</div>
    </div>
  );
}

function HallOfFameSection({ data }: { data: HallOfFameData }) {
  const maxBar = Math.max(
    1,
    ...Object.values(data.territoriesPerClan),
  );

  return (
    <div className="space-y-6">
      {/* Winning clan */}
      {data.winningClan && (
        <div
          className="flex items-center gap-3 rounded-lg border-2 p-4"
          style={{
            borderColor: CLAN_COLORS[data.winningClan.clanId] ?? '#8B6914',
            backgroundColor: `${CLAN_COLORS[data.winningClan.clanId] ?? '#8B6914'}15`,
          }}
        >
          <span className="text-3xl">&#127942;</span>
          <div>
            <div
              className="text-lg font-bold"
              style={{ color: CLAN_COLORS[data.winningClan.clanId] ?? '#8B6914' }}
            >
              {CLAN_LABELS[data.winningClan.clanId] ?? data.winningClan.clanId}
            </div>
            <div className="text-sm text-[#3D2B1F]/70">
              {data.winningClan.spacesCaptured} territories captured — Season Champions
            </div>
          </div>
        </div>
      )}

      {/* Territory bars */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#3D2B1F]">Territories per Clan</h3>
        <div className="space-y-2">
          {Object.entries(data.territoriesPerClan)
            .sort(([, a], [, b]) => b - a)
            .map(([clanId, count]) => (
              <div key={clanId} className="flex items-center gap-2">
                <span className="w-14 text-xs font-bold uppercase" style={{ color: CLAN_COLORS[clanId] ?? '#8B6914' }}>
                  {CLAN_LABELS[clanId] ?? clanId}
                </span>
                <div className="flex-1">
                  <div
                    className="h-5 rounded"
                    style={{
                      width: `${(count / maxBar) * 100}%`,
                      backgroundColor: CLAN_COLORS[clanId] ?? '#8B6914',
                      minWidth: count > 0 ? '2rem' : '0',
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-bold text-[#3D2B1F]">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Top 10 players */}
      {data.topPlayers.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#3D2B1F]">Top 10 Players by Season XP</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Player</th>
                  <th className="py-2 pr-2">Clan</th>
                  <th className="py-2 pr-2 text-right">Season XP</th>
                  <th className="py-2 pr-2 text-right">Wins</th>
                  <th className="py-2 text-right">Best Streak</th>
                </tr>
              </thead>
              <tbody>
                {data.topPlayers.map((player) => (
                  <tr key={`${player.rank}-${player.displayName}`} className="border-b border-[#8B6914]/10">
                    <td className="py-2 pr-2 font-bold text-[#3D2B1F]">{player.rank}</td>
                    <td className="py-2 pr-2 text-[#3D2B1F]">{player.displayName}</td>
                    <td className="py-2 pr-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: CLAN_COLORS[player.clan] ?? '#8B6914' }}
                      >
                        {CLAN_LABELS[player.clan] ?? player.clan}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-medium text-[#3D2B1F]">{player.seasonXp}</td>
                    <td className="py-2 pr-2 text-right text-[#3D2B1F]/70">{player.totalWins}</td>
                    <td className="py-2 text-right text-[#3D2B1F]/70">{player.bestStreak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Longest streak holders */}
      {data.longestStreakHolders.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#3D2B1F]">Longest Streak Holders</h3>
          <div className="flex flex-wrap gap-2">
            {data.longestStreakHolders.map((holder, i) => (
              <span
                key={i}
                className="rounded-full border px-3 py-1 text-sm"
                style={{
                  borderColor: CLAN_COLORS[holder.clan] ?? '#8B6914',
                  color: CLAN_COLORS[holder.clan] ?? '#8B6914',
                }}
              >
                {holder.displayName} — {holder.bestStreak} day streak
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  isPending,
  confirmText,
  onConfirmTextChange,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  confirmText: string;
  onConfirmTextChange: (val: string) => void;
  children?: React.ReactNode;
}) {
  const confirmed = confirmText === 'RESET';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">{title}</h3>
        <p className="mb-4 text-sm text-[#3D2B1F]/70">{description}</p>

        {children}

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
            Type <span className="font-bold text-[#C0392B]">RESET</span> to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder="RESET"
            className="w-full rounded border border-red-300 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#C0392B] focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || isPending}
            className="rounded bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A93226] disabled:opacity-50"
          >
            {isPending ? 'Resetting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
