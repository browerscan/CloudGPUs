import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "CoreWeave GPU Cloud Pricing (2025) - Specialized GPU Infrastructure",
    description:
      "Compare CoreWeave GPU pricing across NVIDIA H100, A100, L40S and more. Kubernetes-native cloud optimized for AI/ML workloads with competitive on-demand and spot rates.",
    alternates: { canonical: "/provider/coreweave" },
    openGraph: {
      title: "CoreWeave GPU Cloud Pricing (2025) - Specialized GPU Infrastructure",
      description:
        "Compare CoreWeave GPU pricing. Kubernetes-native cloud optimized for AI/ML workloads.",
      url: "/provider/coreweave",
    },
  };
}

export default async function CoreWeavePage() {
  // Fetch CoreWeave instances
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
    }>;
  }>(
    `/api/instances?limit=200&depth=1&where[provider_slug][equals]=coreweave&where[is_active][equals]=true&sort=price_per_gpu_hour`,
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
        name: "CoreWeave",
        item: "https://cloudgpus.io/provider/coreweave",
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does CoreWeave pricing compare to AWS and other hyperscalers?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CoreWeave typically offers 50-80% lower GPU pricing compared to AWS, Google Cloud, and Azure for equivalent GPU instances. Their specialized infrastructure focuses exclusively on GPU workloads, avoiding the general-purpose cloud premium. For example, H100 SXM instances on CoreWeave often cost significantly less per hour than comparable AWS p5 instances while offering similar or better performance.",
        },
      },
      {
        "@type": "Question",
        name: "What makes CoreWeave different from other GPU cloud providers?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CoreWeave is built on Kubernetes from the ground up, making it exceptionally well-suited for containerized AI/ML workloads. Unlike traditional clouds that added GPU support as an afterthought, CoreWeave's entire infrastructure is designed around GPU acceleration. This includes optimized networking, storage integrations with WekaFS and Luster, and a simplified pricing model without hidden egress or data transfer fees.",
        },
      },
      {
        "@type": "Question",
        name: "Is CoreWeave better for training or inference workloads?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CoreWeave excels at both training and inference, with particular strength in inference scenarios. Their infrastructure supports high-throughput, low-latency inference serving with autoscaling capabilities. For training, their H100 and A100 offerings with NVLink provide excellent multi-GPU performance. Many users report better price-performance for inference compared to hyperscaler alternatives.",
        },
      },
      {
        "@type": "Question",
        name: "What GPU models are available on CoreWeave?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CoreWeave focuses on NVIDIA datacenter GPUs, primarily H100 SXM, H200, A100 80GB, A100 40GB, and L40S. They also offer RTX 6000 Ada and RTX 5000 Ada for workloads that don't require datacenter-class hardware. Their inventory is heavily weighted toward Ampere and Hopper architectures, with strong availability of H100 SXM5 configurations for large-scale training.",
        },
      },
      {
        "@type": "Question",
        name: "Does CoreWeave offer spot or preemptible instances?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, CoreWeave offers spot instances at significant discounts compared to on-demand pricing. Spot instances can be preempted with short notice, making them suitable for fault-tolerant workloads like batch inference, distributed training with checkpointing, and experimental work. The exact discount varies by GPU type and current demand, but savings of 50-70% compared to on-demand rates are common.",
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
        <span style={{ opacity: 0.5 }}>/</span> <span>CoreWeave</span>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h1 style={{ marginTop: 0 }}>
          CoreWeave GPU Cloud Pricing (2025) - Specialized GPU Infrastructure
        </h1>
        <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>
          Compare CoreWeave GPU pricing across NVIDIA H100, A100, L40S and more. CoreWeave is a
          Kubernetes-native specialized cloud built exclusively for GPU workloads, offering
          competitive pricing compared to hyperscalers like AWS, Google Cloud, and Azure.
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
              Architecture
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Kubernetes-native</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              GPU focus
            </div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>NVIDIA only</div>
          </div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>About CoreWeave</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            <strong>CoreWeave</strong> is a specialized GPU cloud provider founded in 2017,
            initially as a cryptocurrency mining operation before pivoting to become one of the
            leading alternative cloud providers for AI and machine learning workloads. Unlike
            hyperscalers that added GPU support to existing general-purpose infrastructure,
            CoreWeave built its entire platform around GPU acceleration from day one.
          </p>
          <p>
            The company&apos;s infrastructure is <strong>Kubernetes-native</strong>, meaning every aspect
            of their platform is designed for containerized workloads. This architecture provides
            several advantages: simplified deployment, auto-scaling capabilities, and deep
            integration with the modern AI/ML software stack. CoreWeave has positioned itself as a
            cost-effective alternative to AWS, Google Cloud, and Azure, often advertising{" "}
            <strong>50-80% lower pricing</strong> for equivalent GPU instances.
          </p>
          <p>
            CoreWeave specializes in <strong>NVIDIA datacenter GPUs</strong>, particularly the H100,
            H200, A100, and L40S. Their focus on a narrower hardware range compared to generalist
            clouds allows them to optimize their infrastructure specifically for these GPUs. This
            includes high-speed networking with InfiniBand, optimized storage solutions (WekaFS,
            Luster), and purpose-built cooling systems.
          </p>
          <p style={{ marginBottom: 0 }}>
            The company has received significant venture funding and counts NVIDIA as both an
            investor and strategic partner. This relationship gives CoreWeave early access to new
            GPU architectures and helps ensure their infrastructure is optimized for the latest
            NVIDIA hardware. CoreWeave is particularly well-regarded for{" "}
            <strong>inference workloads</strong>, where their optimized infrastructure can deliver
            better price-performance than hyperscaler alternatives.
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
                <strong>Kubernetes-native platform:</strong> Built from the ground up for
                containerized workloads with native Kubernetes support
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Competitive pricing:</strong> Typically 50-80% cheaper than AWS, GCP, or
                Azure for equivalent GPU instances
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Excellent for inference:</strong> Optimized infrastructure delivers strong
                price-performance for serving AI models
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>No hidden fees:</strong> Simplified pricing without surprise egress or data
                transfer charges
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Enterprise features:</strong> Includes SLA, dedicated support, and
                compliance certifications for production workloads
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Spot instances:</strong> Significant discounts available for fault-tolerant
                workloads
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#22c55e" }}>+</span>
              <span>
                <strong>Fast storage:</strong> WekaFS and Luster integrations for high-throughput
                data access
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
                <strong>Limited GPU variety:</strong> Focuses exclusively on NVIDIA datacenter GPUs
                (H100, A100, L40S) with no AMD or consumer options
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Kubernetes required:</strong> Platform assumes Kubernetes proficiency;
                traditional VM workflows may need adaptation
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Learning curve:</strong> Different from hyperscaler UX; teams need time to
                adapt to CoreWeave&apos;s interface and conventions
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Fewer regions:</strong> More limited geographic coverage compared to AWS or
                Google Cloud
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>-</span>
              <span>
                <strong>Smaller ecosystem:</strong> Fewer third-party integrations and managed
                services than hyperscalers
              </span>
            </div>
          </div>
        </section>
      </div>

      {offerings.length > 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>CoreWeave GPU Pricing</h2>
          <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
            Current CoreWeave GPU pricing for on-demand and spot instances. Prices are shown per GPU
            per hour.
          </p>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    GPU
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    On-Demand
                  </th>
                  <th style={{ padding: 12, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                    Spot
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
                      {g.minSpot !== null ? `$${g.minSpot.toFixed(2)}/hr` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>CoreWeave vs AWS</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            When comparing <strong>CoreWeave vs AWS</strong>, the primary consideration is cost
            efficiency. CoreWeave&apos;s specialized infrastructure allows them to offer significantly
            lower GPU pricing than AWS EC2 P5 and P4 instances. For example, H100 SXM instances on
            CoreWeave are typically much cheaper per hour than AWS p5.48xlarge instances.
          </p>
          <p>
            However, AWS provides a broader ecosystem including Sagemaker, managed services, and
            global region coverage. Teams already deeply integrated into AWS may find the migration
            effort outweighs the cost savings. CoreWeave makes more sense for organizations that
            prioritize GPU cost efficiency and are comfortable managing Kubernetes infrastructure.
          </p>
          <p style={{ marginBottom: 0 }}>
            For <strong>AI/ML workloads specifically</strong>, CoreWeave&apos;s focused platform often
            delivers better price-performance. Their inference-optimized infrastructure can serve
            models at lower cost per request than AWS SageMaker endpoints. Training workloads also
            benefit from CoreWeave&apos;s simplified networking and storage integrations.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Best Use Cases for CoreWeave</h2>
        <div className="muted" style={{ lineHeight: 1.8 }}>
          <p style={{ marginTop: 0 }}>
            <strong>LLM inference:</strong> CoreWeave&apos;s optimized infrastructure is particularly
            well-suited for serving large language models. Their autoscaling capabilities and fast
            storage integration enable efficient inference serving.
          </p>
          <p>
            <strong>Multi-GPU training:</strong> H100 and A100 instances with InfiniBand support
            make CoreWeave a strong choice for distributed training workloads. The Kubernetes-native
            platform integrates well with modern training frameworks.
          </p>
          <p>
            <strong>Batch processing:</strong> Spot instances provide excellent value for
            fault-tolerant batch workloads like data preprocessing, embedding generation, or bulk
            inference jobs.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Container-native teams:</strong> Organizations already using Kubernetes will
            find CoreWeave&apos;s platform intuitive and well-aligned with their existing workflows.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>FAQ</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>
              How does CoreWeave pricing compare to AWS and other hyperscalers?
            </div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              CoreWeave typically offers 50-80% lower GPU pricing compared to AWS, Google Cloud, and
              Azure for equivalent GPU instances. Their specialized infrastructure focuses
              exclusively on GPU workloads, avoiding the general-purpose cloud premium. For example,
              H100 SXM instances on CoreWeave often cost significantly less per hour than comparable
              AWS p5 instances while offering similar or better performance.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>
              What makes CoreWeave different from other GPU cloud providers?
            </div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              CoreWeave is built on Kubernetes from the ground up, making it exceptionally
              well-suited for containerized AI/ML workloads. Unlike traditional clouds that added
              GPU support as an afterthought, CoreWeave&apos;s entire infrastructure is designed around
              GPU acceleration. This includes optimized networking, storage integrations with WekaFS
              and Luster, and a simplified pricing model without hidden egress or data transfer
              fees.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>
              Is CoreWeave better for training or inference workloads?
            </div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              CoreWeave excels at both training and inference, with particular strength in inference
              scenarios. Their infrastructure supports high-throughput, low-latency inference
              serving with autoscaling capabilities. For training, their H100 and A100 offerings
              with NVLink provide excellent multi-GPU performance. Many users report better
              price-performance for inference compared to hyperscaler alternatives.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>What GPU models are available on CoreWeave?</div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              CoreWeave focuses on NVIDIA datacenter GPUs, primarily H100 SXM, H200, A100 80GB, A100
              40GB, and L40S. They also offer RTX 6000 Ada and RTX 5000 Ada for workloads that don&apos;t
              require datacenter-class hardware. Their inventory is heavily weighted toward Ampere
              and Hopper architectures, with strong availability of H100 SXM5 configurations for
              large-scale training.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>
              Does CoreWeave offer spot or preemptible instances?
            </div>
            <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
              Yes, CoreWeave offers spot instances at significant discounts compared to on-demand
              pricing. Spot instances can be preempted with short notice, making them suitable for
              fault-tolerant workloads like batch inference, distributed training with
              checkpointing, and experimental work. The exact discount varies by GPU type and
              current demand, but savings of 50-70% compared to on-demand rates are common.
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Related Pages</h2>
        <div className="grid grid3" style={{ gap: 12 }}>
          <Link
            href="/compare/coreweave-vs-runpod"
            className="card"
            style={{ padding: 12, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>CoreWeave vs RunPod</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Compare specialized cloud vs marketplace options
            </div>
          </Link>
          <Link
            href="/cloud-gpu/h100-sxm"
            className="card"
            style={{ padding: 12, textDecoration: "none" }}
          >
            <div style={{ fontWeight: 700 }}>H100 SXM Pricing</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Compare H100 pricing across providers
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
