"use client";

import { colors } from "@/lib/theme";
import { trackEvent } from "@/lib/analytics";
import { trackMetaCustomEvent } from "@/lib/metaPixel";
import { appendUtm } from "@/lib/utm";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

// ── Share channel definitions ──────────────────────────────
// Each channel generates a URL that opens the app with pre-filled content.
// No API tokens needed — these are standard web intents.

type ShareChannel = "whatsapp" | "facebook" | "twitter" | "copy";

interface ChannelConfig {
  key: ShareChannel;
  label: string;
  /** SVG icon — inline to avoid external dependency */
  icon: React.ReactNode;
  color: string;
  buildUrl: (text: string, url: string) => string;
}

const WHATSAPP_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FACEBOOK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TWITTER_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const COPY_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const CHECK_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function getChannels(t: ReturnType<typeof useTranslations>): ChannelConfig[] {
  return [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: WHATSAPP_ICON,
      color: "#25D366",
      buildUrl: (text, url) =>
        `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: FACEBOOK_ICON,
      color: "#1877F2",
      buildUrl: (_text, url) =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      key: "twitter",
      label: "X",
      icon: TWITTER_ICON,
      color: "#000",
      buildUrl: (text, url) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
  ];
}

// ── Share context types ────────────────────────────────────
// Each context defines what text and URL to share.

export type ShareContext =
  | "poolInvite"
  | "predictions"
  | "worldCupHub"
  | "leaderboard"
  | "barRace"
  | "generic";

export interface ShareButtonsProps {
  /** What context is this share for — determines the pre-filled message */
  context: ShareContext;
  /** The URL to share (fully qualified) */
  url: string;
  /** Optional extra data for message templates */
  data?: {
    poolName?: string;
    inviteCode?: string;
    rank?: number;
    totalMembers?: number;
  };
  /** Layout: inline row or stacked column */
  layout?: "row" | "column";
  /** Show labels next to icons (default: false — icons only) */
  showLabels?: boolean;
  /** Size variant */
  size?: "sm" | "md";
}

// ── Component ──────────────────────────────────────────────

export function ShareButtons({
  context,
  url,
  data,
  layout = "row",
  showLabels = false,
  size = "md",
}: ShareButtonsProps) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);

  const campaign = context === "poolInvite" ? "pool_invite" : "pool_share";
  const tagUrl = useCallback((source: string) => appendUtm(url, {
    source,
    medium: "social",
    campaign,
    content: context,
  }), [url, campaign, context]);

  // Build share text based on context
  const shareText = useCallback(() => {
    switch (context) {
      case "poolInvite":
        return t("poolInvite", {
          poolName: data?.poolName || "",
          code: data?.inviteCode || "",
        });
      case "predictions":
        return t("predictions");
      case "worldCupHub":
        return t("worldCupHub");
      case "leaderboard":
        return t("leaderboard", {
          rank: String(data?.rank || 1),
          poolName: data?.poolName || "",
          total: String(data?.totalMembers || 0),
        });
      case "barRace":
        return t("barRace");
      default:
        return t("generic");
    }
  }, [context, data, t]);

  const handleNativeShare = useCallback(async () => {
    const text = shareText();
    try {
      await navigator.share({ title: text, url: tagUrl("native_share") });
      trackEvent("share_pool", { platform: "native_share", context });
      trackMetaCustomEvent("SharePool", { content_name: "native_share" });
    } catch {
      // User cancelled or not supported — fall through to buttons
    }
  }, [shareText, tagUrl]);

  const handleCopy = useCallback(async () => {
    const text = shareText();
    const tagged = tagUrl("clipboard");
    try {
      await navigator.clipboard.writeText(`${text}\n${tagged}`);
      trackEvent("share_pool", { platform: "copy_link", context });
      trackMetaCustomEvent("SharePool", { content_name: "copy_link" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = `${text}\n${tagged}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [shareText, tagUrl]);

  const channels = getChannels(t);
  const isSmall = size === "sm";
  const iconOnly = !showLabels;
  // Icon-only buttons use a fixed SQUARE size so every channel renders as an
  // identical circle. Padding-based sizing made the bordered native-share/copy
  // buttons render as ovals next to the borderless coloured ones.
  const iconDim = isSmall ? 36 : 42;
  const btnPadding = showLabels ? (isSmall ? "8px 12px" : "10px 16px") : 0;
  const fontSize = isSmall ? "0.8rem" : "0.88rem";
  const iconGap = showLabels ? (isSmall ? 4 : 6) : 0;
  const shapeStyle = iconOnly
    ? { width: iconDim, height: iconDim, borderRadius: "50%", boxSizing: "border-box" as const, flexShrink: 0 }
    : { borderRadius: 10 };

  // On mobile, try native share first
  const supportsNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: layout === "column" ? "column" : "row",
        flexWrap: "wrap",
        gap: isSmall ? 6 : 8,
        alignItems: layout === "column" ? "stretch" : "center",
      }}
    >
      {/* Native share button (mobile only) */}
      {supportsNativeShare && (
        <button
          onClick={handleNativeShare}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: iconGap,
            padding: btnPadding,
            ...shapeStyle,
            border: iconOnly ? "none" : "1px solid var(--border)",
            background: iconOnly ? colors.brand : "var(--surface)",
            color: iconOnly ? "white" : "var(--text)",
            cursor: "pointer",
            fontSize,
            fontWeight: 600,
          }}
          aria-label={t("nativeShare")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {showLabels && t("nativeShare")}
        </button>
      )}

      {/* Channel-specific buttons */}
      {channels.map((ch) => (
        <a
          key={ch.key}
          href={ch.buildUrl(shareText(), tagUrl(ch.key))}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: iconGap,
            padding: btnPadding,
            ...shapeStyle,
            border: "none",
            background: ch.color,
            color: "white",
            cursor: "pointer",
            fontSize,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {ch.icon}
          {showLabels && ch.label}
        </a>
      ))}

      {/* Copy link */}
      <button
        onClick={handleCopy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: iconGap,
          padding: btnPadding,
          ...shapeStyle,
          border: iconOnly ? "none" : "1px solid var(--border)",
          background: copied ? colors.successAlt : (iconOnly ? colors.textMuted : "var(--surface)"),
          color: copied || iconOnly ? "white" : "var(--text)",
          cursor: "pointer",
          fontSize,
          fontWeight: 600,
          transition: "background 0.2s, color 0.2s",
        }}
      >
        {copied ? CHECK_ICON : COPY_ICON}
        {showLabels && (copied ? t("copied") : t("copyLink"))}
      </button>
    </div>
  );
}
