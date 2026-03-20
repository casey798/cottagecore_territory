import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sendNotification, getNotificationHistory, cancelNotification, sendTestNotification } from '@/api/notifications';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { format, toZonedTime } from 'date-fns-tz';
import type { ClanId } from '@/types';

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

const CLANS: ClanId[] = ['ember', 'tide', 'bloom', 'gale', 'hearth'];

const NOTIF_TYPES = [
  { value: 'info', label: 'Info', color: '#2980B9' },
  { value: 'event', label: 'Event', color: '#D4A843' },
  { value: 'alert', label: 'Alert', color: '#C0392B' },
  { value: 'hype', label: 'Hype', color: '#27AE60' },
] as const;

type NotifType = 'event' | 'alert' | 'hype' | 'info';

interface Template {
  emoji: string;
  label: string;
  message: string;
  target: 'all' | ClanId;
  type: NotifType;
  note?: string;
}

const TEMPLATES: Template[] = [
  {
    emoji: '\uD83C\uDF1F',
    label: 'Morning Start',
    message: "A new day dawns! Today's prize awaits. Go claim it for your clan!",
    target: 'all',
    type: 'hype',
  },
  {
    emoji: '\u2615',
    label: 'Event Window',
    message: 'Break time \u2014 challenges waiting nearby!',
    target: 'all',
    type: 'event',
  },
  {
    emoji: '\u23F0',
    label: 'Final Push',
    message: 'Last hour! Every win counts \u2014 check the scoreboard!',
    target: 'all',
    type: 'hype',
  },
  {
    emoji: '\uD83D\uDCA0',
    label: 'Dead Zone Event',
    message: 'Double XP at underexplored spaces today only!',
    target: 'all',
    type: 'event',
  },
  {
    emoji: '\uD83D\uDEB6',
    label: 'Nudge Forced',
    message: 'Take a 5-min break \u2014 solve a puzzle just outside your usual spot!',
    target: 'all',
    type: 'event',
    note: 'Best sent to Forced Occupants cluster',
  },
  {
    emoji: '\uD83D\uDE34',
    label: 'Nudge Disengaged',
    message: 'Quick win waiting nearby. 2 minutes, easy XP!',
    target: 'all',
    type: 'event',
    note: 'Best sent to Disengaged cluster',
  },
  {
    emoji: '\uD83D\uDD25',
    label: 'Streak Recovery',
    message: 'Miss the grove? Your streak is waiting \u2014 play today to keep it alive!',
    target: 'all',
    type: 'hype',
  },
];

const formatIST = (iso: string): string => {
  const zoned = toZonedTime(new Date(iso), 'Asia/Kolkata');
  return format(zoned, 'dd MMM yyyy, hh:mm a', { timeZone: 'Asia/Kolkata' });
};

