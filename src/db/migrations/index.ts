export { migration as addPerformanceIndexes } from "./add_performance_indexes.js";

export const migrations = [
  { name: "add_performance_indexes", module: () => import("./add_performance_indexes.js") },
];
