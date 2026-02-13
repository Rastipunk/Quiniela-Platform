import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: 6,
          color: "white",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        P
      </div>
    ),
    { ...size }
  );
}
