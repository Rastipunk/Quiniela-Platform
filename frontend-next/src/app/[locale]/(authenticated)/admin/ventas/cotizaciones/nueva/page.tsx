import type { Metadata } from "next";
import AdminQuoteCreateContent from "@/components/AdminQuoteCreateContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Nueva cotización — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminQuoteCreatePage() {
  return <AdminQuoteCreateContent />;
}
