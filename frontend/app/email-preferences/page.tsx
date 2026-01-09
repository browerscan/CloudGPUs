import type { Metadata } from "next";
import { Suspense } from "react";
import EmailPreferencesClient from "./preferences-client";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

export default function EmailPreferencesPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "40px 20px" }}>
          Loading...
        </div>
      }
    >
      <EmailPreferencesClient />
    </Suspense>
  );
}
