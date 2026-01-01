import { JsonLd } from "./JsonLd";

interface HowToStep {
  name: string;
  text: string;
}

interface HowToSchemaProps {
  name: string;
  description: string;
  steps: HowToStep[];
  estimatedCost?: string;
  tool?: string[];
}

export function HowToSchema({ name, description, steps, estimatedCost, tool }: HowToSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
    ...(estimatedCost && {
      estimatedCost: {
        "@type": "MonetaryAmount",
        currency: "USD",
        text: estimatedCost,
      },
    }),
    ...(tool && {
      tool: tool.map((t) => ({
        "@type": "HowToTool",
        name: t,
      })),
    }),
  };

  return <JsonLd data={schema} />;
}
