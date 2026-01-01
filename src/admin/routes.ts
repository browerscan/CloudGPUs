import type { Express, Response } from "express";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { Queue } from "bullmq";
import { requireAdminAuth } from "./auth.js";
import { escapeHtml, layout } from "./html.js";
import { ensureRepeatableJobs } from "../workers/scheduler.js";
import { QUEUES } from "../workers/queues.js";

const PROVIDER_TYPES = [
  "specialized_neocloud",
  "hyperscaler",
  "regional_cloud",
  "marketplace",
  "depin",
  "bare_metal",
] as const;

const TIERS = ["enterprise", "standard", "community"] as const;

function parseBooleanCheckbox(value: unknown) {
  return value === "on" || value === "true" || value === "1";
}

function parseRegions(value: unknown) {
  if (typeof value !== "string") return null;
  const list = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

function redirectTo(res: Response, path: string) {
  res.status(302).setHeader("location", path).send("Redirecting...");
}

export function registerAdminRoutes(app: Express, deps: { pool: Pool; redis: Redis }) {
  const auth = requireAdminAuth();

  app.get("/ops", auth, async (_req, res) => {
    const [providers, instances, staleProviders, pendingReviews] = await Promise.all([
      deps.pool.query<{ count: string }>("SELECT count(*)::text AS count FROM cloudgpus.providers"),
      deps.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM cloudgpus.instances WHERE is_active = true",
      ),
      deps.pool.query<{ slug: string; name: string; last_price_update: string | null }>(
        `
        SELECT slug, name, last_price_update::text
        FROM cloudgpus.providers
        WHERE is_active = true
          AND (last_price_update IS NULL OR last_price_update < now() - interval '48 hours')
        ORDER BY last_price_update NULLS FIRST
        LIMIT 20
        `,
      ),
      deps.pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM cloudgpus.provider_reviews WHERE is_published = false",
      ),
    ]);

    const recentJobs = await deps.pool.query<{
      id: string;
      provider_slug: string;
      provider_name: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
      error_message: string | null;
    }>(
      `
      SELECT
        j.id,
        p.slug AS provider_slug,
        p.name AS provider_name,
        j.status,
        j.started_at::text,
        j.completed_at::text,
        j.duration_ms,
        j.error_message
      FROM cloudgpus.scrape_jobs j
      JOIN cloudgpus.providers p ON p.id = j.provider_id
      ORDER BY j.started_at DESC
      LIMIT 30
      `,
    );

    const anomalies = await deps.pool.query<{
      id: string;
      provider_slug: string;
      gpu_slug: string;
      old_price: string;
      new_price: string;
      change_pct: string;
      detected_at: string;
    }>(
      `
      SELECT
        a.id,
        p.slug AS provider_slug,
        g.slug AS gpu_slug,
        a.old_price_per_gpu_hour::text AS old_price,
        a.new_price_per_gpu_hour::text AS new_price,
        a.change_percent::text AS change_pct,
        a.detected_at::text AS detected_at
      FROM cloudgpus.price_anomalies a
      JOIN cloudgpus.providers p ON p.id = a.provider_id
      JOIN cloudgpus.gpu_models g ON g.id = a.gpu_model_id
      ORDER BY a.detected_at DESC
      LIMIT 30
      `,
    );

    const clicks = await deps.pool.query<{
      provider_slug: string;
      provider_name: string;
      clicks: string;
    }>(
      `
      SELECT
        p.slug AS provider_slug,
        p.name AS provider_name,
        count(*)::text AS clicks
      FROM cloudgpus.affiliate_clicks c
      JOIN cloudgpus.providers p ON p.id = c.provider_id
      WHERE c.created_at > now() - interval '7 days'
      GROUP BY p.slug, p.name
      ORDER BY count(*) DESC
      LIMIT 20
      `,
    );

    const body = `
      <div class="grid grid2">
        <div class="card content">
          <h2>Summary</h2>
          <div class="muted" style="margin-top: 10; line-height: 1.8;">
            <div>Providers: <strong>${escapeHtml(providers.rows[0]?.count ?? "0")}</strong></div>
            <div>Active instances: <strong>${escapeHtml(instances.rows[0]?.count ?? "0")}</strong></div>
            <div>Pending reviews: <strong>${escapeHtml(pendingReviews.rows[0]?.count ?? "0")}</strong></div>
            <div style="margin-top: 10;">
              <a class="btn btnSecondary" href="/ops/providers">Manage providers</a>
              <a class="btn btnSecondary" href="/ops/reviews" style="margin-left: 8px;">Moderate reviews</a>
            </div>
          </div>
        </div>
        <div class="card content">
          <h2>Actions</h2>
          <div class="muted" style="margin-top: 10; line-height: 1.8;">
            <div>Kick pricing scrape for a provider via workers (BullMQ) or wait for the scheduler.</div>
            <form method="post" action="/ops/jobs/run-scheduler" style="margin-top: 10;">
              <button class="btn" type="submit">Run scheduler now</button>
            </form>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-top: 14px;">
        <div class="card content">
          <h2>Stale providers (48h+)</h2>
          <table>
            <thead><tr><th>Provider</th><th>Last update</th><th></th></tr></thead>
            <tbody>
              ${
                staleProviders.rows.length
                  ? staleProviders.rows
                      .map(
                        (p) => `
                        <tr>
                          <td><code>${escapeHtml(p.slug)}</code> — ${escapeHtml(p.name)}</td>
                          <td class="muted">${escapeHtml(p.last_price_update ?? "never")}</td>
                          <td><a class="btn btnSecondary" href="/ops/providers/${encodeURIComponent(p.slug)}">Edit</a></td>
                        </tr>`,
                      )
                      .join("")
                  : `<tr><td class="muted" colspan="3">None 🎉</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid grid2" style="margin-top: 14px;">
        <div class="card content">
          <h2>Recent scrape jobs</h2>
          <table>
            <thead><tr><th>Provider</th><th>Status</th><th>Started</th><th>Duration</th></tr></thead>
            <tbody>
              ${recentJobs.rows
                .map(
                  (j) => `
                    <tr>
                      <td><code>${escapeHtml(j.provider_slug)}</code></td>
                      <td>${escapeHtml(j.status)}</td>
                      <td class="muted">${escapeHtml(j.started_at)}</td>
                      <td class="muted">${escapeHtml(j.duration_ms ?? "")}</td>
                    </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="card content">
          <h2>Price anomalies (50%+ changes)</h2>
          <table>
            <thead><tr><th>Provider</th><th>GPU</th><th>Change</th><th>Detected</th></tr></thead>
            <tbody>
              ${
                anomalies.rows.length
                  ? anomalies.rows
                      .map(
                        (a) => `
                        <tr>
                          <td><code>${escapeHtml(a.provider_slug)}</code></td>
                          <td><code>${escapeHtml(a.gpu_slug)}</code></td>
                          <td>${escapeHtml(a.change_pct)}%</td>
                          <td class="muted">${escapeHtml(a.detected_at)}</td>
                        </tr>`,
                      )
                      .join("")
                  : `<tr><td class="muted" colspan="4">No anomalies recorded.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid" style="margin-top: 14px;">
        <div class="card content">
          <h2>Affiliate clicks (last 7 days)</h2>
          <table>
            <thead><tr><th>Provider</th><th>Clicks</th><th></th></tr></thead>
            <tbody>
              ${
                clicks.rows.length
                  ? clicks.rows
                      .map(
                        (c) => `
                        <tr>
                          <td><code>${escapeHtml(c.provider_slug)}</code> — ${escapeHtml(c.provider_name)}</td>
                          <td>${escapeHtml(c.clicks)}</td>
                          <td><a class="btn btnSecondary" href="/provider/${encodeURIComponent(c.provider_slug)}">View page</a></td>
                        </tr>`,
                      )
                      .join("")
                  : `<tr><td class="muted" colspan="3">No click data yet.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(layout({ title: "Dashboard", body }));
  });

  app.get("/ops/queues", auth, async (_req, res) => {
    const names = [
      QUEUES.pricingFetch,
      QUEUES.pricingAggregate,
      QUEUES.alerts,
      QUEUES.notifySlack,
      QUEUES.notifyEmail,
      QUEUES.notifyWebhook,
      QUEUES.cleanup,
      QUEUES.browserScrape,
      QUEUES.screenshot,
    ];

    const rows: {
      name: string;
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
    }[] = [];

    for (const name of names) {
      const q = new Queue(name, { connection: deps.redis });
      const counts = await q.getJobCounts("waiting", "active", "delayed", "failed");
      await q.close();
      rows.push({
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      });
    }

    const body = `
      <div class="card content">
        <h2>BullMQ Queues</h2>
        <div class="muted" style="margin-top: 8px; line-height: 1.7;">
          Basic visibility into backlog and failures. For deeper inspection, use Redis + worker logs.
        </div>
        <table style="margin-top: 10px;">
          <thead><tr><th>Queue</th><th>Waiting</th><th>Active</th><th>Delayed</th><th>Failed</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `
                <tr>
                  <td><code>${escapeHtml(r.name)}</code></td>
                  <td>${escapeHtml(r.waiting)}</td>
                  <td>${escapeHtml(r.active)}</td>
                  <td>${escapeHtml(r.delayed)}</td>
                  <td>${escapeHtml(r.failed)}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(layout({ title: "Queues", body }));
  });

  app.post("/ops/jobs/run-scheduler", auth, async (_req, res) => {
    await ensureRepeatableJobs({ redis: deps.redis, pool: deps.pool });
    redirectTo(res, "/ops");
  });

  app.get("/ops/providers", auth, async (_req, res) => {
    const providers = await deps.pool.query<{
      slug: string;
      name: string;
      provider_type: string;
      reliability_tier: string;
      is_active: boolean;
      last_price_update: string | null;
    }>(
      `
      SELECT slug, name, provider_type, reliability_tier, is_active, last_price_update::text
      FROM cloudgpus.providers
      ORDER BY name ASC
      `,
    );

    const body = `
      <div class="card content">
        <h2>Providers</h2>
        <div class="muted" style="margin-top: 8px; line-height: 1.7;">
          Edit provider metadata for SEO pages (docs links, affiliate URL, regions, spot/reserved flags).
        </div>
        <table style="margin-top: 10px;">
          <thead><tr><th>Slug</th><th>Name</th><th>Type</th><th>Tier</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            ${providers.rows
              .map(
                (p) => `
              <tr>
                <td><code>${escapeHtml(p.slug)}</code></td>
                <td>${escapeHtml(p.name)} ${p.is_active ? "" : '<span class="muted">(inactive)</span>'}</td>
                <td class="muted">${escapeHtml(p.provider_type)}</td>
                <td class="muted">${escapeHtml(p.reliability_tier)}</td>
                <td class="muted">${escapeHtml(p.last_price_update ?? "")}</td>
                <td><a class="btn btnSecondary" href="/ops/providers/${encodeURIComponent(p.slug)}">Edit</a></td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(layout({ title: "Providers", body }));
  });

  app.get("/ops/providers/:slug", auth, async (req, res) => {
    const slug = req.params["slug"];
    if (!slug) {
      res.status(400).send("Missing slug");
      return;
    }

    const providerRes = await deps.pool.query<{
      slug: string;
      name: string;
      display_name: string;
      provider_type: string;
      reliability_tier: string;
      website_url: string;
      pricing_url: string | null;
      docs_url: string | null;
      status_page_url: string | null;
      affiliate_url: string | null;
      has_public_api: boolean;
      supports_spot_instances: boolean | null;
      supports_reserved_instances: boolean | null;
      available_regions: string[] | null;
      sla_uptime_percent: string | null;
      is_active: boolean;
      last_price_update: string | null;
    }>(
      `
      SELECT
        slug, name, display_name, provider_type, reliability_tier,
        website_url, pricing_url, docs_url, status_page_url, affiliate_url,
        has_public_api, supports_spot_instances, supports_reserved_instances,
        available_regions, sla_uptime_percent::text, is_active, last_price_update::text
      FROM cloudgpus.providers
      WHERE slug = $1
      LIMIT 1
      `,
      [slug],
    );
    const p = providerRes.rows[0];
    if (!p) {
      res.status(404).send("Provider not found");
      return;
    }

    const body = `
      <div class="card content">
        <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <h2>Editing: ${escapeHtml(p.name)} <span class="muted">(${escapeHtml(p.slug)})</span></h2>
            <div class="muted" style="margin-top: 8px;">Last price update: ${escapeHtml(p.last_price_update ?? "—")}</div>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <a class="btn btnSecondary" href="/ops/providers">Back</a>
            <a class="btn" href="/provider/${encodeURIComponent(p.slug)}" target="_blank" rel="noreferrer">Open public page</a>
          </div>
        </div>

        <form method="post" action="/ops/providers/${encodeURIComponent(p.slug)}" style="margin-top: 14px;">
          <div class="grid grid2">
            <label>
              <div class="muted" style="font-size: 13px;">Display name</div>
              <input name="display_name" value="${escapeHtml(p.display_name)}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Website URL</div>
              <input name="website_url" value="${escapeHtml(p.website_url)}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Pricing URL</div>
              <input name="pricing_url" value="${escapeHtml(p.pricing_url ?? "")}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Docs URL</div>
              <input name="docs_url" value="${escapeHtml(p.docs_url ?? "")}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Status page URL</div>
              <input name="status_page_url" value="${escapeHtml(p.status_page_url ?? "")}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Affiliate URL</div>
              <input name="affiliate_url" value="${escapeHtml(p.affiliate_url ?? "")}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Provider type</div>
              <select name="provider_type">
                ${PROVIDER_TYPES.map(
                  (t) =>
                    `<option value="${t}" ${t === p.provider_type ? "selected" : ""}>${t}</option>`,
                ).join("")}
              </select>
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Reliability tier</div>
              <select name="reliability_tier">
                ${TIERS.map((t) => `<option value="${t}" ${t === p.reliability_tier ? "selected" : ""}>${t}</option>`).join("")}
              </select>
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">Available regions (comma-separated)</div>
              <input name="available_regions" value="${escapeHtml((p.available_regions ?? []).join(", "))}" />
            </label>
            <label>
              <div class="muted" style="font-size: 13px;">SLA uptime percent (optional)</div>
              <input name="sla_uptime_percent" value="${escapeHtml(p.sla_uptime_percent ?? "")}" />
            </label>
          </div>

          <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top: 12px;">
            <label><input type="checkbox" name="has_public_api" ${p.has_public_api ? "checked" : ""} /> has public API</label>
            <label><input type="checkbox" name="supports_spot_instances" ${p.supports_spot_instances ? "checked" : ""} /> supports spot</label>
            <label><input type="checkbox" name="supports_reserved_instances" ${p.supports_reserved_instances ? "checked" : ""} /> supports reserved</label>
            <label><input type="checkbox" name="is_active" ${p.is_active ? "checked" : ""} /> active</label>
          </div>

          <div style="margin-top: 14px;">
            <button class="btn" type="submit">Save</button>
          </div>
        </form>
      </div>
    `;

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(layout({ title: `Provider: ${p.slug}`, body }));
  });

  app.post("/ops/providers/:slug", auth, async (req, res) => {
    const slug = req.params["slug"];
    if (!slug) {
      res.status(400).send("Missing slug");
      return;
    }

    const provider_type =
      typeof req.body["provider_type"] === "string" &&
      (PROVIDER_TYPES as readonly string[]).includes(req.body["provider_type"])
        ? (req.body["provider_type"] as (typeof PROVIDER_TYPES)[number])
        : null;
    const reliability_tier =
      typeof req.body["reliability_tier"] === "string" &&
      (TIERS as readonly string[]).includes(req.body["reliability_tier"])
        ? (req.body["reliability_tier"] as (typeof TIERS)[number])
        : null;

    if (!provider_type || !reliability_tier) {
      res.status(400).send("Invalid provider_type or reliability_tier");
      return;
    }

    const website_url =
      typeof req.body["website_url"] === "string" ? req.body["website_url"].trim() : "";
    if (!website_url) {
      res.status(400).send("website_url is required");
      return;
    }

    const display_name =
      typeof req.body["display_name"] === "string" ? req.body["display_name"].trim() : "";
    const pricing_url =
      typeof req.body["pricing_url"] === "string" ? req.body["pricing_url"].trim() : "";
    const docs_url = typeof req.body["docs_url"] === "string" ? req.body["docs_url"].trim() : "";
    const status_page_url =
      typeof req.body["status_page_url"] === "string" ? req.body["status_page_url"].trim() : "";
    const affiliate_url =
      typeof req.body["affiliate_url"] === "string" ? req.body["affiliate_url"].trim() : "";

    const has_public_api = parseBooleanCheckbox(req.body["has_public_api"]);
    const supports_spot_instances = parseBooleanCheckbox(req.body["supports_spot_instances"]);
    const supports_reserved_instances = parseBooleanCheckbox(
      req.body["supports_reserved_instances"],
    );
    const is_active = parseBooleanCheckbox(req.body["is_active"]);

    const available_regions = parseRegions(req.body["available_regions"]);

    const slaRaw =
      typeof req.body["sla_uptime_percent"] === "string"
        ? req.body["sla_uptime_percent"].trim()
        : "";
    const sla_uptime_percent =
      slaRaw && Number.isFinite(Number(slaRaw)) ? Math.max(0, Math.min(100, Number(slaRaw))) : null;

    await deps.pool.query(
      `
      UPDATE cloudgpus.providers
      SET
        display_name = $1,
        website_url = $2,
        pricing_url = NULLIF($3, ''),
        docs_url = NULLIF($4, ''),
        status_page_url = NULLIF($5, ''),
        affiliate_url = NULLIF($6, ''),
        provider_type = $7,
        reliability_tier = $8,
        has_public_api = $9,
        supports_spot_instances = $10,
        supports_reserved_instances = $11,
        available_regions = to_jsonb($12::text[]),
        sla_uptime_percent = $13,
        is_active = $14
      WHERE slug = $15
      `,
      [
        display_name || slug,
        website_url,
        pricing_url,
        docs_url,
        status_page_url,
        affiliate_url,
        provider_type,
        reliability_tier,
        has_public_api,
        supports_spot_instances,
        supports_reserved_instances,
        available_regions,
        sla_uptime_percent,
        is_active,
        slug,
      ],
    );

    redirectTo(res, `/ops/providers/${encodeURIComponent(slug)}`);
  });

  app.get("/ops/reviews", auth, async (_req, res) => {
    const reviews = await deps.pool.query<{
      id: string;
      provider_slug: string;
      rating: number;
      title: string | null;
      body: string;
      author_name: string | null;
      created_at: string;
      is_published: boolean;
    }>(
      `
      SELECT
        r.id,
        p.slug AS provider_slug,
        r.rating,
        r.title,
        r.body,
        r.author_name,
        r.created_at::text,
        r.is_published
      FROM cloudgpus.provider_reviews r
      JOIN cloudgpus.providers p ON p.id = r.provider_id
      ORDER BY r.created_at DESC
      LIMIT 200
      `,
    );

    const body = `
      <div class="card content">
        <h2>Review moderation</h2>
        <div class="muted" style="margin-top: 8px; line-height: 1.7;">
          New reviews are stored as unpublished. Publish reviews after checking for spam and relevance.
        </div>
        <table style="margin-top: 10px;">
          <thead><tr><th>Provider</th><th>Rating</th><th>Title</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${reviews.rows
              .map((r) => {
                const actions = r.is_published
                  ? `<form class="inline" method="post" action="/ops/reviews/${encodeURIComponent(r.id)}/unpublish"><button class="btn btnSecondary" type="submit">Unpublish</button></form>`
                  : `<form class="inline" method="post" action="/ops/reviews/${encodeURIComponent(r.id)}/publish"><button class="btn" type="submit">Publish</button></form>`;

                return `
                  <tr>
                    <td><code>${escapeHtml(r.provider_slug)}</code></td>
                    <td>${escapeHtml(r.rating)}</td>
                    <td>${escapeHtml(r.title ?? "")}<div class="muted" style="margin-top: 6px; max-width: 520px; white-space: pre-wrap;">${escapeHtml(r.body.slice(0, 220))}${r.body.length > 220 ? "…" : ""}</div></td>
                    <td class="muted">${escapeHtml(r.created_at)}</td>
                    <td>${r.is_published ? "published" : '<span class="muted">pending</span>'}</td>
                    <td style="display:flex; gap:8px; flex-wrap:wrap;">
                      ${actions}
                      <form class="inline" method="post" action="/ops/reviews/${encodeURIComponent(r.id)}/delete"><button class="btn btnSecondary" type="submit">Delete</button></form>
                      <a class="btn btnSecondary" href="/provider/${encodeURIComponent(r.provider_slug)}" target="_blank" rel="noreferrer">Open provider</a>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(layout({ title: "Reviews", body }));
  });

  app.post("/ops/reviews/:id/publish", auth, async (req, res) => {
    const id = req.params["id"];
    if (!id) return redirectTo(res, "/ops/reviews");
    await deps.pool.query(
      `UPDATE cloudgpus.provider_reviews SET is_published = true, published_at = COALESCE(published_at, NOW()) WHERE id = $1`,
      [id],
    );
    redirectTo(res, "/ops/reviews");
  });

  app.post("/ops/reviews/:id/unpublish", auth, async (req, res) => {
    const id = req.params["id"];
    if (!id) return redirectTo(res, "/ops/reviews");
    await deps.pool.query(
      `UPDATE cloudgpus.provider_reviews SET is_published = false WHERE id = $1`,
      [id],
    );
    redirectTo(res, "/ops/reviews");
  });

  app.post("/ops/reviews/:id/delete", auth, async (req, res) => {
    const id = req.params["id"];
    if (!id) return redirectTo(res, "/ops/reviews");
    await deps.pool.query(`DELETE FROM cloudgpus.provider_reviews WHERE id = $1`, [id]);
    redirectTo(res, "/ops/reviews");
  });

  app.get("/ops/alerts", auth, async (_req, res) => {
    const subs = await deps.pool.query<{
      id: string;
      email: string;
      gpu_slug: string;
      provider_slug: string | null;
      target: string;
      confirmed_at: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `
      SELECT
        s.id,
        s.email,
        g.slug AS gpu_slug,
        p.slug AS provider_slug,
        s.target_price_per_gpu_hour::text AS target,
        s.confirmed_at::text,
        s.is_active,
        s.created_at::text
      FROM cloudgpus.price_alert_subscriptions s
      JOIN cloudgpus.gpu_models g ON g.id = s.gpu_model_id
      LEFT JOIN cloudgpus.providers p ON p.id = s.provider_id
      ORDER BY s.created_at DESC
      LIMIT 200
      `,
    );

    const body = `
      <div class="card content">
        <h2>Price alerts</h2>
        <div class="muted" style="margin-top: 8px; line-height: 1.7;">
          Alerts are double opt-in. Only confirmed + active subscriptions are eligible for notifications.
        </div>
        <table style="margin-top: 10px;">
          <thead><tr><th>Email</th><th>GPU</th><th>Provider</th><th>Target</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${subs.rows
              .map((s) => {
                const status = s.is_active ? (s.confirmed_at ? "active" : "pending") : "inactive";
                return `
                  <tr>
                    <td>${escapeHtml(s.email)}</td>
                    <td><code>${escapeHtml(s.gpu_slug)}</code></td>
                    <td>${s.provider_slug ? `<code>${escapeHtml(s.provider_slug)}</code>` : '<span class="muted">any</span>'}</td>
                    <td>$${escapeHtml(s.target)}/GPU-hr</td>
                    <td>${escapeHtml(status)}</td>
                    <td>
                      <form class="inline" method="post" action="/ops/alerts/${encodeURIComponent(s.id)}/disable">
                        <button class="btn btnSecondary" type="submit">Disable</button>
                      </form>
                    </td>
                  </tr>
                `;
              })
              .join("")}
            ${subs.rows.length ? "" : `<tr><td class="muted" colspan="6">No subscriptions yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).send(layout({ title: "Alerts", body }));
  });

  app.post("/ops/alerts/:id/disable", auth, async (req, res) => {
    const id = req.params["id"];
    if (!id) return redirectTo(res, "/ops/alerts");
    await deps.pool.query(
      "UPDATE cloudgpus.price_alert_subscriptions SET is_active = false WHERE id = $1",
      [id],
    );
    redirectTo(res, "/ops/alerts");
  });
}
