/**
 * UTM parameter utility for email link tracking.
 *
 * Appends Google Analytics / Meta UTM parameters to URLs embedded
 * in transactional and marketing emails.
 */

interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export function appendUtm(url: string, params: UtmParams): string {
  const sep = url.includes("?") ? "&" : "?";
  const parts = [
    `utm_source=${encodeURIComponent(params.source)}`,
    `utm_medium=${encodeURIComponent(params.medium)}`,
    `utm_campaign=${encodeURIComponent(params.campaign)}`,
  ];
  if (params.content) parts.push(`utm_content=${encodeURIComponent(params.content)}`);
  return `${url}${sep}${parts.join("&")}`;
}

export function emailUtm(campaign: string, content: string = "cta_button"): UtmParams {
  return { source: "email", medium: "email", campaign, content };
}
