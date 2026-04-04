import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import VerifyEmailContent from "./VerifyEmailContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");

  return {
    title: t("verifyEmail.title"),
    description: t("verifyEmail.description"),
    robots: { index: false, follow: false },
  };
}

export default function VerifyEmailPage() {
  return <VerifyEmailContent />;
}
