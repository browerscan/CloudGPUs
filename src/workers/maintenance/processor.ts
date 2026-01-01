import type { Job } from "bullmq";
import type { Pool } from "pg";

export function cleanupProcessor(pool: Pool) {
  return async (_job: Job) => {
    // Keep DB size bounded; schema has a helper function.
    await pool.query("SELECT cloudgpus.cleanup_stale_instances()");
    return { ok: true };
  };
}
