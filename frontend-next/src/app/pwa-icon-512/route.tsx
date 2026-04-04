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
          borderRadius: 96,
          color: "white",
          fontSize: 320,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        P
      </div>
    ),
    { width: 512, height: 512 }
  );
}
