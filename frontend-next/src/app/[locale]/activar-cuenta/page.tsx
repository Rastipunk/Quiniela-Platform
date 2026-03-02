import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { ActivationContent } from "@/components/ActivationContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("activation.meta");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default function ActivationPage() {
  return (
    <PublicPageWrapper>
      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <ActivationContent />
      </Suspense>
    </PublicPageWrapper>
  );
}
