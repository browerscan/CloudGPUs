import { Worker } from "bullmq";
import { chromium } from "playwright-core";
import { createRedis } from "../redis/client.js";
import { logger } from "../logger.js";
import { QUEUES } from "./queues.js";

function parseProxyFromEnv(): { server: string; username?: string; password?: string } | undefined {
  const raw = process.env["SOAX_PROXY_URL"];
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const username = url.username ? decodeURIComponent(url.username) : undefined;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    // Playwright expects server without creds.
    const server = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
    const proxy: { server: string; username?: string; password?: string } = { server };
    if (username) proxy.username = username;
    if (password) proxy.password = password;
    return proxy;
  } catch {
    return undefined;
  }
}

function parseQueues() {
  const raw = process.env["WORKER_QUEUES"] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const redis = createRedis();
  await redis.connect();

  const queues = parseQueues();
  if (!queues.includes(QUEUES.browserScrape) && !queues.includes(QUEUES.screenshot)) {
    logger.warn("Browser worker started without browser queues; exiting");
    return;
  }

  const proxy = parseProxyFromEnv();
  const launchOptions: Parameters<typeof chromium.launch>[0] = { headless: true };
  if (proxy) launchOptions.proxy = proxy;
  const browser = await chromium.launch(launchOptions);

  const worker = new Worker(
    QUEUES.browserScrape,
    async (job) => {
      const url = job.data?.url;
      if (typeof url !== "string") throw new Error("missing_url");
      const timeoutMs = typeof job.data?.timeoutMs === "number" ? job.data.timeoutMs : 120_000;
      const waitUntil = job.data?.waitUntil === "networkidle" ? "networkidle" : "domcontentloaded";
      const returnHtml = job.data?.returnHtml === true;
      const blockResources = job.data?.blockResources !== false;
      const userAgent = typeof job.data?.userAgent === "string" ? job.data.userAgent : undefined;
      const contextOptions: Parameters<typeof browser.newContext>[0] = {};
      if (userAgent) contextOptions.userAgent = userAgent;
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      try {
        if (blockResources) {
          await page.route("**/*", (route) => {
            const type = route.request().resourceType();
            if (type === "image" || type === "font" || type === "media") {
              return route.abort();
            }
            return route.continue();
          });
        }
        const res = await page.goto(url, { waitUntil, timeout: timeoutMs });
        const finalUrl = page.url();
        if (!returnHtml) return { finalUrl, status: res?.status() ?? 0 };
        const html = await page.content();
        // Store result in BullMQ; keep it bounded to avoid large Redis payloads.
        const max = 2_000_000;
        const clipped = html.length > max ? html.slice(0, max) : html;
        return { finalUrl, status: res?.status() ?? 0, html: clipped };
      } finally {
        await page.close();
        await context.close();
      }
    },
    { connection: redis, concurrency: Number(process.env["WORKER_CONCURRENCY"] ?? "2") },
  );

  const screenshotWorker = new Worker(
    QUEUES.screenshot,
    async (job) => {
      const url = job.data?.url;
      const path = job.data?.path;
      if (typeof url !== "string" || typeof path !== "string")
        throw new Error("missing_url_or_path");
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.screenshot({ path, fullPage: true });
        return { ok: true, url, path };
      } finally {
        await page.close();
        await context.close();
      }
    },
    { connection: redis, concurrency: 1 },
  );

  logger.info({ queues }, "Browser worker running");

  const shutdown = async () => {
    await worker.close();
    await screenshotWorker.close();
    await browser.close();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "Browser worker boot failed");
  process.exit(1);
});
