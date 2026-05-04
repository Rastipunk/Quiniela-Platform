import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Payment return pages (/pago/checkout, /pago/exitoso, /pago/cancelado)
// receive query parameters from Polar / Mercado Pago and read them with
// useSearchParams() in client components. They aren't SEO targets — they
// carry noindex,nofollow above. Marking them dynamic prevents the
// statically-renderable [locale] layout from trying to prerender them
// (which surfaced "useSearchParams should be wrapped in suspense" errors
// once the layout above stopped depending on cookies()).
export const dynamic = "force-dynamic";

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
