import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Load and merge all message files
  const [common, auth, dashboard, profile, pool, legal, penca, seo] =
    await Promise.all([
      import(`../messages/${locale}/common.json`).then((m) => m.default),
      import(`../messages/${locale}/auth.json`).then((m) => m.default),
      import(`../messages/${locale}/dashboard.json`).then((m) => m.default),
      import(`../messages/${locale}/profile.json`).then((m) => m.default),
      import(`../messages/${locale}/pool.json`).then((m) => m.default),
      import(`../messages/${locale}/legal.json`).then((m) => m.default),
      import(`../messages/${locale}/penca.json`).then((m) => m.default),
      import(`../messages/${locale}/seo.json`).then((m) => m.default),
    ]);

  return {
    locale,
    messages: { ...common, auth, dashboard, profile, pool, legal, penca, seo },
  };
});
