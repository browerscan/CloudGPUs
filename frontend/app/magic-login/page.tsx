import type { Metadata } from "next";
import { Suspense } from "react";
import MagicLoginClient from "./magic-login-client";

export const metadata: Metadata = {
  title: "Magic login",
  robots: { index: false, follow: false },
};

export default function MagicLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "40px 20px" }}>
          Loading...
        </div>
      }
    >
      <MagicLoginClient />
    </Suspense>
  );
}
