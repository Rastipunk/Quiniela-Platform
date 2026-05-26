import type { Metadata } from "next";
import AdminCcDetailContent from "@/components/AdminCcDetailContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cuenta de cobro — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default async function AdminCcDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminCcDetailContent ccId={id} />;
}
