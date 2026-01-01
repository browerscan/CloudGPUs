import { describe, expect, it, vi } from "vitest";
import type { Redis } from "ioredis";

type AddedJob = { name: string; data: unknown; opts: unknown };

let lastQueueName: string | null = null;
let lastAdded: AddedJob | null = null;
let waitResult: unknown = null;

vi.mock("bullmq", () => {
  class QueueEvents {
    constructor(_name: string) {}
  }

  class Queue {
    private name: string;
    constructor(name: string) {
      this.name = name;
      lastQueueName = name;
    }
    async add(name: string, data: unknown, opts: unknown) {
      lastAdded = { name, data, opts };
      return {
        waitUntilFinished: async () => waitResult,
      };
    }
  }

  return { Queue, QueueEvents };
});

describe("workers/scrape client", () => {
  it("fetchText lowercases headers and returns text", async () => {
    vi.resetModules();
    const fetchSpy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockImplementation(async (_url: unknown, init?: unknown) => {
        const headers = ((init as { headers?: Record<string, string> } | undefined)?.headers ??
          {}) as Record<string, string>;
        expect(Object.keys(headers).sort()).toEqual(["user-agent", "x-test"]);
        return {
          url: "https://final.example",
          status: 200,
          text: async () => "ok",
        } as unknown as Response;
      });

    const { createScrapeClient } = await import("../../src/workers/scrape/client.js");
    const client = createScrapeClient({ redis: {} as Redis });
    const res = await client.fetchText({
      url: "https://example.com",
      headers: { "User-Agent": "x", "X-Test": "1" },
    });
    expect(res).toEqual({ finalUrl: "https://final.example", status: 200, text: "ok" });
    fetchSpy.mockRestore();
  });

  it("fetchJson defaults to POST when body is present", async () => {
    vi.resetModules();
    const fetchSpy = vi
      .spyOn(globalThis as unknown as { fetch: typeof fetch }, "fetch")
      .mockImplementation(async (_url: unknown, init?: unknown) => {
        expect((init as { method: string }).method).toBe("POST");
        expect((init as { headers: Record<string, string> }).headers["content-type"]).toBe(
          "application/json",
        );
        expect((init as { body: string }).body).toBe('{"a":1}');
        return {
          url: "https://api.example",
          status: 201,
          json: async () => ({ ok: true }),
        } as unknown as Response;
      });

    const { createScrapeClient } = await import("../../src/workers/scrape/client.js");
    const client = createScrapeClient({ redis: {} as Redis });
    const res = await client.fetchJson<{ ok: boolean }>({
      url: "https://api.example",
      body: '{"a":1}',
    });
    expect(res).toEqual({ finalUrl: "https://api.example", status: 201, json: { ok: true } });
    fetchSpy.mockRestore();
  });

  it("browserHtml enqueues a browser-scrape job and validates result", async () => {
    vi.resetModules();
    lastQueueName = null;
    lastAdded = null;
    waitResult = { finalUrl: "https://final", html: "<html>ok</html>" };

    const { createScrapeClient } = await import("../../src/workers/scrape/client.js");
    const { QUEUES } = await import("../../src/workers/queues.js");
    const client = createScrapeClient({ redis: {} as Redis });
    const res = await client.browserHtml({ url: "https://example.com" });

    expect(lastQueueName).toBe(QUEUES.browserScrape);
    expect((lastAdded as AddedJob | null)?.name).toBe("browser-scrape");
    expect((lastAdded as AddedJob | null)?.data).toEqual(
      expect.objectContaining({
        url: "https://example.com",
        returnHtml: true,
      }),
    );
    expect(res).toEqual({ finalUrl: "https://final", html: "<html>ok</html>" });

    const { closeScrapeClient } = await import("../../src/workers/scrape/client.js");
    await closeScrapeClient({ redis: {} as Redis });
  });

  it("browserHtml throws on invalid worker result", async () => {
    vi.resetModules();
    waitResult = { finalUrl: "https://final" };

    const { createScrapeClient } = await import("../../src/workers/scrape/client.js");
    const client = createScrapeClient({ redis: {} as Redis });
    await expect(client.browserHtml({ url: "https://example.com" })).rejects.toThrow(
      "browser_scrape_invalid_result",
    );
  });
});
