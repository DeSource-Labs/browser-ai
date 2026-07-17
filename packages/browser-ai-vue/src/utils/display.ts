export const formatRelativeTime = (timestamp?: number, now = Date.now()) => {
  if (!timestamp) return "just now";

  const elapsedSeconds = Math.max(Math.floor((now - timestamp) / 1000), 0);
  if (elapsedSeconds < 60) return "just now";

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const toDateTime = (timestamp?: number) => {
  return new Date(timestamp ?? Date.now()).toISOString();
};

export const formatAvailability = (
  availability: Availability | null,
  downloadProgress = 0,
) => {
  if (downloadProgress > 0 && downloadProgress < 100) {
    return `${downloadProgress}%`;
  }
  if (availability === "available") return "Ready";
  if (availability === "downloadable") return "Download";
  if (availability === "downloading") return "Downloading";
  if (availability === "unavailable") return "Unavailable";
  return "Checking";
};

export const formatTokenCount = (value: number | null) => {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "unlimited";
  return value.toLocaleString();
};

export const copyText = async (value: string) => {
  if (!value || typeof navigator === "undefined") return false;
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(value);
  return true;
};
