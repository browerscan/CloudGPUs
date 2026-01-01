import { JsonLd } from "./JsonLd";

const SITE_URL = "https://cloudgpus.io";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CloudGPUs.io",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "Compare on-demand and spot GPU pricing across cloud providers. Find the best deals on H100, A100, RTX 4090 and more GPUs for AI training, inference, and rendering.",
  sameAs: [
    "https://twitter.com/cloudgpus",
    "https://github.com/cloudgpus",
    "https://www.linkedin.com/company/cloudgpus",
  ] as string[],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    url: SITE_URL,
  },
};

export function OrganizationSchema() {
  return <JsonLd data={organizationSchema} />;
}
