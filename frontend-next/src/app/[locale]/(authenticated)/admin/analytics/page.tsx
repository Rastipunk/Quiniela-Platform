import type { Metadata } from "next";
import AdminAnalyticsContent from "@/components/AdminAnalyticsContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Analítica — Picks4All Admin",
    robots: { index: false, follow: false },
  };
}

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsContent />;
}
