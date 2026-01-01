export function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  const stars = Array.from({ length: 5 }, (_, i) => (i < full ? "★" : "☆")).join("");
  return (
    <span
      aria-label={`${full} out of 5`}
      title={`${full}/5`}
      style={{ letterSpacing: 1, fontSize: 14 }}
    >
      {stars}
    </span>
  );
}
