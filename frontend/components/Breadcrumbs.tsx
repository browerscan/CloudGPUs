import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        {items.map((item, idx) => (
          <span key={idx}>
            {item.href ? (
              <Link href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: "rgba(15, 23, 42, 0.85)" }}>{item.label}</span>
            )}
            {idx < items.length - 1 ? (
              <span style={{ opacity: 0.4, margin: "0 6px" }}>/</span>
            ) : null}
          </span>
        ))}
      </div>
    </nav>
  );
}
