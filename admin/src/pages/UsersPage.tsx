import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import {
  getAllUsers,
  getUserSessions,
  getUserDetail,
  updateUserStatus,
  adjustUserXp,
  updateUserCluster,
  type AdminUser,
  type AdminGameSession,
  type SpaceTypeDistribution,
} from '@/api/users';

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

const CLANS = ['ember', 'tide', 'bloom', 'gale', 'hearth'] as const;

const CLUSTER_COLORS: Record<string, string> = {
  nomad: '#E67E22',
  drifter: '#3498DB',
  forced: '#95A5A6',
  seeker: '#2ECC71',
  disengaged: '#E74C3C',
};

const CLUSTER_LABELS: Record<string, string> = {
  nomad: 'Nomad',
  drifter: 'Drifter',
  forced: 'Forced Occupant',
  seeker: 'Seeker',
  disengaged: 'Disengaged',
};

const CLUSTER_DESCRIPTIONS: Record<string, string> = {
  nomad: 'Explored widely across campus in Phase 1',
  drifter: 'Visited socially-driven spaces, moderate exploration',
  forced: 'Mostly visited transit/required spaces only',
  seeker: 'Actively sought out lesser-known spaces',
  disengaged: 'Minimal campus engagement in Phase 1',
};

const SPACE_TYPE_COLORS: Record<string, string> = {
  'Social Hub': '#3498DB',
  'Transit / Forced Stay': '#95A5A6',
  'Hidden Gem': '#2ECC71',
  'Dead Zone': '#E74C3C',
  'Unvisited': '#F39C12',
};

const SPACE_TYPE_SHORT: Record<string, string> = {
  'Social Hub': 'Social Hub',
  'Transit / Forced Stay': 'Transit',
  'Hidden Gem': 'Hidden Gem',
  'Dead Zone': 'Dead Zone',
  'Unvisited': 'Unvisited',
};

const ALL_CLUSTERS = ['nomad', 'drifter', 'forced', 'seeker', 'disengaged', 'none'] as const;

