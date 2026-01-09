import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

const sendMail = vi.fn(async () => undefined);
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("nodemailer", () => {
  return { default: { createTransport } };
});

describe("workers/notify processors", () => {
  it("slackProcessor skips when webhook is not configured", async () => {
    vi.resetModules();
    delete process.env["SLACK_WEBHOOK_URL"];
    const { resetEnvForTests } = await import("../../src/env.js");
    resetEnvForTests();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("should-not-fetch");
    });

    const { slackProcessor } = await import("../../src/workers/notify/processor.js");
    const run = slackProcessor();
    await expect(run({ data: { text: "hi" } } as unknown as Job)).resolves.toEqual({
      skipped: true,
    });

    fetchSpy.mockRestore();
  });

  it("slackProcessor sends when configured", async () => {
    vi.resetModules();
    process.env["SLACK_WEBHOOK_URL"] = "https://example.com/slack";
    const { resetEnvForTests } = await import("../../src/env.js");
    resetEnvForTests();

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
    } as never);

    const { slackProcessor } = await import("../../src/workers/notify/processor.js");
    const run = slackProcessor();
    await expect(run({ data: { text: "hello" } } as unknown as Job)).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/slack",
      expect.objectContaining({ method: "POST" }),
    );

    fetchSpy.mockRestore();
  });

  it("webhookProcessor posts JSON and errors on non-2xx", async () => {
    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as never);

    const { webhookProcessor } = await import("../../src/workers/notify/processor.js");
    const run = webhookProcessor();
    await expect(
      run({ data: { url: "https://example.com/hook", payload: { ok: true } } } as unknown as Job),
    ).rejects.toThrow("webhook_failed:500");

    fetchSpy.mockRestore();
  });

  it("emailProcessor skips when SMTP is not configured", async () => {
    vi.resetModules();
    delete process.env["SMTP_HOST"];
    delete process.env["SMTP_PORT"];
    delete process.env["SMTP_USER"];
    delete process.env["SMTP_PASS"];
    const { resetEnvForTests } = await import("../../src/env.js");
    resetEnvForTests();

    const { emailProcessor } = await import("../../src/workers/notify/processor.js");
    const run = emailProcessor();
    await expect(
      run({ data: { to: "a@example.com", subject: "Hi", text: "Body" } } as unknown as Job),
    ).resolves.toEqual({ skipped: true });
  });

  it("emailProcessor sends via nodemailer when configured", async () => {
    vi.resetModules();
    process.env["SMTP_HOST"] = "smtp.example.com";
    process.env["SMTP_PORT"] = "587";
    process.env["SMTP_USER"] = "user@example.com";
    process.env["SMTP_PASS"] = "pass";
    process.env["SMTP_FROM_NAME"] = "CloudGPUs.io";
    const { resetEnvForTests } = await import("../../src/env.js");
    resetEnvForTests();

    sendMail.mockClear();
    createTransport.mockClear();

    const { emailProcessor } = await import("../../src/workers/notify/processor.js");
    const run = emailProcessor();
    await expect(
      run({ data: { to: "to@example.com", subject: "Subj", text: "Hello" } } as unknown as Job),
    ).resolves.toEqual({ ok: true });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "user@example.com", pass: "pass" },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "CloudGPUs.io <user@example.com>",
        to: "to@example.com",
        subject: "Subj",
        text: "Hello",
      }),
    );
  });
});
