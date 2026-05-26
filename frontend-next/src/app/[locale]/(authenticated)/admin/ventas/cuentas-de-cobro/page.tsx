import type { Metadata } from "next";
import AdminCcsListContent from "@/components/AdminCcsListContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cuentas de cobro — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminCcsPage() {
  return <AdminCcsListContent />;
}
