import type { Metadata } from "next";
import { Suspense } from "react";
import AdminCcCreateContent from "@/components/AdminCcCreateContent";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Nueva cuenta de cobro — Picks4All",
    robots: { index: false, follow: false },
  };
}

export default function AdminCcCreatePage() {
  // AdminCcCreateContent reads `?fromQuoteId=` via useSearchParams,
  // which needs to be wrapped in <Suspense> per Next 16 rules so the
  // build doesn't fail with "useSearchParams must be wrapped".
  return (
    <Suspense>
      <AdminCcCreateContent />
    </Suspense>
  );
}
