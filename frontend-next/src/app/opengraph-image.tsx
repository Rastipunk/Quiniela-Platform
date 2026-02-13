import { ImageResponse } from "next/og";

export const alt = "Picks4All — Quinielas Deportivas Gratis con Amigos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
              color: "#764ba2",
              marginRight: 20,
            }}
          >
            P
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-2px",
            }}
          >
            Picks4All
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
