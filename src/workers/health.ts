import { createRedis } from "../redis/client.js";

export async function check() {
  const redis = createRedis();
  await redis.connect();
  await redis.ping();
  await redis.quit();
}
