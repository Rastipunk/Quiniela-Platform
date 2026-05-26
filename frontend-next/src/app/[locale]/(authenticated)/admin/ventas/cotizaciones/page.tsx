import type { Metadata } from "next";
import AdminQuotesListContent from "@/components/AdminQuotesListContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cotizaciones — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminQuotesPage() {
  return <AdminQuotesListContent />;
}
