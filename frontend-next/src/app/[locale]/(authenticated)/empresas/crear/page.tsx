import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { CorporatePoolCreation } from "@/components/CorporatePoolCreation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "enterprise.create" });
  return {
    title: t("meta.title"),
    robots: { index: false, follow: false },
  };
}

export default function CorporateCreatePage() {
  return <CorporatePoolCreation />;
}
