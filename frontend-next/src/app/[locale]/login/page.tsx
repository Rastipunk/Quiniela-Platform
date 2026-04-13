import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /login is deprecated — auth is handled by the AuthSlidePanel on the landing page.
 * Redirect to "/" preserving the ?redirect= param so the landing page can pick it up.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const redirectTo = typeof params.redirect === "string" ? params.redirect : undefined;
  const target = redirectTo ? `/?redirect=${encodeURIComponent(redirectTo)}` : "/";
  redirect(target);
}
