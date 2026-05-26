import type { Metadata } from "next";
import AdminQuoteDetailContent from "@/components/AdminQuoteDetailContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cotización — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminQuoteDetailContent quoteId={id} />;
}
