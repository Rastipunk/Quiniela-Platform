import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PoolCreationWizard from "@/components/pool-wizard/PoolCreationWizard";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "enterprise.create" });
  return {
    title: t("meta.title"),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        es: "/empresas/crear",
        en: "/en/for-companies/create",
        pt: "/pt/para-empresas/criar",
      },
    },
  };
}

export default function CorporateCreatePage() {
  return <PoolCreationWizard mode="corporate" />;
}
