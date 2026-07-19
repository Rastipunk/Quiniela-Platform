import type { Metadata } from "next";
import AdminSurveyContent from "@/components/AdminSurveyContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminSurveyPage() {
  return <AdminSurveyContent />;
}
