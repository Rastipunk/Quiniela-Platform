import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.gradient,
          borderRadius: 36,
          color: "white",
          fontSize: 120,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        P
      </div>
    ),
    { width: 192, height: 192 }
  );
}
