import { Queue, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import { z } from "zod";
import { QUEUES } from "../queues.js";
import type { ScrapeClient } from "../adapters/types.js";

const browserResultSchema = z.object({
  finalUrl: z.string().min(1).optional(),
  html: z.string().min(1).optional(),
});

function timeoutSignal(ms: number) {
  // AbortSignal.timeout is available in Node 18+.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySignal = AbortSignal as any;
  if (typeof anySignal.timeout === "function") return anySignal.timeout(ms) as AbortSignal;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  // Best-effort cleanup when aborted externally.
  controller.signal.addEventListener("abort", () => clearTimeout(id), { once: true });
  return controller.signal;
}

function ensureHeaderCase(headers?: Record<string, string>) {
  if (!headers) return {};
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
}

export function createScrapeClient(args: { redis: Redis }): ScrapeClient {
  const browserQueue = new Queue(QUEUES.browserScrape, { connection: args.redis });
  const browserEvents = new QueueEvents(QUEUES.browserScrape, { connection: args.redis });

  return {
    async fetchText({ url, headers, timeoutMs }) {
      const res = await fetch(url, {
        headers: ensureHeaderCase(headers),
        signal: timeoutSignal(timeoutMs ?? 30_000),
      });
      const text = await res.text();
      return { finalUrl: res.url, status: res.status, text };
    },

    async fetchJson({ url, headers, method, body, timeoutMs }) {
      const res = await fetch(url, {
        method: method ?? (body ? "POST" : "GET"),
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...ensureHeaderCase(headers),
        },
        ...(body ? { body } : {}),
        signal: timeoutSignal(timeoutMs ?? 30_000),
      });
      const json = (await res.json()) as unknown;
      return { finalUrl: res.url, status: res.status, json: json as never };
    },

    async browserHtml({ url, timeoutMs, waitUntil, blockResources }) {
      const job = await browserQueue.add(
        "browser-scrape",
        {
          url,
          returnHtml: true,
          timeoutMs: timeoutMs ?? 120_000,
          waitUntil: waitUntil ?? "domcontentloaded",
          blockResources: blockResources ?? true,
        },
        {
          attempts: 2,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: { age: 3600, count: 5000 },
          removeOnFail: { age: 24 * 3600, count: 5000 },
        },
      );

      const result = await job.waitUntilFinished(browserEvents, (timeoutMs ?? 120_000) + 10_000);
      const parsed = browserResultSchema.safeParse(result);
      if (!parsed.success || !parsed.data.html) throw new Error("browser_scrape_invalid_result");
      return { finalUrl: parsed.data.finalUrl ?? url, html: parsed.data.html };
    },
  };
}

export async function closeScrapeClient(args: { redis: Redis }) {
  // QueueEvents created per-process; safe to close as part of shutdown if needed.
  // We intentionally no-op here to keep the pricing worker simple.
  void args;
}
