import type { Metadata } from "next";
import AdminFeedbackContent from "@/components/AdminFeedbackContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminFeedbackPage() {
  return <AdminFeedbackContent />;
}
