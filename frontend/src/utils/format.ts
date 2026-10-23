const CAMBODIA_TIME_ZONE = 'Asia/Phnom_Penh';

const isUtcShaped = (value: string) =>
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?\s*(UTC|GMT)?$/i.test(value);

export const formatPhnomPenhTime = (value?: string | null): string => {
  if (!value) return '';
  const raw = value.trim();
  const iso = isUtcShaped(raw) ? `${raw.slice(0, 19).replace(' ', 'T')}Z` : raw;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return raw;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CAMBODIA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(parsed);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part(
      'minute'
    )}:${part('second')}`;
  } catch {
    return raw;
  }
};
