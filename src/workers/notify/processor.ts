import type { Job } from "bullmq";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getEnv } from "../../env.js";
import { logger } from "../../logger.js";

const slackSchema = z.object({
  text: z.string().min(1),
});

export function slackProcessor() {
  return async (job: Job) => {
    const env = getEnv();
    const { text } = slackSchema.parse(job.data);
    const url = env.SLACK_WEBHOOK_URL;
    if (!url) {
      logger.warn("SLACK_WEBHOOK_URL not configured; skipping Slack send");
      return { skipped: true };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`slack_failed:${res.status}`);
    return { ok: true };
  };
}

const webhookSchema = z.object({
  url: z.string().url(),
  payload: z.unknown(),
});

export function webhookProcessor() {
  return async (job: Job) => {
    const { url, payload } = webhookSchema.parse(job.data);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`webhook_failed:${res.status}`);
    return { ok: true };
  };
}

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().min(1),
});

export function emailProcessor() {
  return async (job: Job) => {
    const env = getEnv();
    const { to, subject, text } = emailSchema.parse(job.data);

    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
      logger.warn("SMTP not configured; skipping email send");
      return { skipped: true };
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: env.SMTP_USER,
      to,
      subject,
      text,
    });

    return { ok: true };
  };
}
