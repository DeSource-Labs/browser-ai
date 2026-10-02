export { formatRelativeTime, toDateTime } from '@desource/browser-ai/conversation';

export const formatAvailability = (availability: Availability | null, downloadProgress = 0) => {
  if (downloadProgress > 0 && downloadProgress < 100) {
    return `${downloadProgress}%`;
  }
  if (availability === 'available') return 'Ready';
  if (availability === 'downloadable') return 'Download';
  if (availability === 'downloading') return 'Downloading';
  if (availability === 'unavailable') return 'Unavailable';
  return 'Checking';
};

export const formatTokenCount = (value: number | null) => {
  if (value == null) return '—';
  if (!Number.isFinite(value)) return 'unlimited';
  return value.toLocaleString();
};

export const copyText = async (value: string) => {
  if (!value || typeof navigator === 'undefined') return false;
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(value);
  return true;
};
