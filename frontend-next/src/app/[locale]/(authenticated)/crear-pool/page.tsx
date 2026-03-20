import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PoolCreationWizard = dynamic(
  () => import("@/components/pool-wizard/PoolCreationWizard"),
  { ssr: false }
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "poolWizard" });
  return {
    title: t("meta.title", { defaultMessage: "Crear Pool" }),
    description: t("meta.description", {
      defaultMessage: "Crea tu pool de quiniela paso a paso.",
    }),
    robots: { index: false, follow: false },
  };
}

export default function CrearPoolPage() {
  return <PoolCreationWizard />;
}
