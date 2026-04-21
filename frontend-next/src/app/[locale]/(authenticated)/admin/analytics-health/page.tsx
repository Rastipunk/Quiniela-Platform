import type { Metadata } from "next";
import AnalyticsHealthContent from "@/components/AnalyticsHealthContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Analytics Health — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AnalyticsHealthPage() {
  return <AnalyticsHealthContent />;
}
