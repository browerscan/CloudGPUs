import { ImageResponse } from "next/og";

export const runtime = "edge";

const SITE_NAME = "CloudGPUs.io";
const TAGLINE = "Compare GPU Cloud Prices";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        backgroundImage: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        fontSize: 60,
        fontWeight: 700,
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px",
        }}
      >
        <div
          style={{
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: "20px",
            background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: 400,
            color: "#cbd5e1",
            marginBottom: "40px",
          }}
        >
          {TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            gap: "20px",
            fontSize: "24px",
            color: "#94a3b8",
          }}
        >
          <span>H100</span>
          <span>A100</span>
          <span>RTX 4090</span>
          <span>L40S</span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
