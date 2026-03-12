import type { ClanId } from '@/types';

const CLAN_COLORS: Record<ClanId, { bg: string; text: string }> = {
  ember: { bg: 'bg-[#C0392B]', text: 'text-white' },
  tide: { bg: 'bg-[#2980B9]', text: 'text-white' },
  bloom: { bg: 'bg-[#F1C40F]', text: 'text-[#3D2B1F]' },
  gale: { bg: 'bg-[#27AE60]', text: 'text-white' },
  hearth: { bg: 'bg-[#7D3C98]', text: 'text-white' },
};

interface BadgeProps {
  clan: ClanId;
  className?: string;
}

export function Badge({ clan, className = '' }: BadgeProps) {
  const colors = CLAN_COLORS[clan];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${colors.bg} ${colors.text} ${className}`}
    >
      {clan}
    </span>
  );
}
