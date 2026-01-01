export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function layout(args: { title: string; body: string; nav?: string }) {
  const title = escapeHtml(args.title);
  const nav =
    args.nav ??
    `
    <a href="/ops">Dashboard</a>
    <a href="/ops/queues">Queues</a>
    <a href="/ops/providers">Providers</a>
    <a href="/ops/reviews">Reviews</a>
    <a href="/ops/alerts">Alerts</a>
    <a href="/api/health">API health</a>
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: #f6f8fb; color: #0b1220; }
      .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
      .card { background: #fff; border: 1px solid rgba(15,23,42,0.10); border-radius: 14px; box-shadow: 0 10px 30px rgba(2,6,23,0.06); }
      .header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding: 16px 18px; }
      .nav { display:flex; flex-wrap:wrap; gap:12px; font-size: 14px; color: rgba(15,23,42,0.75); }
      .nav a { color: inherit; text-decoration: none; padding: 6px 8px; border-radius: 10px; }
      .nav a:hover { background: rgba(15,23,42,0.06); }
      h1 { font-size: 22px; margin: 0; }
      h2 { font-size: 16px; margin: 0; }
      .muted { color: rgba(15,23,42,0.65); }
      .content { padding: 18px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(15,23,42,0.08); vertical-align: top; }
      th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(15,23,42,0.7); }
      code { background: rgba(2,6,23,0.06); padding: 2px 6px; border-radius: 8px; }
      .grid { display: grid; gap: 14px; }
      .grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(15,23,42,0.12); background: #0b1220; color: #fff; font-weight: 700; text-decoration:none; cursor:pointer; }
      .btnSecondary { background: #fff; color: #0b1220; }
      form.inline { display: inline; }
      input, select, textarea { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(15,23,42,0.14); font: inherit; }
      textarea { width: 100%; }
      @media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } .header { flex-direction: column; align-items: stretch; } }
    </style>
  </head>
  <body>
    <div class="card" style="border-radius:0; border-left:0; border-right:0;">
      <div class="container header">
        <div>
          <h1>CloudGPUs.io Ops</h1>
          <div class="muted" style="margin-top: 6; font-size: 13px;">${title}</div>
        </div>
        <nav class="nav">${nav}</nav>
      </div>
    </div>
    <div class="container">
      ${args.body}
    </div>
  </body>
</html>`;
}
