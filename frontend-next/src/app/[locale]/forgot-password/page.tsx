import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ForgotPasswordContent from "./ForgotPasswordContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");

  return {
    title: t("forgotPassword.title"),
    robots: { index: false, follow: false },
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordContent />;
}