type SortKey =
  | 'displayName'
  | 'email'
  | 'clan'
  | 'seasonXp'
  | 'totalWins'
  | 'currentStreak'
  | 'bestStreak'
  | 'lastActiveDate';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatIST(iso: string): string {
  try {
    const d = new Date(iso);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(d.getTime() + istOffset);
    const date = ist.toISOString().slice(0, 10);
    const time = ist.toISOString().slice(11, 16);
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clanFilter, setClanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('seasonXp');
  const [sortAsc, setSortAsc] = useState(false);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAllUsers,
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    let result = [...users];

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }

    // Clan filter
    if (clanFilter !== 'all') {
      result = result.filter((u) => u.clan === clanFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter((u) => !u.banned);
    } else if (statusFilter === 'banned') {
      result = result.filter((u) => u.banned);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [users, search, clanFilter, statusFilter, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'displayName' || key === 'email' || key === 'clan');
    }
  }

  const selectedUser = users?.find((u) => u.userId === selectedUserId);

  if (selectedUser) {
    return (
      <PlayerDetail
        user={selectedUser}
        onBack={() => setSelectedUserId(null)}
        onMutated={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-[#3D2B1F]">Users</h1>

      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-64 rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
        />

        {/* Clan filter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setClanFilter('all')}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              clanFilter === 'all'
                ? 'bg-[#8B6914] text-white'
                : 'bg-[#F5EACB] text-[#3D2B1F] hover:bg-[#D4A843]/30'
            }`}
          >
            All
          </button>
          {CLANS.map((c) => (
            <button
              key={c}
              onClick={() => setClanFilter(c)}
              className="rounded px-3 py-1.5 text-xs font-bold"
              style={{
                backgroundColor: clanFilter === c ? CLAN_COLORS[c] : `${CLAN_COLORS[c]}15`,
                color: clanFilter === c ? 'white' : CLAN_COLORS[c],
              }}
            >
              {CLAN_LABELS[c]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-[#8B6914]/30 bg-white px-3 py-1.5 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>

        <span className="ml-auto text-sm text-[#3D2B1F]/50">
          Showing {filteredUsers.length} of {users?.length ?? 0} players
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorAlert message={(error as Error).message} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#8B6914]/20 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                <SortHeader label="Name" sortKey="displayName" current={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Email" sortKey="email" current={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Clan" sortKey="clan" current={sortKey} asc={sortAsc} onSort={handleSort} />
                <SortHeader label="Season XP" sortKey="seasonXp" current={sortKey} asc={sortAsc} onSort={handleSort} align="right" />
                <SortHeader label="Wins" sortKey="totalWins" current={sortKey} asc={sortAsc} onSort={handleSort} align="right" />
                <SortHeader label="Streak" sortKey="currentStreak" current={sortKey} asc={sortAsc} onSort={handleSort} align="right" />
                <SortHeader label="Best" sortKey="bestStreak" current={sortKey} asc={sortAsc} onSort={handleSort} align="right" />
                <SortHeader label="Last Active" sortKey="lastActiveDate" current={sortKey} asc={sortAsc} onSort={handleSort} />
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.userId}
                  onClick={() => setSelectedUserId(u.userId)}
                  className="cursor-pointer border-b border-[#8B6914]/10 hover:bg-[#F5EACB]/50"
                >
                  <td className="px-3 py-2 font-medium text-[#3D2B1F]">{u.displayName}</td>
                  <td className="px-3 py-2 text-[#3D2B1F]/70">{u.email}</td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: CLAN_COLORS[u.clan] ?? '#8B6914' }}
                    >
                      {CLAN_LABELS[u.clan] ?? u.clan}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[#3D2B1F]">{u.seasonXp}</td>
                  <td className="px-3 py-2 text-right text-[#3D2B1F]/70">{u.totalWins}</td>
                  <td className="px-3 py-2 text-right text-[#3D2B1F]/70">{u.currentStreak}</td>
                  <td className="px-3 py-2 text-right text-[#3D2B1F]/70">{u.bestStreak}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#3D2B1F]/70">{formatDate(u.lastActiveDate)}</td>
                  <td className="px-3 py-2">
                    {u.banned ? (
                      <span className="rounded-full bg-[#C0392B]/10 px-2 py-0.5 text-xs font-bold text-[#C0392B]">Banned</span>
                    ) : (
                      <span className="rounded-full bg-[#27AE60]/10 px-2 py-0.5 text-xs font-bold text-[#27AE60]">Active</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-[#3D2B1F]/50">
                    No players match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sort Header ─────────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  current,
  asc,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
  align?: 'right';
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-3 py-2 hover:text-[#3D2B1F] ${
        align === 'right' ? 'text-right' : ''
      } ${active ? 'text-[#8B6914]' : ''}`}
    >
      {label}
      {active && <span className="ml-1">{asc ? '\u25B2' : '\u25BC'}</span>}
    </th>
  );
}

// ── Player Detail View ──────────────────────────────────────────────────

function PlayerDetail({
  user,
  onBack,
  onMutated,
}: {
  user: AdminUser;
  onBack: () => void;
  onMutated: () => void;
}) {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ban/unban state
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');

  // XP adjust state
  const [showXpModal, setShowXpModal] = useState(false);
  const [xpAmount, setXpAmount] = useState(0);
  const [xpReason, setXpReason] = useState('');

  // Cluster override state
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterValue, setClusterValue] = useState<string>(user.phase1Cluster || 'none');

  // Sessions query
  const [sessionCursor, setSessionCursor] = useState<string | undefined>();
  const [allSessions, setAllSessions] = useState<AdminGameSession[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Enhanced detail query
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-user-detail', user.userId],
    queryFn: () => getUserDetail(user.userId),
  });

  const { isLoading: sessionsLoading } = useQuery({
    queryKey: ['admin-user-sessions', user.userId],
    queryFn: async () => {
      const res = await getUserSessions(user.userId);
      setAllSessions(res.sessions);
      setSessionCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
      return res;
    },
  });

  const loadMoreMut = useMutation({
    mutationFn: () => getUserSessions(user.userId, sessionCursor),
    onSuccess: (res) => {
      setAllSessions((prev) => [...prev, ...res.sessions]);
      setSessionCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    },
  });

  // Ban/unban mutation
  const statusMut = useMutation({
    mutationFn: () => {
      const newStatus = user.banned ? 'active' : 'banned';
      return updateUserStatus(user.userId, newStatus, banReason.trim() || undefined);
    },
    onSuccess: () => {
      const action = user.banned ? 'unbanned' : 'banned';
      showToast('success', `Player ${action} successfully.`);
      setShowBanModal(false);
      setBanReason('');
      onMutated();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => {
      showToast('error', err instanceof Error ? err.message : 'Operation failed');
    },
  });

  // XP adjust mutation
  const xpMut = useMutation({
    mutationFn: () => adjustUserXp(user.userId, xpAmount, xpReason.trim()),
    onSuccess: (data) => {
      showToast('success', `XP adjusted. New Season XP: ${data.newSeasonXp}`);
      setShowXpModal(false);
      setXpAmount(0);
      setXpReason('');
      onMutated();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => {
      showToast('error', err instanceof Error ? err.message : 'XP adjust failed');
    },
  });

  // Cluster override mutation
  const clusterMut = useMutation({
    mutationFn: () => {
      const val = clusterValue === 'none' ? null : clusterValue;
      return updateUserCluster(user.userId, val);
    },
    onSuccess: (data) => {
      showToast('success', `Cluster updated to: ${data.newCluster ?? 'none'}`);
      setShowClusterModal(false);
      onMutated();
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', user.userId] });
    },
    onError: (err) => {
      showToast('error', err instanceof Error ? err.message : 'Cluster update failed');
    },
  });

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), type === 'success' ? 5000 : 8000);
  }

  const computed = detail?.computed;
  const phase1 = detail?.phase1Comparison;
  const assignments = detail?.assignmentHistory;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 text-sm font-medium text-[#8B6914] hover:underline"
      >
        &larr; Back to list
      </button>

      {toast && (
        <div
          className={`mb-4 rounded p-3 text-sm ${
            toast.type === 'success'
              ? 'border border-[#27AE60]/30 bg-[#27AE60]/10 text-[#27AE60]'
              : 'border border-red-300 bg-red-50 text-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* SECTION A — Header */}
      <div className="mb-4 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-[#3D2B1F]">{user.displayName}</h2>
          <span className="text-sm text-[#3D2B1F]/50">{user.email}</span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: CLAN_COLORS[user.clan] ?? '#8B6914' }}
          >
            {CLAN_LABELS[user.clan] ?? user.clan}
          </span>
          {user.phase1Cluster && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: CLUSTER_COLORS[user.phase1Cluster] ?? '#8B6914' }}
            >
              {CLUSTER_LABELS[user.phase1Cluster] ?? user.phase1Cluster}
            </span>
          )}
          {user.banned ? (
            <span className="rounded-full bg-[#C0392B]/10 px-2 py-0.5 text-xs font-bold text-[#C0392B]">
              Banned
            </span>
          ) : (
            <span className="rounded-full bg-[#27AE60]/10 px-2 py-0.5 text-xs font-bold text-[#27AE60]">
              Active
            </span>
          )}
        </div>
        {user.banned && user.banReason && (
          <p className="mt-2 text-sm text-[#C0392B]/70">
            Ban reason: {user.banReason}
            {user.bannedAt && ` (${formatDate(user.bannedAt)})`}
          </p>
        )}
        {user.avatarConfig && (
          <p className="mt-2 text-xs text-[#3D2B1F]/40">
            Avatar: hair={user.avatarConfig.hairStyle}, color={user.avatarConfig.hairColor},
            skin={user.avatarConfig.skinTone}, outfit={user.avatarConfig.outfit},
            accessory={user.avatarConfig.accessory}
            {user.avatarConfig.characterPreset !== undefined && `, preset=${user.avatarConfig.characterPreset}`}
          </p>
        )}
        <p className="mt-1 text-xs text-[#3D2B1F]/40">ID: {user.userId}</p>
      </div>

      {/* SECTION B — Season Stats */}
      {detailLoading ? (
        <div className="mb-4"><LoadingSpinner /></div>
      ) : computed ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Season XP" value={String(user.seasonXp)} />
          <StatCard label="Today XP" value={`${user.todayXp} / 100`} />
          <StatCard label="Total Wins" value={String(user.totalWins)} />
          <StatCard label="Total Losses" value={String(computed.totalLosses)} />
          <StatCard label="Games Played" value={String(computed.totalGamesPlayed)} />
          <StatCard label="Checkins" value={String(computed.totalCheckins)} />
          <StatCard
            label="Current Streak"
            value={`${user.currentStreak}${user.currentStreak >= 3 ? ' \uD83D\uDD25' : ''}`}
          />
          <StatCard label="Best Streak" value={String(user.bestStreak)} />
          <StatCard
            label="Unique Locations"
            value={`${computed.uniqueLocationsVisited} / ${computed.totalLocations}`}
          />
          <StatCard label="Favorite Minigame" value={computed.favoriteMinigame ?? '-'} />
          <StatCard label="Co-op Games" value={String(computed.coopGamesPlayed)} />
          <StatCard
            label="Avg Session Time"
            value={computed.avgSessionTimeSeconds != null ? `${computed.avgSessionTimeSeconds}s` : '-'}
          />
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Today XP" value={`${user.todayXp} / 100`} />
          <StatCard label="Season XP" value={String(user.seasonXp)} />
          <StatCard label="Total Wins" value={String(user.totalWins)} />
          <StatCard label="Streak" value={`${user.currentStreak} / ${user.bestStreak}`} subLabel="current / best" />
          <StatCard label="Tutorial" value={user.tutorialDone ? 'Done' : 'No'} />
          <StatCard label="Created" value={formatDate(user.createdAt)} />
        </div>
      )}

      {/* SECTION C — Phase 1 Profile */}
      {phase1 && (
        <div className="mb-4 rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Phase 1 Profile</h3>
          <div className="flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-sm font-bold text-white"
              style={{ backgroundColor: CLUSTER_COLORS[phase1.cluster] ?? '#8B6914' }}
            >
              {CLUSTER_LABELS[phase1.cluster] ?? phase1.cluster}
            </span>
            <span className="text-sm text-[#3D2B1F]/70">
              {CLUSTER_DESCRIPTIONS[phase1.cluster] ?? ''}
            </span>
          </div>
        </div>
      )}

      {/* SECTION D — Phase 2 Behaviour Shift */}
      {phase1 && phase1.phase2Distribution && (
        <div className="mb-4 rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Phase 2 Behaviour Shift</h3>
          <SpaceTypeBar distribution={phase1.phase2Distribution} />
          <p className="mt-2 text-sm text-[#3D2B1F]/70">
            Now visiting:{' '}
            {Object.entries(phase1.phase2Distribution)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${v}% ${SPACE_TYPE_SHORT[k] || k}`)
              .join(', ')}
          </p>
          {phase1.significantShift ? (
            <p className="mt-1 text-sm font-medium text-[#27AE60]">
              &rarr; Significant shift from Phase 1
            </p>
          ) : (
            <p className="mt-1 text-sm text-[#3D2B1F]/40">
              &rarr; Similar to Phase 1 pattern
            </p>
          )}
        </div>
      )}

      {/* SECTION E — Assignment History */}
      {assignments && assignments.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#8B6914]/20 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Assignment History (Last 5 Days)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Assigned Locations</th>
                  <th className="py-2">Visited</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.date} className="border-b border-[#8B6914]/10">
                    <td className="whitespace-nowrap py-2 pr-3 text-[#3D2B1F]/70">{a.date}</td>
                    <td className="py-2 pr-3">
                      {a.assignedLocations.map((loc) => {
                        const visited = a.visitedLocationIds.includes(loc.locationId);
                        return (
                          <span
                            key={loc.locationId}
                            className={`mr-2 inline-block rounded px-1.5 py-0.5 text-xs ${
                              visited
                                ? 'bg-[#27AE60]/10 font-medium text-[#27AE60]'
                                : 'bg-[#3D2B1F]/5 text-[#3D2B1F]/40'
                            }`}
                          >
                            {loc.name}
                          </span>
                        );
                      })}
                    </td>
                    <td className="py-2 text-sm text-[#3D2B1F]/70">
                      {a.visitedLocationIds.length} / {a.assignedLocations.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session history */}
      <div className="mb-4 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Game Sessions</h3>
        {sessionsLoading ? (
          <LoadingSpinner />
        ) : allSessions.length === 0 ? (
          <p className="text-sm text-[#3D2B1F]/50">No game sessions found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Minigame</th>
                    <th className="py-2 pr-3">Result</th>
                    <th className="py-2 pr-3 text-right">XP</th>
                    <th className="py-2 pr-3">Chest</th>
                    <th className="py-2">Co-op</th>
                  </tr>
                </thead>
                <tbody>
                  {allSessions.map((s) => (
                    <tr key={s.sessionId} className="border-b border-[#8B6914]/10">
                      <td className="whitespace-nowrap py-2 pr-3 text-[#3D2B1F]/70">{formatIST(s.startedAt)}</td>
                      <td className="py-2 pr-3 text-[#3D2B1F]">{s.locationId.slice(0, 8)}...</td>
                      <td className="py-2 pr-3 text-[#3D2B1F]">{s.minigameId}</td>
                      <td className="py-2 pr-3">
                        <ResultBadge result={s.result} />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-[#3D2B1F]">{s.xpEarned}</td>
                      <td className="py-2 pr-3 text-[#3D2B1F]/70">{s.chestDropped ? 'Yes' : '-'}</td>
                      <td className="py-2 text-xs text-[#3D2B1F]/50">
                        {s.coopPartnerId ? s.coopPartnerId.slice(0, 8) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button
                onClick={() => loadMoreMut.mutate()}
                disabled={loadMoreMut.isPending}
                className="mt-3 rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
              >
                {loadMoreMut.isPending ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>

      {/* SECTION F — Admin Actions */}
      <div className="rounded-lg border border-red-300/40 bg-red-50/30 p-4">
        <h3 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Admin Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setShowBanModal(true);
              setBanReason('');
            }}
            className={`rounded px-4 py-2 text-sm font-semibold text-white ${
              user.banned
                ? 'bg-[#27AE60] hover:bg-[#219A52]'
                : 'bg-[#C0392B] hover:bg-[#A93226]'
            }`}
          >
            {user.banned ? 'Unban Player' : 'Ban Player'}
          </button>
          <button
            onClick={() => {
              setShowXpModal(true);
              setXpAmount(0);
              setXpReason('');
            }}
            className="rounded bg-[#D4A843] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8922E]"
          >
            Adjust XP
          </button>
          <button
            onClick={() => {
              setClusterValue(user.phase1Cluster || 'none');
              setShowClusterModal(true);
            }}
            className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D5210]"
          >
            Override Cluster
          </button>
        </div>
      </div>

      {/* Ban/Unban modal */}
      {showBanModal && (
        <ModalOverlay>
          <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">
            {user.banned ? 'Unban Player' : 'Ban Player'}
          </h3>
          <p className="mb-3 text-sm text-[#3D2B1F]/70">
            {user.banned
              ? `Unban ${user.displayName}? They will be able to play again.`
              : `Ban ${user.displayName}? They will not be able to play.`}
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
              Reason {user.banned ? '(optional)' : '(required)'}
            </label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Enter reason..."
              rows={2}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBanModal(false)}
              disabled={statusMut.isPending}
              className="rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => statusMut.mutate()}
              disabled={statusMut.isPending || (!user.banned && !banReason.trim())}
              className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                user.banned
                  ? 'bg-[#27AE60] hover:bg-[#219A52]'
                  : 'bg-[#C0392B] hover:bg-[#A93226]'
              }`}
            >
              {statusMut.isPending
                ? 'Processing...'
                : user.banned
                ? 'Unban'
                : 'Ban'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* XP Adjust modal */}
      {showXpModal && (
        <ModalOverlay>
          <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">Adjust Season XP</h3>
          <p className="mb-3 text-sm text-[#3D2B1F]/70">
            Current Season XP: <span className="font-bold">{user.seasonXp}</span>
          </p>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">
              Amount (positive to add, negative to subtract)
            </label>
            <input
              type="number"
              value={xpAmount || ''}
              onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
            {xpAmount !== 0 && (
              <p className="mt-1 text-xs text-[#3D2B1F]/50">
                New XP will be: {Math.max(0, user.seasonXp + xpAmount)}
              </p>
            )}
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">Reason (required)</label>
            <textarea
              value={xpReason}
              onChange={(e) => setXpReason(e.target.value)}
              placeholder="Enter reason for adjustment..."
              rows={2}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowXpModal(false)}
              disabled={xpMut.isPending}
              className="rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => xpMut.mutate()}
              disabled={xpMut.isPending || xpAmount === 0 || !xpReason.trim()}
              className="rounded bg-[#D4A843] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8922E] disabled:opacity-50"
            >
              {xpMut.isPending ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Cluster Override modal */}
      {showClusterModal && (
        <ModalOverlay>
          <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">Override Cluster</h3>
          <p className="mb-3 text-sm text-[#3D2B1F]/70">
            Current cluster: <span className="font-bold">{user.phase1Cluster ?? 'none'}</span>
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-[#3D2B1F]">New Cluster</label>
            <select
              value={clusterValue}
              onChange={(e) => setClusterValue(e.target.value)}
              className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
            >
              {ALL_CLUSTERS.map((c) => (
                <option key={c} value={c}>
                  {c === 'none' ? 'None (remove cluster)' : `${CLUSTER_LABELS[c] ?? c}`}
                </option>
              ))}
            </select>
            {clusterValue !== 'none' && CLUSTER_DESCRIPTIONS[clusterValue] && (
              <p className="mt-1 text-xs text-[#3D2B1F]/50">{CLUSTER_DESCRIPTIONS[clusterValue]}</p>
            )}
          </div>
          <p className="mb-4 text-xs text-[#C0392B]/70">
            This will change the player's Phase 1 cluster assignment and affect their location assignments.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowClusterModal(false)}
              disabled={clusterMut.isPending}
              className="rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => clusterMut.mutate()}
              disabled={clusterMut.isPending || clusterValue === (user.phase1Cluster || 'none')}
              className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D5210] disabled:opacity-50"
            >
              {clusterMut.isPending ? 'Applying...' : 'Confirm'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function ModalOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
  return (
    <div className="rounded-lg border border-[#8B6914]/20 bg-[#F5EACB]/30 p-3 text-center">
      <div className="text-lg font-bold text-[#3D2B1F]">{value}</div>
      <div className="text-xs text-[#3D2B1F]/50">{label}</div>
      {subLabel && <div className="text-xs text-[#3D2B1F]/30">{subLabel}</div>}
    </div>
  );
}

function SpaceTypeBar({ distribution }: { distribution: SpaceTypeDistribution }) {
  const entries = Object.entries(distribution).filter(([, v]) => v > 0);
  return (
    <div className="flex h-6 w-full overflow-hidden rounded">
      {entries.map(([key, pct]) => (
        <div
          key={key}
          title={`${SPACE_TYPE_SHORT[key] || key}: ${pct}%`}
          className="flex items-center justify-center text-xs font-bold text-white"
          style={{
            width: `${pct}%`,
            backgroundColor: SPACE_TYPE_COLORS[key] || '#8B6914',
            minWidth: pct > 0 ? '20px' : '0',
          }}
        >
          {pct >= 10 ? `${pct}%` : ''}
        </div>
      ))}
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (result === 'win') {
    return <span className="rounded-full bg-[#27AE60]/10 px-2 py-0.5 text-xs font-bold text-[#27AE60]">Win</span>;
  }
  if (result === 'lose') {
    return <span className="rounded-full bg-[#C0392B]/10 px-2 py-0.5 text-xs font-bold text-[#C0392B]">Lose</span>;
  }
  return <span className="rounded-full bg-[#3D2B1F]/10 px-2 py-0.5 text-xs font-bold text-[#3D2B1F]/50">{result}</span>;
}
