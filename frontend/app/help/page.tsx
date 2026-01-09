import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help center",
};

export default function HelpPage() {
  return (
    <div className="container" style={{ padding: "40px 20px", maxWidth: 820 }}>
      <div className="card" style={{ padding: 32 }}>
        <h1 style={{ marginBottom: 12 }}>Help Center</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Need help with verification, password reset, or managing your account? Start here.
        </p>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Account issues</h2>
          <ul style={{ paddingLeft: 18, margin: 0, color: "var(--muted, #666)" }}>
            <li>Verification links expire after 24 hours.</li>
            <li>Password reset links expire after 1 hour.</li>
            <li>If a link expired, request a new one from the sign-in dialog.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Email preferences</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            Update product updates or marketing preferences in your email preferences center.
          </p>
          <Link className="btn btnSecondary" href="/email-preferences">
            Email preferences
          </Link>
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Contact</h2>
          <p className="muted">
            For additional help, reply to the latest email or contact
            <a
              href="mailto:support@cloudgpus.io"
              style={{ marginLeft: 6, color: "var(--link, #0066cc)" }}
            >
              support@cloudgpus.io
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
