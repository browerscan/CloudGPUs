import { JsonLd } from "./JsonLd";

const SITE_URL = "https://cloudgpus.io";

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CloudGPUs.io",
  url: SITE_URL,
  description:
    "Compare on-demand and spot GPU pricing across cloud providers. Find the best deals on H100, A100, RTX 4090 and more GPUs for AI training, inference, and rendering.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/cloud-gpu?search={search_term_string}`,
    },
    "query-input": {
      "@type": "PropertyValueSpecification",
      valueRequired: true,
      valueName: "search_term_string",
    },
  },
};

export function WebSiteSchema() {
  return <JsonLd data={webSiteSchema} />;
}
