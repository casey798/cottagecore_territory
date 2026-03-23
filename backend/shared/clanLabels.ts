export const CLAN_LABELS: Record<string, string> = {
  ember: 'Seekers',
  tide: 'Guardians',
  bloom: 'Wardens',
  gale: 'Keepers',
  hearth: 'Chroniclers',
};

export function clanDisplayName(clanId: string): string {
  return CLAN_LABELS[clanId] ?? clanId;
}
