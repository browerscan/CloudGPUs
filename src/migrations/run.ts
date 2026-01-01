import { createPool } from "../db/pool.js";
import { runMigrations } from "../db/migrations.js";
import { logger } from "../logger.js";

async function main() {
  const pool = createPool();
  try {
    await runMigrations(pool);
    logger.info("Migrations complete");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  logger.error({ err }, "Migration run failed");
  process.exitCode = 1;
});
