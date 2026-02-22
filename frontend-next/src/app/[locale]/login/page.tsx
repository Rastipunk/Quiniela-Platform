import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import LoginContent from "./LoginContent";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("seo");
  const baseUrl = "https://picks4all.com";
  const localePath = locale === "es" ? "" : `/${locale}`;
  const url = `${baseUrl}${localePath}/login`;

  return {
    title: t("login.title"),
    description: t("login.description"),
    alternates: {
      canonical: url,
      languages: {
        es: `${baseUrl}/login`,
        en: `${baseUrl}/en/login`,
        pt: `${baseUrl}/pt/login`,
        "x-default": `${baseUrl}/login`,
      },
    },
  };
}

export default function LoginPage() {
  return <LoginContent />;
}
