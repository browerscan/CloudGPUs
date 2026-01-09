/**
 * Fix standalone output structure for OpenNext/Cloudflare compatibility.
 * Monorepo with outputFileTracingRoot creates: .next/standalone/frontend/.next
 * OpenNext expects: .next/standalone/.next
 */
import {
  existsSync,
  cpSync,
  rmSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  lstatSync,
  unlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";

const standaloneDir = join(process.cwd(), ".next", "standalone");
const nestedDir = join(standaloneDir, "frontend");

/**
 * Recursively fix symlinks that point to the old frontend/ path
 */
function fixSymlinks(dir, oldPath, newPath) {
  if (!existsSync(dir)) return;

  for (const item of readdirSync(dir)) {
    const fullPath = join(dir, item);
    const stat = lstatSync(fullPath);

    if (stat.isSymbolicLink()) {
      const target = readlinkSync(fullPath);
      if (target.includes(oldPath)) {
        const newTarget = target.replace(oldPath, newPath);
        unlinkSync(fullPath);
        symlinkSync(newTarget, fullPath);
      }
    } else if (stat.isDirectory()) {
      fixSymlinks(fullPath, oldPath, newPath);
    }
  }
}

if (existsSync(nestedDir)) {
  console.log("Fixing standalone directory structure for OpenNext...");

  // Move contents from frontend/ to standalone root
  const items = readdirSync(nestedDir);
  for (const item of items) {
    const src = join(nestedDir, item);
    const dest = join(standaloneDir, item);
    console.log(`  Moving ${item}...`);
    cpSync(src, dest, { recursive: true });
  }

  // Remove the nested frontend directory
  rmSync(nestedDir, { recursive: true, force: true });

  // Fix symlinks that were pointing to the old frontend/ path
  console.log("Fixing symlinks...");
  const oldPath = join(standaloneDir, "frontend");
  fixSymlinks(standaloneDir, oldPath, standaloneDir);

  console.log("✓ Standalone directory structure fixed");
} else {
  console.log("✓ Standalone structure is already correct (no nested frontend dir)");
}

// Create empty pages-manifest.json for App Router only projects
// OpenNext expects this file even when no Pages Router is used
const pagesServerDir = join(standaloneDir, ".next", "server");
const pagesManifestPath = join(pagesServerDir, "pages-manifest.json");

if (!existsSync(pagesManifestPath)) {
  console.log("Creating empty pages-manifest.json for App Router compatibility...");
  mkdirSync(pagesServerDir, { recursive: true });
  writeFileSync(pagesManifestPath, "{}");
  console.log("✓ Created pages-manifest.json");
}

// Copy index.edge.js for @vercel/og (OpenNext needs edge version for Cloudflare Workers)
// Standalone build only includes index.node.js, we need to copy edge version from source
const sourceEdge = join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/index.edge.js");

// Handle both hoisted and non-hoisted (pnpm) node_modules structures
const pnpmDir = join(standaloneDir, "node_modules", ".pnpm");
let vercelOgDirs = [];

if (existsSync(pnpmDir)) {
  // Non-hoisted pnpm structure
  vercelOgDirs = readdirSync(pnpmDir)
    .filter((d) => d.startsWith("next@"))
    .map((d) => join(pnpmDir, d, "node_modules/next/dist/compiled/@vercel/og"));
} else {
  // Hoisted structure - check direct path
  const hoistedVercelOg = join(standaloneDir, "node_modules/next/dist/compiled/@vercel/og");
  if (existsSync(join(hoistedVercelOg, ".."))) {
    vercelOgDirs = [hoistedVercelOg];
  }
}

for (const vercelOgDir of vercelOgDirs) {
  if (!existsSync(vercelOgDir)) continue;

  const targetEdge = join(vercelOgDir, "index.edge.js");
  if (!existsSync(targetEdge) && existsSync(sourceEdge)) {
    console.log("Copying index.edge.js for @vercel/og to standalone...");
    cpSync(sourceEdge, targetEdge);
    console.log("✓ Copied index.edge.js to standalone");
  }
}

// Also ensure the .open-next output directory has the vercel/og structure
// This is needed because OpenNext's copyFileSync doesn't create parent directories
const openNextVercelOgDir = join(
  process.cwd(),
  ".open-next/server-functions/default/node_modules/next/dist/compiled/@vercel/og",
);

if (!existsSync(openNextVercelOgDir)) {
  console.log("Creating OpenNext vercel/og directory structure...");
  mkdirSync(openNextVercelOgDir, { recursive: true });
  if (existsSync(sourceEdge)) {
    cpSync(sourceEdge, join(openNextVercelOgDir, "index.edge.js"));
    console.log("✓ Pre-created OpenNext vercel/og directory with index.edge.js");
  }
}
