import { formatRelativeTime } from "@/lib/format";

export function DataFreshnessBadge({
  timestamp,
  label = "Updated",
}: {
  timestamp?: string | null | undefined;
  label?: string | undefined;
}) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const ageHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  const tone = ageHours <= 6 ? "#065f46" : ageHours <= 24 ? "#b45309" : "#b91c1c";
  const bg =
    ageHours <= 6
      ? "rgba(6,95,70,0.08)"
      : ageHours <= 24
        ? "rgba(180,83,9,0.08)"
        : "rgba(185,28,28,0.08)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        background: bg,
        color: tone,
        border: `1px solid ${tone}`,
      }}
      aria-label={`Data refreshed ${formatRelativeTime(timestamp)}`}
    >
      <span>{label}</span>
      <span>{formatRelativeTime(timestamp)}</span>
    </div>
  );
}
