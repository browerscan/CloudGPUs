import type { Job } from "bullmq";
import type { Pool } from "pg";

export function apiSyncProcessor(_pool: Pool) {
  return async (job: Job) => {
    // Placeholder for provider API sync logic (tokens, region updates, etc).
    return { ok: true, job: job.name };
  };
}

export function providerUpdateProcessor(_pool: Pool) {
  return async (job: Job) => {
    // Placeholder for provider metadata refresh.
    return { ok: true, job: job.name };
  };
}
