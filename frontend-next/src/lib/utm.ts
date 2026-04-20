/**
 * UTM parameter utility for outbound link tracking.
 *
 * Appends Google Analytics / Meta UTM parameters to URLs so traffic
 * sources can be attributed in analytics dashboards.
 */

interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export function appendUtm(url: string, params: UtmParams): string {
  const sep = url.includes("?") ? "&" : "?";
  const parts = [
    `utm_source=${encodeURIComponent(params.source)}`,
    `utm_medium=${encodeURIComponent(params.medium)}`,
    `utm_campaign=${encodeURIComponent(params.campaign)}`,
  ];
  if (params.content) parts.push(`utm_content=${encodeURIComponent(params.content)}`);
  if (params.term) parts.push(`utm_term=${encodeURIComponent(params.term)}`);
  return `${url}${sep}${parts.join("&")}`;
}

export type SharePlatform = "whatsapp" | "facebook" | "twitter" | "clipboard";
export type ShareContext = "poolInvite" | "poolShare" | "poolLeaderboard" | "poolPredictions";

export function getShareUtm(platform: SharePlatform, context: ShareContext): UtmParams {
  return {
    source: platform,
    medium: "social",
    campaign: context === "poolInvite" ? "pool_invite" : "pool_share",
    content: context,
  };
}
