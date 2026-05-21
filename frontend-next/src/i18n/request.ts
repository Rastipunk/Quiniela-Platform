import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Load and merge all message files
  const [
    common, auth, dashboard, profile, pool, legal,
    penca, polla, prode, porra, footballPool, seo, pricing, pricingPage,
    poolWizard, worldCup, share, cookieConsent, payment, howToPlay, teams, tournaments,
  ] = await Promise.all([
    import(`../messages/${locale}/common.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/auth.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/dashboard.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/profile.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/pool.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/legal.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/penca.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/polla.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/prode.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/porra.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/footballPool.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/seo.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/pricing.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/pricingPage.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/poolWizard.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/worldCup.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/share.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/cookieConsent.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/payment.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/howToPlay.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/teams.json`).then((m) => m.default).catch(() => ({})),
    import(`../messages/${locale}/tournaments.json`).then((m) => m.default).catch(() => ({})),
  ]);

  return {
    locale,
    messages: {
      ...common,
      auth, dashboard, profile, pool, legal,
      penca, polla, prode, porra, footballPool, seo, pricing, pricingPage,
      poolWizard, worldCup, share, cookieConsent, payment, howToPlay, teams, tournaments,
    },
  };
});
