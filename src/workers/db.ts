import type { Pool, PoolClient } from "pg";
import type { PricingInstance } from "./adapters/types.js";

export async function withTx<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findProviderId(client: PoolClient, slug: string) {
  const res = await client.query<{ id: string }>(
    "SELECT id FROM cloudgpus.providers WHERE slug = $1 LIMIT 1",
    [slug],
  );
  return res.rows[0]?.id ?? null;
}

export async function findGpuId(client: PoolClient, slug: string) {
  const res = await client.query<{ id: string }>(
    "SELECT id FROM cloudgpus.gpu_models WHERE slug = $1 LIMIT 1",
    [slug],
  );
  return res.rows[0]?.id ?? null;
}

export async function createScrapeJob(client: PoolClient, providerId: string) {
  const res = await client.query<{ id: string }>(
    `
    INSERT INTO cloudgpus.scrape_jobs (provider_id, status)
    VALUES ($1, 'running')
    RETURNING id
    `,
    [providerId],
  );
  return res.rows[0]!.id;
}

export async function finishScrapeJob(args: {
  client: PoolClient;
  jobId: string;
  status: "completed" | "failed" | "timeout" | "rate_limited";
  startedAt: number;
  instancesFound?: number;
  instancesUpdated?: number;
  instancesCreated?: number;
  instancesDeactivated?: number;
  errorMessage?: string;
  errorCode?: string;
}) {
  const durationMs = Date.now() - args.startedAt;
  await args.client.query(
    `
    UPDATE cloudgpus.scrape_jobs
    SET
      status = $2,
      completed_at = now(),
      duration_ms = $3,
      instances_found = COALESCE($4, instances_found),
      instances_updated = COALESCE($5, instances_updated),
      instances_created = COALESCE($6, instances_created),
      instances_deactivated = COALESCE($7, instances_deactivated),
      error_message = $8,
      error_code = $9
    WHERE id = $1
    `,
    [
      args.jobId,
      args.status,
      durationMs,
      args.instancesFound ?? null,
      args.instancesUpdated ?? null,
      args.instancesCreated ?? null,
      args.instancesDeactivated ?? null,
      args.errorMessage ?? null,
      args.errorCode ?? null,
    ],
  );
}

export async function createScrapeJobInPool(pool: Pool, providerId: string) {
  const res = await pool.query<{ id: string }>(
    `
    INSERT INTO cloudgpus.scrape_jobs (provider_id, status)
    VALUES ($1, 'running')
    RETURNING id
    `,
    [providerId],
  );
  return res.rows[0]!.id;
}

export async function finishScrapeJobInPool(args: {
  pool: Pool;
  jobId: string;
  status: "completed" | "failed" | "timeout" | "rate_limited";
  startedAt: number;
  instancesFound?: number;
  instancesUpdated?: number;
  instancesCreated?: number;
  instancesDeactivated?: number;
  errorMessage?: string;
  errorCode?: string;
}) {
  const durationMs = Date.now() - args.startedAt;
  await args.pool.query(
    `
    UPDATE cloudgpus.scrape_jobs
    SET
      status = $2,
      completed_at = now(),
      duration_ms = $3,
      instances_found = COALESCE($4, instances_found),
      instances_updated = COALESCE($5, instances_updated),
      instances_created = COALESCE($6, instances_created),
      instances_deactivated = COALESCE($7, instances_deactivated),
      error_message = $8,
      error_code = $9
    WHERE id = $1
    `,
    [
      args.jobId,
      args.status,
      durationMs,
      args.instancesFound ?? null,
      args.instancesUpdated ?? null,
      args.instancesCreated ?? null,
      args.instancesDeactivated ?? null,
      args.errorMessage ?? null,
      args.errorCode ?? null,
    ],
  );
}

export async function upsertInstancesForProvider(args: {
  client: PoolClient;
  providerId: string;
  scrapeJobId: string;
  instances: PricingInstance[];
}) {
  const seenTypes = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const inst of args.instances) {
    seenTypes.add(inst.instanceType);
    const gpuModelId = await findGpuId(args.client, inst.gpuSlug);
    if (!gpuModelId) continue;

    const res = await args.client.query<{ id: string; inserted: boolean }>(
      `
      INSERT INTO cloudgpus.instances (
        provider_id,
        gpu_model_id,
        instance_type,
        instance_name,
        gpu_count,
        price_per_hour,
        price_per_hour_spot,
        currency,
        vcpu_count,
        ram_gb,
        storage_gb,
        availability_status,
        available_regions,
        instance_url,
        source_url,
        raw_data,
        scrape_job_id,
        last_scraped_at,
        is_active,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        COALESCE($8, 'USD'),
        $9,$10,$11,
        COALESCE($12::cloudgpus.availability_status, 'available'::cloudgpus.availability_status),
        $13,
        $14,$15,
        $16::jsonb,
        $17,
        now(),
        true,
        now()
      )
      ON CONFLICT (provider_id, instance_type) DO UPDATE SET
        gpu_model_id = EXCLUDED.gpu_model_id,
        instance_name = EXCLUDED.instance_name,
        gpu_count = EXCLUDED.gpu_count,
        price_per_hour = EXCLUDED.price_per_hour,
        price_per_hour_spot = EXCLUDED.price_per_hour_spot,
        currency = EXCLUDED.currency,
        vcpu_count = EXCLUDED.vcpu_count,
        ram_gb = EXCLUDED.ram_gb,
        storage_gb = EXCLUDED.storage_gb,
        availability_status = EXCLUDED.availability_status,
        available_regions = EXCLUDED.available_regions,
        instance_url = EXCLUDED.instance_url,
        source_url = EXCLUDED.source_url,
        raw_data = EXCLUDED.raw_data,
        scrape_job_id = EXCLUDED.scrape_job_id,
        last_scraped_at = now(),
        is_active = true,
        updated_at = now()
      RETURNING id, (xmax = 0) AS inserted
      `,
      [
        args.providerId,
        gpuModelId,
        inst.instanceType,
        inst.instanceName ?? null,
        inst.gpuCount,
        inst.pricePerHour,
        inst.pricePerHourSpot ?? null,
        inst.currency ?? null,
        inst.vcpuCount ?? null,
        inst.ramGb ?? null,
        inst.storageGb ?? null,
        inst.availabilityStatus ?? null,
        inst.regions ?? null,
        inst.instanceUrl ?? null,
        inst.sourceUrl ?? null,
        JSON.stringify(inst.rawData ?? inst),
        args.scrapeJobId,
      ],
    );

    const inserted = res.rows[0]?.inserted === true;
    if (inserted) created += 1;
    else updated += 1;
  }

  // Deactivate missing
  const typesArr = [...seenTypes];
  const deactivatedRes = await args.client.query<{ count: string }>(
    `
    UPDATE cloudgpus.instances
    SET is_active = false, updated_at = now()
    WHERE provider_id = $1
      AND is_active = true
      AND instance_type <> ALL($2::text[])
    RETURNING 1
    `,
    [args.providerId, typesArr.length ? typesArr : ["__none__"]],
  );

  const deactivated = deactivatedRes.rowCount ?? 0;

  return { seen: seenTypes.size, created, updated, deactivated };
}
