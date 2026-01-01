import { JsonLd } from "./JsonLd";

interface ListItemSchemaProps {
  itemListName: string;
  items: Array<{
    name: string;
    url: string;
    position?: number;
    price?: string;
    rating?: number;
  }>;
}

export function ListItemSchema({ itemListName, items }: ListItemSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: itemListName,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: item.position ?? index + 1,
      item: {
        "@type": "Product",
        name: item.name,
        url: `https://cloudgpus.io${item.url}`,
        ...(item.price && {
          offers: {
            "@type": "Offer",
            price: item.price,
            priceCurrency: "USD",
          },
        }),
        ...(item.rating && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: item.rating,
            bestRating: "5",
            worstRating: "1",
          },
        }),
      },
    })),
  };

  return <JsonLd data={schema} />;
}
