import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ResetPasswordContent from "./ResetPasswordContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");

  return {
    title: t("resetPassword.title"),
    description: t("resetPassword.description"),
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordPage() {
  return <ResetPasswordContent />;
}
