import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Header } from "@/components/Header";
import { OrganizationSchema } from "@/components/OrganizationSchema";
import { WebSiteSchema } from "@/components/WebSiteSchema";
import { CookieConsent } from "@/components/CookieConsent";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      const theme = localStorage.getItem('theme') || 'system';
      const isDark = theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://cloudgpus.io";
const GOOGLE_VERIFICATION = process.env["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CloudGPUs.io — Compare GPU Cloud Prices for AI Training & Inference",
    template: "%s | CloudGPUs.io",
  },
  description:
    "Compare real-time cloud GPU pricing across 20+ providers. Find the best on-demand and spot rates for NVIDIA H100, A100, RTX 4090, and more. Save 40-60% on AI training and inference compute.",
  keywords: [
    "cloud GPU pricing",
    "GPU cloud comparison",
    "H100 cloud pricing",
    "A100 rental",
    "RTX 4090 cloud",
    "AI training GPU",
    "LLM training cost",
    "GPU-as-a-Service",
    "cloud compute pricing",
    "AI inference GPU",
    "Lambda Labs pricing",
    "RunPod pricing",
    "Vast.ai GPU",
    "CoreWeave GPU",
  ],
  authors: [{ name: "CloudGPUs.io", url: SITE_URL }],
  creator: "CloudGPUs.io",
  publisher: "CloudGPUs.io",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "CloudGPUs.io — Compare GPU Cloud Prices for AI Training & Inference",
    description:
      "Compare real-time cloud GPU pricing across 20+ providers. Find the best on-demand and spot rates for NVIDIA H100, A100, RTX 4090, and more. Save 40-60% on AI training and inference compute.",
    url: SITE_URL,
    siteName: "CloudGPUs.io",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "CloudGPUs.io - Compare GPU Cloud Prices",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CloudGPUs.io — Compare GPU Cloud Prices",
    description:
      "Compare real-time cloud GPU pricing across 20+ providers. Find the best deals on H100, A100, RTX 4090 and more GPUs for AI training and inference.",
    images: ["/opengraph-image"],
    creator: "@cloudgpusio",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <OrganizationSchema />
        <WebSiteSchema />
        {/* Resource hints for external domains */}
        <link rel="preconnect" href="https://api.cloudgpus.io" />
        <link rel="dns-prefetch" href="https://api.cloudgpus.io" />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 32,
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>GPUs</div>
              <div className="muted" style={{ lineHeight: 1.8, fontSize: 13 }}>
                <div>
                  <Link href="/cloud-gpu/nvidia-h100">H100 Pricing</Link>
                </div>
                <div>
                  <Link href="/cloud-gpu/nvidia-a100-80gb">A100 80GB Pricing</Link>
                </div>
                <div>
                  <Link href="/cloud-gpu/nvidia-rtx-4090">RTX 4090 Pricing</Link>
                </div>
                <div>
                  <Link href="/cloud-gpu/nvidia-l40s">L40S Pricing</Link>
                </div>
                <div>
                  <Link href="/cloud-gpu">All GPUs</Link>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Use Cases</div>
              <div className="muted" style={{ lineHeight: 1.8, fontSize: 13 }}>
                <div>
                  <Link href="/best-gpu-for/llm-training">LLM Training</Link>
                </div>
                <div>
                  <Link href="/best-gpu-for/llm-inference">LLM Inference</Link>
                </div>
                <div>
                  <Link href="/best-gpu-for/stable-diffusion">Stable Diffusion</Link>
                </div>
                <div>
                  <Link href="/best-gpu-for/fine-tuning">Fine-Tuning</Link>
                </div>
                <div>
                  <Link href="/best-gpu-for">All Use Cases</Link>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Tools</div>
              <div className="muted" style={{ lineHeight: 1.8, fontSize: 13 }}>
                <div>
                  <Link href="/calculator/cost-estimator">Cost Estimator</Link>
                </div>
                <div>
                  <Link href="/calculator/gpu-selector">GPU Selector</Link>
                </div>
                <div>
                  <Link href="/calculator/roi-calculator">ROI Calculator</Link>
                </div>
                <div>
                  <Link href="/compare">Compare Providers</Link>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Contact</div>
              <div className="muted" style={{ lineHeight: 1.8, fontSize: 13 }}>
                <div>
                  <a href="mailto:hello@cloudgpus.io">hello@cloudgpus.io</a>
                </div>
                <div style={{ marginTop: 8 }}>
                  Questions about GPU pricing? Feature requests? We would love to hear from you.
                </div>
              </div>
            </div>
          </div>
          <div
            className="muted"
            style={{
              borderTop: "1px solid rgba(15, 23, 42, 0.08)",
              paddingTop: 24,
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div>© {new Date().getFullYear()} CloudGPUs.io. All rights reserved.</div>
              <div style={{ marginTop: 4 }}>
                Data is provided as-is. Prices can change frequently; always verify on the provider
                site.
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/cloud-gpu">GPUs</Link>
              <Link href="/provider">Providers</Link>
              <Link href="/compare">Compare</Link>
              <Link href="/region">Regions</Link>
            </div>
          </div>
        </footer>
        <CookieConsent />
      </body>
    </html>
  );
}
