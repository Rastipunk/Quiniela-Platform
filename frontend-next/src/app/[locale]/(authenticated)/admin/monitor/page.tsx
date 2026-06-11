import type { Metadata } from "next";
import MatchMonitorContent from "@/components/MatchMonitorContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Monitor de Partidos — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function MatchMonitorPage() {
  return <MatchMonitorContent />;
}
