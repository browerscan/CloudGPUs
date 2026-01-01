import { createPool } from "./pool.js";
import { runMigrations } from "./migrations.js";
import { logger } from "../logger.js";

/**
 * Run database migrations on startup.
 * This is called from server.ts before the API starts listening.
 */
export async function runMigrationsOnStartup(): Promise<void> {
  const pool = createPool();
  try {
    logger.info("Running database migrations...");
    await runMigrations(pool);
    logger.info("Database migrations completed successfully");
  } catch (err) {
    logger.error({ err }, "Database migrations failed");
    throw err;
  } finally {
    await pool.end();
  }
}

/**
 * CLI entry point for running migrations manually.
 * Usage: node dist/db/migrate.js
 */
async function main() {
  try {
    await runMigrationsOnStartup();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Migration run failed");
    process.exit(1);
  }
}

// Only run main if this file is executed directly (not imported)
// Using a simple check for ESM
const arg1 = process.argv[1];
if (arg1 && (arg1.endsWith("/migrate.ts") || arg1.endsWith("/migrate.js"))) {
  main();
}
