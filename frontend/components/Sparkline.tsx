export function Sparkline({
  values,
  width = 220,
  height = 44,
}: {
  values: Array<number | null>;
  width?: number;
  height?: number;
}) {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length < 2) {
    return (
      <svg width={width} height={height} role="img" aria-label="Price trend chart">
        <rect width={width} height={height} fill="rgba(15, 23, 42, 0.03)" rx="8" />
      </svg>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = Math.max(1e-9, max - min);

  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * (width - 12) + 6;
    const yVal = typeof v === "number" && Number.isFinite(v) ? v : null;
    const y = yVal == null ? null : (1 - (yVal - min) / range) * (height - 12) + 6;
    return { x, y };
  });

  const d = pts
    .filter((p): p is { x: number; y: number } => typeof p.y === "number")
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} role="img" aria-label="Price trend chart">
      <rect width={width} height={height} fill="rgba(15, 23, 42, 0.03)" rx="8" />
      <path d={d} fill="none" stroke="rgba(37, 99, 235, 0.9)" strokeWidth="2" />
    </svg>
  );
}
