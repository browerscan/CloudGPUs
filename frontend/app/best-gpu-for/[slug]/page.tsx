import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { comparePrices, getGpuModel } from "@/lib/api";
import { seoGpuSlug } from "@/lib/aliases";
import { formatUsdPerHour } from "@/lib/format";
import { USE_CASE_PAGES } from "@/lib/pseo";

export const revalidate = 3600;

async function safeGpu(slug: string) {
  try {
    return await getGpuModel(slug);
  } catch {
    return null;
  }
}

async function safePrices(slug: string) {
  try {
    return await comparePrices(slug);
  } catch {
    return null;
  }
}

export async function generateStaticParams() {
  return USE_CASE_PAGES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const u = USE_CASE_PAGES.find((x) => x.slug === slug);
  if (!u) return { title: "Best GPU for…" };
  return {
    title: `Best GPU for ${u.name} (${new Date().getFullYear()})`,
    description: `Recommendations for ${u.name}: best overall, budget, and value options with live cloud price ranges and provider links.`,
    alternates: { canonical: `/best-gpu-for/${u.slug}` },
  };
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = USE_CASE_PAGES.find((x) => x.slug === slug);
  if (!u) notFound();

  const [gpuOverall, gpuBudget, gpuValue] = await Promise.all([
    safeGpu(u.recommendations.bestOverall),
    safeGpu(u.recommendations.bestBudget),
    safeGpu(u.recommendations.bestValue),
  ]);

  const [pricesOverall, pricesBudget, pricesValue] = await Promise.all([
    safePrices(u.recommendations.bestOverall),
    safePrices(u.recommendations.bestBudget),
    safePrices(u.recommendations.bestValue),
  ]);

  const pickSummary = (gpuSlug: string, prices: Awaited<ReturnType<typeof safePrices>>) => {
    const min = prices?.stats.min ?? null;
    const provider = prices?.prices[0]?.provider?.name ?? null;
    return { gpuSlug, min, provider };
  };

  const sOverall = pickSummary(u.recommendations.bestOverall, pricesOverall);
  const sBudget = pickSummary(u.recommendations.bestBudget, pricesBudget);
  const sValue = pickSummary(u.recommendations.bestValue, pricesValue);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Best GPU for",
        item: "https://cloudgpus.io/best-gpu-for",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: u.name,
        item: `https://cloudgpus.io/best-gpu-for/${u.slug}`,
      },
    ],
  };

  // Use extended FAQs if available, otherwise fall back to default FAQs
  const faqs = u.extendedContent?.faqs ?? [
    {
      q: `What VRAM do I need for ${u.name}?`,
      a:
        `A practical starting point is ${u.minVramGb}GB+ of VRAM, but the right number depends on model size, precision ` +
        `and batch size. If you frequently hit out-of-memory errors, increase VRAM or reduce batch size / sequence length.`,
    },
    {
      q: `Is spot/preemptible good for ${u.name}?`,
      a:
        `Spot can be excellent for price-sensitive experimentation and batch jobs. For long training runs, use checkpointing ` +
        `and assume interruptions. For production inference, on-demand or reserved capacity is usually safer.`,
    },
    {
      q: `How do I estimate total cost for ${u.name}?`,
      a:
        `Use $/GPU-hour × GPU count × runtime hours as a baseline. Then account for billing increments, minimum rental time, ` +
        `and hidden costs like storage and egress. Our cost estimator helps you compare scenarios quickly.`,
    },
    {
      q: `Which provider should I choose?`,
      a:
        `Choose based on region, reliability tier, and availability of the GPU you need. The cheapest provider is not always the ` +
        `best choice if it has limited stock or frequent interruptions.`,
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const hasExtendedContent = !!u.extendedContent;

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="card" style={{ padding: 22 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div>
            <h1 style={{ marginTop: 0 }}>
              Best GPU for {u.name} ({new Date().getFullYear()})
            </h1>
            <p className="muted" style={{ maxWidth: 920, lineHeight: 1.7 }}>
              {u.summary} This guide prioritizes GPUs that meet the typical VRAM floor for {u.name}{" "}
              while staying cost-efficient across cloud providers. Use the quick picks below, then
              click through to live pricing pages to choose a provider.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn btnSecondary" href="/best-gpu-for">
              All use cases
            </Link>
            <Link className="btn" href="/calculator/cost-estimator">
              Cost estimator
            </Link>
          </div>
        </div>

        {/* Extended Introduction */}
        {hasExtendedContent && u.extendedContent!.introduction && (
          <section style={{ marginTop: 18 }}>
            <div
              className="muted"
              style={{ lineHeight: 1.8, maxWidth: 980 }}
              dangerouslySetInnerHTML={{ __html: u.extendedContent!.introduction }}
            />
          </section>
        )}

        <section className="card" style={{ marginTop: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Quick answer</h2>
          <div className="grid grid3" style={{ marginTop: 12 }}>
            {[
              {
                label: "Best overall",
                gpu: gpuOverall,
                slug: u.recommendations.bestOverall,
                min: sOverall.min,
                provider: sOverall.provider,
                reasoning: u.extendedContent?.quickAnswerReasoning?.overall,
              },
              {
                label: "Best budget",
                gpu: gpuBudget,
                slug: u.recommendations.bestBudget,
                min: sBudget.min,
                provider: sBudget.provider,
                reasoning: u.extendedContent?.quickAnswerReasoning?.budget,
              },
              {
                label: "Best value",
                gpu: gpuValue,
                slug: u.recommendations.bestValue,
                min: sValue.min,
                provider: sValue.provider,
                reasoning: u.extendedContent?.quickAnswerReasoning?.value,
              },
            ].map((card) => (
              <div key={card.label} className="card" style={{ padding: 14 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {card.label}
                </div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{card.gpu?.name ?? card.slug}</div>
                <div className="muted" style={{ marginTop: 6, lineHeight: 1.7, fontSize: 13 }}>
                  <div>Min VRAM: {card.gpu?.vram_gb ?? "—"}GB</div>
                  <div>Lowest observed: {formatUsdPerHour(card.min)}</div>
                  <div>Cheapest provider: {card.provider ?? "—"}</div>
                </div>
                {card.reasoning && (
                  <div
                    className="muted"
                    style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: card.reasoning }}
                  />
                )}
                <div style={{ marginTop: 10 }}>
                  <Link
                    href={`/cloud-gpu/${seoGpuSlug(card.slug)}`}
                    style={{ textDecoration: "underline" }}
                  >
                    View pricing →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Extended VRAM Section */}
        {hasExtendedContent && u.extendedContent!.vramSection && (
          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>VRAM Requirements for {u.name}</h2>
            <div
              className="muted"
              style={{ lineHeight: 1.8, maxWidth: 980 }}
              dangerouslySetInnerHTML={{ __html: u.extendedContent!.vramSection }}
            />
          </section>
        )}

        {/* Extended GPU Table */}
        {hasExtendedContent &&
          u.extendedContent!.gpuTable &&
          u.extendedContent!.gpuTable.length > 0 && (
            <section className="card" style={{ marginTop: 18, padding: 16, overflowX: "auto" }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>GPU Comparison for {u.name}</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "10px", fontSize: 13 }}>GPU</th>
                    <th style={{ padding: "10px", fontSize: 13 }}>VRAM</th>
                    <th style={{ padding: "10px", fontSize: 13 }}>Best For</th>
                    <th style={{ padding: "10px", fontSize: 13 }}>Price Range</th>
                  </tr>
                </thead>
                <tbody>
                  {u.extendedContent!.gpuTable.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom:
                          idx < u.extendedContent!.gpuTable.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: 600 }}>{row.gpu}</td>
                      <td style={{ padding: "10px" }}>{row.vram}</td>
                      <td style={{ padding: "10px" }}>{row.bestFor}</td>
                      <td style={{ padding: "10px" }}>{row.priceRange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

        {/* Training Different Model Sizes */}
        {hasExtendedContent &&
          u.extendedContent!.modelSizes &&
          u.extendedContent!.modelSizes.length > 0 && (
            <section className="card" style={{ marginTop: 18, padding: 16, overflowX: "auto" }}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Training Different Model Sizes</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "10px", fontSize: 13 }}>Model Size</th>
                    <th style={{ padding: "10px", fontSize: 13 }}>Requirements</th>
                    <th style={{ padding: "10px", fontSize: 13 }}>Recommended GPUs</th>
                  </tr>
                </thead>
                <tbody>
                  {u.extendedContent!.modelSizes.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom:
                          idx < u.extendedContent!.modelSizes.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: 600 }}>{row.size}</td>
                      <td style={{ padding: "10px" }}>{row.requirements}</td>
                      <td style={{ padding: "10px" }}>{row.gpus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

        {/* Cost Estimation Guide */}
        {hasExtendedContent && u.extendedContent!.costGuide && (
          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Cost Estimation Guide</h2>
            <div
              className="muted"
              style={{ lineHeight: 1.8, maxWidth: 980 }}
              dangerouslySetInnerHTML={{ __html: u.extendedContent!.costGuide }}
            />
          </section>
        )}

        {/* Default GPU Requirements Section (shown only if no extended content) */}
        {!hasExtendedContent && (
          <section style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Understanding {u.name} GPU requirements</h2>
            <div className="muted" style={{ lineHeight: 1.8, maxWidth: 980 }}>
              <p style={{ marginTop: 0 }}>
                Most workload decisions start with <strong>VRAM</strong>. If your model or batch
                configuration exceeds GPU memory, the job fails — so treat VRAM as a hard
                constraint. For {u.name}, a common minimum is <strong>{u.minVramGb}GB+</strong>, but
                the right number depends on model size, precision (FP16/FP8/INT8), and batch size.
                If you&apos;re close to the limit, performance can degrade due to offloading or
                aggressive checkpointing, which increases total runtime cost even when the hourly
                price looks cheap.
              </p>
              <p>
                Next consider <strong>memory bandwidth</strong> and{" "}
                <strong>architecture generation</strong>. Inference and RAG workloads are often
                bounded by memory movement (KV cache, attention, embedding lookups). Training and
                multi‑GPU workloads benefit from faster interconnects (NVLink inside a node,
                InfiniBand across nodes) and stable availability. Two offers that both claim the
                same GPU model can still behave very differently if CPU/RAM, storage, networking, or
                throttling policies differ.
              </p>
              <p>
                Finally, evaluate <strong>provider reliability</strong> and{" "}
                <strong>billing details</strong>. Marketplace and DePIN capacity can have great
                price floors, but you should assume more variability. On spot/preemptible capacity,
                interruptions are normal; design your workflow accordingly with periodic checkpoints
                and job retry logic. For production workloads, prefer providers with clearer SLAs,
                stable regions, and predictable billing increments (per‑minute vs per‑hour).
              </p>
              <p style={{ marginBottom: 0 }}>
                A simple cost model is: <code>total = $/GPU‑hour × GPU count × hours</code>. In
                practice, also account for minimum rental time, storage, and egress. If you are
                choosing between two GPUs, compare not just hourly rate but also throughput — a
                faster GPU can be cheaper overall if it finishes the job sooner.
              </p>
            </div>
          </section>
        )}

        <section className="card" style={{ marginTop: 18, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Next steps</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div>
              Compare providers: <Link href="/provider">browse providers</Link> or{" "}
              <Link href="/compare">run comparisons</Link>.
            </div>
            <div>
              Estimate spend: <Link href="/calculator/cost-estimator">cost estimator</Link>.
            </div>
            {u.related.length ? (
              <div style={{ marginTop: 10 }}>
                Related use cases:{" "}
                {u.related.map((r, idx) => (
                  <span key={r}>
                    {idx ? " · " : ""}
                    <Link href={`/best-gpu-for/${r}`} style={{ textDecoration: "underline" }}>
                      {r}
                    </Link>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>FAQ</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faqs.map((f) => (
            <div key={f.q}>
              <div style={{ fontWeight: 800 }}>{f.q}</div>
              <div
                className="muted"
                style={{ marginTop: 4, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: f.a }}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
