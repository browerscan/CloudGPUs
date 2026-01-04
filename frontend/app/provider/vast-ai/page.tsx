import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Vast.ai GPU Marketplace Pricing (2025) - The Cheapest GPU Option",
    description:
      "Compare Vast.ai GPU pricing across RTX 4090, RTX 3090, A100 and more. Peer-to-peer GPU marketplace offering the cheapest GPU cloud computing for AI and machine learning.",
    alternates: { canonical: "/provider/vast-ai" },
    openGraph: {
      title: "Vast.ai GPU Marketplace Pricing (2025) - The Cheapest GPU Option",
      description: "Compare Vast.ai GPU pricing. P2P GPU marketplace with the cheapest cloud GPUs.",
      url: "/provider/vast-ai",
    },
  };
}

export default async function VastAiPage() {
  // Fetch Vast.ai instances
  const instances = await apiGet<{
    docs: Array<{
      id: string;
      gpu_slug: string;
      gpu_name: string;
      gpu_short_name: string;
      gpu_vram_gb: number;
      gpu_architecture: string;
      price_per_gpu_hour: string;
      price_per_hour_spot: string | null;
      instance_type: string;
      gpu_count: number;
      has_nvlink: boolean | null;
      has_infiniband: boolean | null;
      availability_status: string;
      last_scraped_at: string;
      min_rental_hours: number | null;
    }>;
  }>(
    `/api/instances?limit=200&depth=1&where[provider_slug][equals]=vast-ai&where[is_active][equals]=true&sort=price_per_gpu_hour`,
    { next: { revalidate: 600 } },
  ).catch(() => ({ docs: [] }));

  // Group by GPU slug
  const grouped = new Map<
    string,
    {
      gpuSlug: string;
      gpuName: string;
      gpuShortName: string;
      gpuVramGb: number;
      minOnDemand: number;
      minSpot: number | null;
      availability: string;
      lastUpdated: string;
    }
  >();

  for (const row of instances.docs) {
    const gpuSlug = row.gpu_slug ?? "unknown";
    const onDemand = Number(row.price_per_gpu_hour);
    const spot = row.price_per_hour_spot
      ? Number(row.price_per_hour_spot) / Math.max(1, row.gpu_count)
      : null;

    if (!grouped.has(gpuSlug)) {
      grouped.set(gpuSlug, {
        gpuSlug,
        gpuName: row.gpu_name ?? row.gpu_short_name ?? gpuSlug,
        gpuShortName: row.gpu_short_name ?? row.gpu_name ?? gpuSlug,
        gpuVramGb: row.gpu_vram_gb ?? 0,
        minOnDemand: onDemand,
        minSpot: spot,
        availability: row.availability_status ?? "available",
        lastUpdated: row.last_scraped_at,
      });
    } else {
      const entry = grouped.get(gpuSlug)!;
      if (onDemand < entry.minOnDemand) entry.minOnDemand = onDemand;
      if (spot !== null && (entry.minSpot === null || spot < entry.minSpot)) {
        entry.minSpot = spot;
      }
    }
  }

  const offerings = [...grouped.values()]
    .filter((g) => g.gpuSlug !== "unknown")
    .sort((a, b) => a.minOnDemand - b.minOnDemand);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cloudgpus.io/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Providers",
        item: "https://cloudgpus.io/provider",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Vast.ai",
        item: "https://cloudgpus.io/provider/vast-ai",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Vast.ai really the cheapest GPU cloud option?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, Vast.ai is typically the cheapest GPU cloud option available, often offering prices 70-90% lower than traditional cloud providers. RTX 3090 and RTX 4090 GPUs can be rented for under $0.30/hour, while even A100 instances are significantly cheaper than AWS, Google Cloud, or Azure. The peer-to-peer marketplace model allows individual GPU owners to rent out their hardware, creating a competitive market that drives prices down.",
        },
      },
      {
        "@type": "Question",
        name: "What are the risks of using Vast.ai compared to AWS or Google Cloud?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Vast.ai lacks the reliability guarantees of traditional cloud providers. There is no SLA, instances can be discontinued by hosts at any time, and the quality of individual hosts varies significantly. Some hosts may have poor internet connections, unreliable hardware, or disappear without notice. For critical production workloads, Vast.ai is generally not recommended. For experimentation, personal projects, and fault-tolerant workloads with checkpointing, the cost savings often outweigh these risks.",
        },
      },
      {
        "@type": "Question",
        name: "What GPU models are available on Vast.ai?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Vast.ai offers the widest variety of GPUs among cloud providers, ranging from consumer RTX cards (RTX 4090, RTX 3090, RTX 4080) to workstation GPUs (RTX 6000 Ada) to datacenter hardware (A100, H100). The availability varies based on what hosts are currently offering. Consumer GPUs are the most abundant and cheapest, making Vast.ai particularly attractive for workloads that don't require datacenter-class hardware.",
        },
      },
      {
        "@type": "Question",
        name: "How does Vast.ai pricing work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Vast.ai uses a dynamic pricing model where individual hosts set their own rates. Pricing can vary significantly between hosts offering the same GPU model. Hosts may charge different rates based on their location, hardware specs, electricity costs, and demand. Prices can fluctuate based on market conditions, and some hosts offer discounts for longer rentals. The marketplace model means you can often find exceptional deals by comparing available options.",
        },
      },
      {
        "@type": "Question",
        name: "When should I use Vast.ai vs other GPU providers?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Choose Vast.ai for personal projects, learning, experimentation, and any workload where cost is the primary concern and reliability is less critical. It's excellent for students, researchers with limited budgets, and hobbyists. For production workloads, long-running training jobs without checkpointing, or applications requiring guaranteed uptime, traditional cloud providers like AWS, Google Cloud, or specialized GPU clouds like CoreWeave and Lambda Labs are better choices despite higher costs.",
        },
      },
    ],
  };

  return (
    <div className="container">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          Home
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span>{" "}
        <Link href="/provider" style={{ textDecoration: "none" }}>
          Providers
        </Link>{" "}
        <span style={{ opacity: 0.5 }}>/</span> <span>Vast.ai</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>
          Vast.ai GPU Marketplace Pricing (2025) - The Cheapest GPU Option
        </h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          Compare Vast.ai GPU pricing across RTX 4090, RTX 3090, A100 and more. Vast.ai operates a
          peer-to-peer GPU marketplace connecting GPU owners with users, typically offering the
          lowest GPU cloud prices available anywhere.
        </p>

        <div className="grid grid4" style={{ gap: 16, marginTop: 18 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              GPU offerings
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{offerings.length}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Starting at
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>
              {offerings.length > 0 ? `$${offerings[0]?.minOnDemand.toFixed(2)}/hr` : "—"}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Type
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>P2P Marketplace</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Reliability
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Varies by host</div>
          </div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>About Vast.ai</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            <strong>Vast.ai</strong> is a peer-to-peer GPU marketplace founded in 2018 with a simple
            but powerful premise: connect people who have GPUs (and want to earn money from them)
            with people who need GPU computing power. Unlike traditional cloud providers that own
            and operate their own data centers, Vast.ai&apos;s infrastructure consists of GPUs owned by
            individuals and businesses around the world who rent out their idle capacity through the
            platform.
          </p>
          <p>
            This marketplace model enables <strong>dramatically lower prices</strong>. Without the
            overhead of building and maintaining data centers, Vast.ai hosts can offer GPUs at a
            fraction of the cost of AWS, Google Cloud, or Azure. Common consumer GPUs like the RTX
            3090 and RTX 4090 can often be rented for under $0.30/hour, while even enterprise GPUs
            like the A100 are significantly cheaper than hyperscaler alternatives. For budget-minded
            users, Vast.ai is often the only viable option for accessing substantial GPU compute.
          </p>
          <p>
            The trade-off is <strong>reliability and consistency</strong>. Vast.ai provides no SLA,
            and the quality of each host varies significantly. Some hosts are professional operators
            with excellent uptime and fast networks; others are individuals running a gaming PC in
            their bedroom. Instances can be discontinued with little notice, and some hosts may
            disappear entirely. This variability makes Vast.ai unsuitable for critical production
            workloads but excellent for experimentation, learning, and fault-tolerant batch jobs.
          </p>
          <p style={{ marginBottom: 0 }}>
            Vast.ai offers the <strong>widest variety of GPUs</strong> among all cloud providers.
            The marketplace includes consumer cards (RTX 4090, RTX 3090, RTX 4080), workstation GPUs
            (RTX 6000 Ada, RTX 5000 Ada), and datacenter hardware (A100, H100). Availability depends
            on what hosts are currently offering, but the diversity of options is unmatched. This
            variety allows users to choose exactly the right GPU for their workload and budget.
          </p>
        </div>
      </section>

      <div className="grid grid2" style={{ marginTop: 18, alignItems: "start" }}>
        <section className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Pros</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Lowest prices:</strong> Typically 70-90% cheaper than traditional cloud
                providers; RTX 3090/4090 available under $0.30/hr
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Wide variety:</strong> Largest GPU selection spanning consumer, workstation,
                and datacenter hardware
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Docker support:</strong> Easy deployment with container images; similar UX
                to other GPU clouds
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Flexible rental periods:</strong> Rent by the hour with no long-term
                commitments
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Global availability:</strong> Hosts worldwide offer various regional options
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Transparent pricing:</strong> See exact specifications and pricing per host
                before booking
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>API access:</strong> Programmatic instance creation and management for
                automated workflows
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>No hidden fees:</strong> Straightforward per-hour pricing without surprise
                egress charges
              </span>
            </div>
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Cons</h2>
          <div className="muted" style={{ lineHeight: 1.8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>No SLA:</strong> No uptime guarantee; instances can be terminated by hosts
                without warning
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Variable reliability:</strong> Host quality ranges from professional to
                problematic; some may be slow or unstable
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Security considerations:</strong> Running code on untrusted machines
                requires caution for sensitive data
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Support limited:</strong> Customer support is minimal compared to enterprise
                clouds
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Configuration variation:</strong> Each host has different CPU, RAM, storage,
                and network quality
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Not production-ready:</strong> Unsuitable for critical workloads requiring
                guaranteed availability
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Potential host disappearance:</strong> Individual hosts may go offline
                permanently without notice
              </span>
            </div>
          </div>
        </section>
      </div>

      {offerings.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Vast.ai GPU Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Current Vast.ai GPU pricing by model. Prices vary by host; shown is the lowest observed
            price per GPU per hour.
          </p>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    GPU
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    From
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((g) => (
                  <tr key={g.gpuSlug}>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      <div style={{ fontWeight: 700 }}>{g.gpuShortName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {g.gpuVramGb}GB
                      </div>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      ${g.minOnDemand.toFixed(2)}/hr
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.06)" }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {g.gpuSlug.includes("rtx") || g.gpuSlug.includes("gtx")
                          ? "Consumer"
                          : "Datacenter"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Cheapest GPU Cloud Option</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            Vast.ai earns its reputation as the <strong>cheapest GPU cloud</strong> through its
            peer-to-peer marketplace model. Individual GPU owners set their own prices, creating
            competitive pressure that drives rates down. This is particularly valuable for users who
            need GPU compute but have limited budgets—students, independent researchers, and hobby
            developers.
          </p>
          <p>
            The price difference compared to traditional clouds is dramatic. An RTX 3090 might cost
            $3-4/hour on AWS (if available at all) but can often be found on Vast.ai for under
            $0.30/hour. Even expensive GPUs like the A100 are typically 60-80% cheaper than
            hyperscaler alternatives. For workloads that don&apos;t require enterprise-grade reliability,
            these savings are impossible to ignore.
          </p>
          <p style={{ marginBottom: 0 }}>
            However, users should understand that <strong>you get what you pay for</strong>. The low
            prices come with real trade-offs in reliability, consistency, and support. Successful
            Vast.ai usage strategies include frequent checkpointing, using multiple hosts for
            redundancy, and designing workloads to be fault-tolerant. For the right use cases, these
            trade-offs are well worth the dramatic cost savings.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Best Use Cases for Vast.ai</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            <strong>Learning and experimentation:</strong> Vast.ai is ideal for students and
            learners who want hands-on GPU experience without high costs. You can experiment with
            different GPU models, test ML frameworks, and learn by doing at minimal expense.
          </p>
          <p>
            <strong>Fine-tuning and small-scale training:</strong> For fine-tuning existing models
            or training smaller models, Vast.ai offers excellent value. Workloads can be designed
            with checkpointing to handle potential interruptions.
          </p>
          <p>
            <strong>Batch inference:</strong> Running large batch inference jobs is particularly
            well-suited to Vast.ai. If a job fails, you can restart it on another host without
            significant loss.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Personal projects and hobbies:</strong> For non-critical personal projects,
            Vast.ai&apos;s low costs enable experimentation that would be prohibitively expensive on
            traditional clouds.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Vast.ai Pricing Dynamics</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            Vast.ai pricing is <strong>dynamic and host-dependent</strong>. Each GPU owner sets
            their own rates based on factors including their electricity costs, hardware quality,
            location, and market demand. This means pricing can vary significantly between hosts
            offering identical GPUs.
          </p>
          <p>
            The marketplace operates similarly to other sharing economy platforms. Hosts compete on
            price, quality, and features like storage, CPU power, and network bandwidth. Savvy users
            compare multiple hosts before booking, looking at ratings, reliability history, and
            performance benchmarks.
          </p>
          <p style={{ marginBottom: 0 }}>
            Pricing also fluctuates based on <strong>supply and demand</strong>. During periods of
            high demand, prices rise and availability decreases. During off-peak hours, prices can
            drop significantly. Some hosts offer discounts for longer rental durations, making it
            worthwhile to plan longer sessions when possible.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>FAQ</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Is Vast.ai really the cheapest GPU cloud option?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Yes, Vast.ai is typically the cheapest GPU cloud option available, often offering
              prices 70-90% lower than traditional cloud providers. RTX 3090 and RTX 4090 GPUs can
              be rented for under $0.30/hour, while even A100 instances are significantly cheaper
              than AWS, Google Cloud, or Azure. The peer-to-peer marketplace model allows individual
              GPU owners to rent out their hardware, creating a competitive market that drives
              prices down.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>
              What are the risks of using Vast.ai compared to AWS or Google Cloud?
            </div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Vast.ai lacks the reliability guarantees of traditional cloud providers. There is no
              SLA, instances can be discontinued by hosts at any time, and the quality of individual
              hosts varies significantly. Some hosts may have poor internet connections, unreliable
              hardware, or disappear without notice. For critical production workloads, Vast.ai is
              generally not recommended. For experimentation, personal projects, and fault-tolerant
              workloads with checkpointing, the cost savings often outweigh these risks.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>What GPU models are available on Vast.ai?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Vast.ai offers the widest variety of GPUs among cloud providers, ranging from consumer
              RTX cards (RTX 4090, RTX 3090, RTX 4080) to workstation GPUs (RTX 6000 Ada) to
              datacenter hardware (A100, H100). The availability varies based on what hosts are
              currently offering. Consumer GPUs are the most abundant and cheapest, making Vast.ai
              particularly attractive for workloads that don&apos;t require datacenter-class hardware.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>How does Vast.ai pricing work?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Vast.ai uses a dynamic pricing model where individual hosts set their own rates.
              Pricing can vary significantly between hosts offering the same GPU model. Hosts may
              charge different rates based on their location, hardware specs, electricity costs, and
              demand. Prices can fluctuate based on market conditions, and some hosts offer
              discounts for longer rentals. The marketplace model means you can often find
              exceptional deals by comparing available options.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>When should I use Vast.ai vs other GPU providers?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Choose Vast.ai for personal projects, learning, experimentation, and any workload
              where cost is the primary concern and reliability is less critical. It&apos;s excellent for
              students, researchers with limited budgets, and hobbyists. For production workloads,
              long-running training jobs without checkpointing, or applications requiring guaranteed
              uptime, traditional cloud providers like AWS, Google Cloud, or specialized GPU clouds
              like CoreWeave and Lambda Labs are better choices despite higher costs.
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Pages</h2>
        <div className="grid grid3" style={{ gap: 12 }}>
          <Link
            href="/compare/vast-ai-vs-runpod"
            className="card"
            style={{ padding: 12, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>Vast.ai vs RunPod</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Compare two GPU marketplace options
            </div>
          </Link>
          <Link
            href="/cloud-gpu/rtx-4090"
            className="card"
            style={{ padding: 12, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>RTX 4090 Pricing</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Compare RTX 4090 pricing across providers
            </div>
          </Link>
          <Link href="/provider" className="card" style={{ padding: 12, textDecoration: "none" }}>
            <div style={{ fontWeight: 700 }}>All Providers</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Browse all GPU cloud providers
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
