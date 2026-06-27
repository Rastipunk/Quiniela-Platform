import type { Metadata } from "next";
import PhaseReleaseContent from "@/components/PhaseReleaseContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Desbloqueo de fases — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function PhaseReleasePage() {
  return <PhaseReleaseContent />;
}
