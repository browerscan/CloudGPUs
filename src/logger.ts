import pino from "pino";
import { getEnv } from "./env.js";

export const logger = pino({
  level: getEnv().LOG_LEVEL,
});
