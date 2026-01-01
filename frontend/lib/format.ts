export function formatUsdPerHour(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}/hr`;
}

export function formatRelativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";

  const diffMs = Date.now() - t;
  if (!Number.isFinite(diffMs)) return "—";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
