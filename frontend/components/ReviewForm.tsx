"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { env } from "@/lib/env";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ReviewForm({ providerSlug }: { providerSlug: string }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const disabled = status.kind === "submitting";
  const canSubmit = useMemo(() => {
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return false;
    if (body.trim().length < 20) return false;
    if (authorEmail && !authorEmail.includes("@")) return false;
    return true;
  }, [rating, body, authorEmail]);

  // Validation errors
  const bodyError = body.trim().length > 0 && body.trim().length < 20;
  const emailError = authorEmail.trim() && !authorEmail.includes("@");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ kind: "submitting" });

    try {
      const res = await fetch(
        `${env.apiBaseUrl}/api/providers/${encodeURIComponent(providerSlug)}/reviews`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            rating,
            title: title.trim() ? title.trim() : undefined,
            body: body.trim(),
            authorName: authorName.trim() ? authorName.trim() : undefined,
            authorEmail: authorEmail.trim() ? authorEmail.trim() : undefined,
          }),
        },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTitle("");
      setBody("");
      setAuthorName("");
      setAuthorEmail("");
      setRating(5);
      setStatus({
        kind: "success",
        message:
          "Thanks — your review was submitted for moderation and should appear once approved.",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to submit review",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 800 }}>Leave a review</div>
      <div className="muted" style={{ marginTop: 6, lineHeight: 1.6, fontSize: 13 }}>
        Reviews are moderated to prevent spam. Please focus on reliability, provisioning UX, pricing
        transparency, and support quality.
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Rating
          </span>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            disabled={disabled}
            className="select"
          >
            {[5, 4, 3, 2, 1].map((v) => (
              <option key={v} value={v}>
                {v} / 5
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Title (optional)
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={disabled}
            maxLength={120}
            placeholder="Short summary"
            className="input"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Review
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={disabled}
            minLength={20}
            maxLength={4000}
            rows={5}
            placeholder="What worked well? What didn't? Any hidden costs or gotchas?"
            aria-invalid={bodyError ? true : undefined}
            aria-describedby={bodyError ? "body-error" : undefined}
            className="textarea"
          />
          <span className="muted" style={{ fontSize: 12 }}>
            {body.trim().length}/4000 characters
          </span>
        </label>

        <div style={{ display: "grid", gap: 10 }} className="grid grid2">
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Name (optional)
            </span>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              disabled={disabled}
              maxLength={120}
              placeholder="Dev Dave"
              autoComplete="name"
              className="input"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Email (optional)
            </span>
            <input
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              disabled={disabled}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
              className="input"
            />
          </label>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}
      >
        <button className="btn" type="submit" disabled={!canSubmit || disabled}>
          {status.kind === "submitting" ? "Submitting…" : "Submit review"}
        </button>
        {status.kind === "success" ? (
          <span role="status" className="muted" style={{ fontSize: 13 }}>
            {status.message}
          </span>
        ) : null}
        {status.kind === "error" ? (
          <span role="alert" className="muted" style={{ fontSize: 13 }}>
            Error: {status.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
