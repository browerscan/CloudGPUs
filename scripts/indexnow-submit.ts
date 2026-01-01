/* eslint-disable no-console */
import process from "node:process";

function getArg(name: string) {
  const idx = process.argv.findIndex((a) => a === name || a.startsWith(`${name}=`));
  if (idx === -1) return null;
  const hit = process.argv[idx]!;
  if (hit.includes("=")) return hit.split("=").slice(1).join("=");
  return process.argv[idx + 1] ?? null;
}

function usageAndExit(message?: string): never {
  if (message) console.error(message);
  console.error(
    [
      "Usage:",
      "  pnpm exec tsx scripts/indexnow-submit.ts --key <KEY> [--host cloudgpus.io] [--sitemap https://cloudgpus.io/sitemap.xml]",
      "",
      "Env:",
      "  INDEXNOW_KEY, INDEXNOW_HOST, INDEXNOW_SITEMAP_URL, INDEXNOW_KEY_LOCATION",
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  const key = getArg("--key") ?? process.env["INDEXNOW_KEY"] ?? null;
  if (!key) usageAndExit("Missing IndexNow key.");

  const host = getArg("--host") ?? process.env["INDEXNOW_HOST"] ?? "cloudgpus.io";
  const sitemapUrl =
    getArg("--sitemap") ?? process.env["INDEXNOW_SITEMAP_URL"] ?? `https://${host}/sitemap.xml`;
  const keyLocation =
    getArg("--keyLocation") ??
    process.env["INDEXNOW_KEY_LOCATION"] ??
    `https://${host}/${encodeURIComponent(key)}.txt`;

  console.log(`Fetching sitemap: ${sitemapUrl}`);
  const sitemapRes = await globalThis.fetch(sitemapUrl, {
    headers: { accept: "application/xml,text/xml,*/*" },
  });
  if (!sitemapRes.ok) usageAndExit(`Failed to fetch sitemap: HTTP ${sitemapRes.status}`);
  const xml = await sitemapRes.text();

  const urls: string[] = [];
  const locRe = /<loc>([^<]+)<\/loc>/g;
  for (;;) {
    const match = locRe.exec(xml);
    if (!match) break;
    const loc = match[1]?.trim();
    if (loc) urls.push(loc);
  }

  if (!urls.length) usageAndExit("No <loc> URLs found in sitemap.");

  console.log(`Submitting ${urls.length} URLs to IndexNow...`);
  const payload = { host, key, keyLocation, urlList: urls };
  const res = await globalThis.fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.text().catch(() => "");
  if (!res.ok) {
    console.error(`IndexNow error: HTTP ${res.status}`);
    if (body) console.error(body.slice(0, 2000));
    process.exit(2);
  }

  console.log(`IndexNow OK: HTTP ${res.status}`);
  if (body) console.log(body.slice(0, 2000));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