const toLocalDatetimeString = (date: Date): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function NotificationsPage() {
  const queryClient = useQueryClient();

  // Compose form state
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | ClanId>('all');
  const [notifType, setNotifType] = useState<NotifType>('info');
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // History query
  const {
    data: notifications,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
    queryKey: ['notification-history'],
    queryFn: getNotificationHistory,
  });

  function scheduleToastDismiss(ms: number) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }

  // Send mutation
  const sendMut = useMutation({
    mutationFn: () =>
      sendNotification({
        message: message.trim(),
        target,
        notificationType: notifType,
        ...(scheduleMode && scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
      }),
    onSuccess: (data) => {
      if (data.status === 'scheduled') {
        setToast({
          type: 'success',
          message: `Notification scheduled for ${formatIST(data.scheduledFor ?? '')}`,
        });
      } else {
        setToast({
          type: 'success',
          message: `Notification sent! ${data.deliveryCount} device${data.deliveryCount !== 1 ? 's' : ''} reached.`,
        });
      }
      setMessage('');
      setTarget('all');
      setNotifType('info');
      setScheduleMode(false);
      setScheduledFor('');
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['notification-history'] });
      scheduleToastDismiss(5000);
    },
    onError: (err) => {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send notification',
      });
      setShowConfirm(false);
      scheduleToastDismiss(8000);
    },
  });

  // Cancel mutation
  const cancelMut = useMutation({
    mutationFn: cancelNotification,
    onSuccess: () => {
      setCancelTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['notification-history'] });
      setToast({ type: 'success', message: 'Scheduled notification cancelled' });
      scheduleToastDismiss(5000);
    },
    onError: (err) => {
      setCancelTargetId(null);
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Cancel failed' });
      scheduleToastDismiss(8000);
    },
  });

  // Test notification mutation
  const testMut = useMutation({
    mutationFn: sendTestNotification,
    onSuccess: () => {
      setToast({ type: 'success', message: 'Test notification sent!' });
      scheduleToastDismiss(5000);
    },
    onError: (err) => {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Test notification failed' });
      scheduleToastDismiss(8000);
    },
  });

  const canSend = message.trim().length > 0 && message.trim().length <= 140;
  const charsLeft = 140 - message.length;

  function getTargetDescription(): string {
    if (target === 'all') return 'All Players';
    return `${CLAN_LABELS[target] ?? target} clan`;
  }

  function applyTemplate(t: Template) {
    setMessage(t.message);
    setTarget(t.target);
    setNotifType(t.type);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#3D2B1F]">Notifications</h1>

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

      {/* ── SECTION 0: Quick Templates ────────────────────────────────── */}
      <div className="mb-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Quick Templates</h2>
        <p className="mb-3 text-xs text-[#3D2B1F]/50">Click a template to pre-fill the compose form. You can edit before sending.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className="rounded-lg border border-[#8B6914]/15 bg-[#F5EACB]/30 p-3 text-left transition hover:border-[#D4A843] hover:bg-[#F5EACB]"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-lg">{t.emoji}</span>
                <span className="text-sm font-semibold text-[#3D2B1F]">{t.label}</span>
                <TypeBadge type={t.type} />
              </div>
              <p className="line-clamp-2 text-xs text-[#3D2B1F]/70">{t.message}</p>
              {t.note && (
                <p className="mt-1 text-[10px] italic text-[#8B6914]">{t.note}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: Compose & Send ─────────────────────────────────── */}
      <div className="mb-6 rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Compose Notification</h2>

        {/* Message */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-[#3D2B1F]">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 140))}
            placeholder="Type your notification message..."
            rows={3}
            className="w-full rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
          />
          <div className="mt-1 text-right text-xs">
            <span className={charsLeft <= 10 ? 'font-bold text-[#C0392B]' : 'text-[#3D2B1F]/40'}>
              {charsLeft} characters remaining
            </span>
          </div>
        </div>

        {/* Target */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-[#3D2B1F]">Target</label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 rounded border border-[#8B6914]/20 px-3 py-1.5 hover:bg-[#F5EACB]">
              <input
                type="radio"
                name="target"
                checked={target === 'all'}
                onChange={() => setTarget('all')}
                className="accent-[#8B6914]"
              />
              <span className="text-sm font-medium text-[#3D2B1F]">All Players</span>
            </label>
            {CLANS.map((clan) => (
              <label
                key={clan}
                className="flex cursor-pointer items-center gap-1.5 rounded border px-3 py-1.5 hover:opacity-80"
                style={{
                  borderColor: target === clan ? CLAN_COLORS[clan] : `${CLAN_COLORS[clan]}40`,
                  backgroundColor: target === clan ? `${CLAN_COLORS[clan]}15` : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="target"
                  checked={target === clan}
                  onChange={() => setTarget(clan)}
                  className="accent-[#8B6914]"
                />
                <span
                  className="text-sm font-bold"
                  style={{ color: CLAN_COLORS[clan] }}
                >
                  {CLAN_LABELS[clan]}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notification Type */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-[#3D2B1F]">Type</label>
          <div className="flex flex-wrap gap-2">
            {NOTIF_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setNotifType(t.value)}
                className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
                style={{
                  backgroundColor: notifType === t.value ? t.color : `${t.color}15`,
                  color: notifType === t.value ? 'white' : t.color,
                  border: `2px solid ${notifType === t.value ? t.color : `${t.color}40`}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Send / Schedule buttons */}
        <div className="flex flex-wrap items-end gap-3">
          <button
            onClick={() => { setScheduleMode(false); setShowConfirm(true); }}
            disabled={!canSend}
            className="rounded bg-[#8B6914] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
          >
            Send Now
          </button>
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending}
            className="rounded border-2 border-[#D4A843] px-4 py-2.5 text-sm font-semibold text-[#D4A843] hover:bg-[#D4A843]/10 disabled:opacity-50"
          >
            {testMut.isPending ? 'Sending...' : 'Send Test Notification'}
          </button>
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-[#3D2B1F]/60">Schedule for later</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={toLocalDatetimeString(new Date(Date.now() + 5 * 60 * 1000))}
                max={toLocalDatetimeString(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))}
                className="rounded border border-[#8B6914]/30 bg-white px-3 py-2 text-sm text-[#3D2B1F] focus:border-[#D4A843] focus:outline-none"
              />
            </div>
            <button
              onClick={() => { setScheduleMode(true); setShowConfirm(true); }}
              disabled={!canSend || !scheduledFor}
              className="rounded border-2 border-[#2980B9] px-4 py-2 text-sm font-semibold text-[#2980B9] hover:bg-[#2980B9]/10 disabled:opacity-50"
            >
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: History ────────────────────────────────────────── */}
      <div className="rounded-lg border border-[#8B6914]/20 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#3D2B1F]">Notification History</h2>

        {historyLoading ? (
          <LoadingSpinner />
        ) : historyError ? (
          <ErrorAlert message={(historyError as Error).message} />
        ) : !notifications || notifications.length === 0 ? (
          <p className="text-sm text-[#3D2B1F]/50">No notifications sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#8B6914]/20 text-xs uppercase text-[#3D2B1F]/50">
                  <th className="py-2 pr-3">Sent At</th>
                  <th className="py-2 pr-3">Message</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Sent By</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.notificationId} className="border-b border-[#8B6914]/10">
                    <td className="whitespace-nowrap py-2 pr-3 text-[#3D2B1F]/70">
                      {formatIST(n.sentAt)}
                    </td>
                    <td className="max-w-xs truncate py-2 pr-3 text-[#3D2B1F]">{n.message}</td>
                    <td className="py-2 pr-3">
                      <TargetBadge target={n.target} />
                    </td>
                    <td className="py-2 pr-3">
                      <TypeBadge type={n.notificationType} />
                    </td>
                    <td className="py-2 pr-3 text-[#3D2B1F]/70">
                      {n.sentBy || '\u2014'}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={n.status} scheduledFor={n.scheduledFor} />
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-[#3D2B1F]">
                      {n.deliveryCount}
                    </td>
                    <td className="py-2">
                      {n.status === 'scheduled' && (
                        <button
                          onClick={() => setCancelTargetId(n.notificationId)}
                          disabled={cancelTargetId === n.notificationId && cancelMut.isPending}
                          className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancelTargetId === n.notificationId && cancelMut.isPending ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">
              {scheduleMode ? 'Confirm Schedule' : 'Confirm Send'}
            </h3>
            <p className="mb-3 text-sm text-[#3D2B1F]/70">
              {scheduleMode
                ? <>Schedule this notification for <span className="font-semibold">{scheduledFor ? new Date(scheduledFor).toLocaleString() : ''}</span> to <span className="font-semibold">{getTargetDescription()}</span>?</>
                : <>Send this notification to <span className="font-semibold">{getTargetDescription()}</span>?</>
              }
            </p>
            <div className="mb-4 rounded border border-[#8B6914]/20 bg-[#F5EACB]/50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <TypeBadge type={notifType} />
              </div>
              <p className="text-sm text-[#3D2B1F]">{message}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={sendMut.isPending}
                className="rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending}
                className="rounded bg-[#8B6914] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5210] disabled:opacity-50"
              >
                {sendMut.isPending ? (scheduleMode ? 'Scheduling...' : 'Sending...') : (scheduleMode ? 'Schedule' : 'Send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-[#3D2B1F]">Cancel Notification</h3>
            <p className="mb-4 text-sm text-[#3D2B1F]/70">
              Cancel this scheduled notification? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelTargetId(null)}
                disabled={cancelMut.isPending}
                className="rounded bg-[#F5EACB] px-4 py-2 text-sm font-medium text-[#3D2B1F] hover:bg-[#E8DDB8] disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => cancelMut.mutate(cancelTargetId)}
                disabled={cancelMut.isPending}
                className="rounded bg-[#C0392B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A93226] disabled:opacity-50"
              >
                {cancelMut.isPending ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const config = NOTIF_TYPES.find((t) => t.value === type) ?? { label: type, color: '#8B6914' };
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </span>
  );
}

function TargetBadge({ target }: { target: string }) {
  if (target === 'all') {
    return <span className="text-sm font-medium text-[#3D2B1F]">All Players</span>;
  }
  const color = CLAN_COLORS[target] ?? '#8B6914';
  const label = CLAN_LABELS[target] ?? target;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status, scheduledFor }: { status?: string; scheduledFor?: string }) {
  if (status === 'scheduled') {
    return (
      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
        Scheduled {scheduledFor ? formatIST(scheduledFor) : ''}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
        Failed
      </span>
    );
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
      Sent
    </span>
  );
}
