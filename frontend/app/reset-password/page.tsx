import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordClient from "./reset-password-client";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "40px 20px" }}>
          Loading...
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
