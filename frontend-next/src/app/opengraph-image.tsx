import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { readFileSync } from "fs";
import { join } from "path";

export const alt = `${BRAND.name} — Quinielas Deportivas Gratis con Amigos`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  // Load the official isotipo as base64 — uses the new brand asset
  const isotipoPath = join(process.cwd(), "public", "brand", "isotipo-degradado-500.png");
  const isotipoBase64 = `data:image/png;base64,${readFileSync(isotipoPath).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.gradient,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Logo + Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isotipoBase64}
            alt="Picks4All"
            width={120}
            height={120}
            style={{ marginRight: 24, borderRadius: 24 }}
          />
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-2px",
            }}
          >
            {BRAND.name}
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            marginBottom: 20,
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          Quinielas Deportivas Gratis con Amigos
        </div>

        {/* Regional names */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span>Quiniela</span>
          <span style={{ margin: "0 16px" }}>·</span>
          <span>Polla</span>
          <span style={{ margin: "0 16px" }}>·</span>
          <span>Prode</span>
          <span style={{ margin: "0 16px" }}>·</span>
          <span>Penca</span>
          <span style={{ margin: "0 16px" }}>·</span>
          <span>Porra</span>
        </div>

        {/* Bottom badge */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            fontSize: 20,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          100% Gratis · Sin Apuestas · Puro Entretenimiento
        </div>
      </div>
    ),
    { ...size }
  );
}
