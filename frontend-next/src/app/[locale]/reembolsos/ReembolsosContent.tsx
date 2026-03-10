"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PublicPageWrapper } from "@/components/PublicPageWrapper";
import { parseMarkdown } from "@/lib/parseMarkdown";

export function ReembolsosContent() {
  const t = useTranslations("legal");
  const content = t("refundsContent");

  return (
    <PublicPageWrapper>
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "40px 24px",
          minHeight: "60vh",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 24,
            color: "var(--muted)",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          {"<-"} {t("backToHome")}
        </Link>

        <article
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            padding: 32,
            border: "1px solid var(--border)",
            lineHeight: 1.7,
          }}
        >
          <div
            dangerouslySetInnerHTML={{
              __html: parseMarkdown(content),
            }}
            style={{ color: "var(--text)" }}
          />
        </article>

        <style>{`
          article h1 {
            font-size: 1.75rem;
            margin: 0 0 8px 0;
            color: var(--text);
          }
          article h2 {
            font-size: 1.25rem;
            margin: 32px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border);
            color: var(--text);
          }
          article h3 {
            font-size: 1.1rem;
            margin: 24px 0 8px 0;
            color: var(--text);
          }
          article p {
            margin: 0 0 16px 0;
            color: var(--text);
          }
          article ul, article ol {
            margin: 0 0 16px 0;
            padding-left: 24px;
          }
          article li {
            margin-bottom: 8px;
            color: var(--text);
          }
          article strong {
            font-weight: 600;
          }
          article hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 24px 0;
          }
          article a {
            color: #2563eb;
          }
          article table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 14px;
          }
          article th, article td {
            border: 1px solid var(--border);
            padding: 10px 12px;
            text-align: left;
          }
          article th {
            background: var(--surface-2);
            font-weight: 600;
          }
        `}</style>
      </div>
    </PublicPageWrapper>
  );
}
