import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { OrganizationSchema } from "@/components/OrganizationSchema";
import { WebSiteSchema } from "@/components/WebSiteSchema";

const SITE_URL = "https://cloudgpus.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CloudGPUs.io — Compare GPU Cloud Prices",
    template: "%s | CloudGPUs.io",
  },
  description:
    "Compare on-demand and spot GPU pricing across cloud providers. Find the best deals on H100, A100, RTX 4090 and more GPUs for AI training, inference, and rendering.",
  authors: [{ name: "CloudGPUs.io", url: SITE_URL }],
  creator: "CloudGPUs.io",
  publisher: "CloudGPUs.io",
  alternates: { canonical: "/" },
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  openGraph: {
    type: "website",
    title: "CloudGPUs.io — Compare GPU Cloud Prices",
    description:
      "Compare on-demand and spot GPU pricing across cloud providers. Find the best deals on H100, A100, RTX 4090 and more GPUs for AI training, inference, and rendering.",
    url: SITE_URL,
    siteName: "CloudGPUs.io",
    images: [
      {
        url: "/og-image.png",
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
      "Compare on-demand and spot GPU pricing across cloud providers. Find the best deals on H100, A100, RTX 4090 and more GPUs.",
    images: ["/og-image.png"],
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <OrganizationSchema />
        <WebSiteSchema />
        {/* Resource hints for external domains */}
        <link rel="preconnect" href="https://api.cloudgpus.io" />
        <link rel="dns-prefetch" href="https://api.cloudgpus.io" />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer
          className="container muted"
          style={{ paddingTop: 32, paddingBottom: 48, fontSize: 13 }}
        >
          <div>© {new Date().getFullYear()} CloudGPUs.io</div>
          <div style={{ marginTop: 8 }}>
            Data is provided "as-is". Prices can change frequently; always verify on the provider
            site.
          </div>
        </footer>
      </body>
    </html>
  );
}
