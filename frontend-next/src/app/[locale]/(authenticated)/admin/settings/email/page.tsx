import type { Metadata } from "next";
import AdminEmailSettingsContent from "@/components/AdminEmailSettingsContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminEmailSettingsPage() {
  return <AdminEmailSettingsContent />;
}
