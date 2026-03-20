import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import PoolCreationWizard from "@/components/pool-wizard/PoolCreationWizard";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "poolWizard" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
    robots: { index: false, follow: false },
  };
}

export default function CrearPoolPage() {
  return <PoolCreationWizard />;
}
