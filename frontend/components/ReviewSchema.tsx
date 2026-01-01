import { JsonLd } from "./JsonLd";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string | null;
  createdAt: string;
}

interface ReviewSchemaProps {
  itemName: string;
  itemType: "Product" | "Organization";
  reviews: Review[];
}

export function ReviewSchema({ itemName, itemType, reviews }: ReviewSchemaProps) {
  if (reviews.length === 0) return null;

  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  const schema = {
    "@context": "https://schema.org",
    "@type": itemType,
    name: itemName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: averageRating.toFixed(1),
      reviewCount: reviews.length,
      bestRating: "5",
      worstRating: "1",
    },
    review: reviews.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: "5",
        worstRating: "1",
      },
      author: {
        "@type": "Person",
        name: r.authorName || "Anonymous",
      },
      reviewBody: r.body,
      headline: r.title || "Review",
      datePublished: new Date(r.createdAt).toISOString(),
    })),
  };

  return <JsonLd data={schema} />;
}
