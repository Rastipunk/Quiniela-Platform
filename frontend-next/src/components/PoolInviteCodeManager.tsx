"use client";

// frontend-next/src/components/PoolInviteCodeManager.tsx
//
// Code/link invite manager surfaced inside the Jugadores tab of
// corporate pools. Provides the host-side affordance for the
// pool-agnostic POST /pools/:poolId/invites endpoint (which
// already accepted CORPORATE_HOST per backend/src/lib/roles.ts).
//
// Spec + decisions: CORPORATE_INVITES_AUDIT.md §6 and
// CORPORATE_INVITES_IMPLEMENTATION.md commit 4.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  createInvite,
  getPoolInvites,
  deletePoolInvite,
  type PoolInviteRow,
} from "@/lib/api";
import { ShareButtons } from "@/components/ShareButtons";
import { colors } from "@/lib/theme";
import { formatMatchDateTime } from "@/lib/timezone";

// ── Module-level constants (no magic numbers, per CLAUDE.md §2) ──

// Preset expiry chips, in hours. 1h, 6h, 24h, 7d (168h), 30d (720h).
const EXPIRY_PRESETS_HOURS = [1, 6, 24, 168, 720] as const;
const EXPIRY_DEFAULT_HOURS = 720;
const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 3_600_000;
const COPIED_FLASH_MS = 2000;
// Hard cap for the custom horizon. 365 days = 8760 hours = 1 year.
// Anything beyond this is most likely a typo; capping protects
// against accidentally-permanent codes.
const EXPIRY_CUSTOM_MIN_HOURS = 1;
const EXPIRY_CUSTOM_MAX_DAYS = 365;
const EXPIRY_CUSTOM_MAX_HOURS = EXPIRY_CUSTOM_MAX_DAYS * HOURS_PER_DAY;

type ExpiryMode = "preset" | "custom";
type CustomErrorKey = "expiresCustomErrorMin" | "expiresCustomErrorMax" | "expiresCustomErrorNaN";

interface Props {
  poolId: string;
  token: string;
  isMobile: boolean;
  maxParticipants: number | undefined;
  currentMembers: number;
  organizationName: string;
}

export function PoolInviteCodeManager({
  poolId,
  token,
  isMobile,
  maxParticipants,
  currentMembers,
  organizationName: _organizationName,
}: Props) {
  void _organizationName; // reserved for future "header with company name"
  const t = useTranslations("pool.admin.codeInvites");
  const locale = useLocale();

  // ── List state ──
  const [invites, setInvites] = useState<PoolInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Form state ──
  const remainingSlots = useMemo(() => {
    if (maxParticipants == null) return 1;
    return Math.max(1, maxParticipants - currentMembers);
  }, [maxParticipants, currentMembers]);

  const [showForm, setShowForm] = useState(false);
  const [formMaxUses, setFormMaxUses] = useState<number>(remainingSlots);
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>("preset");
  const [presetHours, setPresetHours] = useState<number>(EXPIRY_DEFAULT_HOURS);
  const [customDays, setCustomDays] = useState<number>(30);
  const [customHours, setCustomHours] = useState<number>(0);
  const [customError, setCustomError] = useState<CustomErrorKey | null>(null);

  // ── Transient UI state ──
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync the form default when the pool's remaining slot count changes
  // (e.g. someone joined while the host had the form open).
  useEffect(() => {
    if (!showForm) setFormMaxUses(remainingSlots);
  }, [remainingSlots, showForm]);

  // ── Data fetch ──
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getPoolInvites(token, poolId);
      setInvites(result.invites);
    } catch {
      setLoadError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, poolId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Derived: effective expiry in hours ──
  const effectiveHours = useMemo(() => {
    if (expiryMode === "preset") return presetHours;
    return Math.max(0, Math.floor(customDays)) * HOURS_PER_DAY + Math.max(0, Math.floor(customHours));
  }, [expiryMode, presetHours, customDays, customHours]);

  const computeExpiresAtUtc = useCallback(
    () => new Date(Date.now() + effectiveHours * MS_PER_HOUR).toISOString(),
    [effectiveHours],
  );

  const previewExpiresAt = useMemo(
    () => formatMatchDateTime(computeExpiresAtUtc(), null, locale),
    [computeExpiresAtUtc, locale],
  );

  // ── Validation of custom mode ──
  const validateCustom = useCallback((): CustomErrorKey | null => {
    if (
      !Number.isInteger(customDays) ||
      !Number.isInteger(customHours) ||
      customDays < 0 ||
      customHours < 0
    ) {
      return "expiresCustomErrorNaN";
    }
    if (effectiveHours < EXPIRY_CUSTOM_MIN_HOURS) return "expiresCustomErrorMin";
    if (effectiveHours > EXPIRY_CUSTOM_MAX_HOURS) return "expiresCustomErrorMax";
    return null;
  }, [customDays, customHours, effectiveHours]);

  // ── Action handlers ──
  async function handleCreate() {
    setActionError(null);
    if (expiryMode === "custom") {
      const err = validateCustom();
      if (err) {
        setCustomError(err);
        return;
      }
      setCustomError(null);
    }
    setBusy("creating");
    try {
      await createInvite(token, poolId, {
        maxUses: formMaxUses,
        expiresAtUtc: computeExpiresAtUtc(),
      });
      // Reset form + reload list.
      setShowForm(false);
      setExpiryMode("preset");
      setPresetHours(EXPIRY_DEFAULT_HOURS);
      setCustomDays(30);
      setCustomHours(0);
      setCustomError(null);
      await reload();
    } catch {
      setActionError(t("createFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(invite: PoolInviteRow) {
    if (!window.confirm(t("revokeConfirm"))) return;
    setBusy(`revoke-${invite.id}`);
    setActionError(null);
    try {
      await deletePoolInvite(token, poolId, invite.id);
      await reload();
    } catch {
      setActionError(t("revokeFailed"));
    } finally {
      setBusy(null);
    }
  }

  function shareUrlFor(code: string): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite?code=${code}`;
  }

  async function handleCopy(invite: PoolInviteRow) {
    try {
      await navigator.clipboard.writeText(shareUrlFor(invite.code));
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((id) => (id === invite.id ? null : id)), COPIED_FLASH_MS);
    } catch {
      // clipboard failure — surface as an inline error.
      setActionError("Clipboard");
    }
  }

  // ── Style maps ──
  const containerBg = "linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)";
  const containerBorder = "2px solid #a78bfa";

  // ── Render ──
  return (
    <div
      style={{
        marginTop: 16,
        padding: isMobile ? 16 : 20,
        background: containerBg,
        border: containerBorder,
        borderRadius: 12,
      }}
    >
      <h4 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#4c1d95" }}>
        {"\u{1F517}"} {t("title")}
      </h4>
      <p style={{ fontSize: 13, color: "#6b21a8", margin: "0 0 16px" }}>{t("subtitle")}</p>

      {/* ── Disclaimer block ── */}
      <div
        style={{
          padding: 14,
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 10,
          marginBottom: 16,
          color: "#78350f",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{"⚠️"} {t("disclaimerTitle")}</div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 4 }}>{t("disclaimerBullet1")}</li>
          <li style={{ marginBottom: 4 }}>
            {t.rich("disclaimerBullet2", {
              b: (chunks) => <b>{chunks}</b>,
              current: currentMembers,
              max: maxParticipants ?? "?",
            })}
          </li>
          <li style={{ marginBottom: 4 }}>
            {t.rich("disclaimerBullet3", { b: (chunks) => <b>{chunks}</b> })}{" "}
            <Link
              href={`/pools/${poolId}?tab=admin` as never}
              style={{ color: "#7c3aed", fontWeight: 600, textDecoration: "underline" }}
            >
              ({t("adminLinkLabel")})
            </Link>
          </li>
          <li style={{ marginBottom: 4 }}>{t("disclaimerBullet4")}</li>
          <li>{t.rich("disclaimerBullet5", { b: (chunks) => <b>{chunks}</b> })}</li>
        </ul>
      </div>

      {/* ── Inline error bar ── */}
      {actionError && (
        <div
          style={{
            padding: 10,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#991b1b",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {actionError}
        </div>
      )}

      {/* ── Active codes list ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#4c1d95", marginBottom: 8 }}>
          {t("activeListTitle")}
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: colors.textMuted }}>...</div>
        ) : loadError ? (
          <div style={{ fontSize: 13, color: colors.errorDarker }}>{loadError}</div>
        ) : invites.length === 0 ? (
          <div style={{ fontSize: 13, color: colors.textMuted, fontStyle: "italic" }}>{t("empty")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invites.map((inv) => {
              const isExpired = inv.expired;
              const isExhausted = inv.exhausted;
              const isCopied = copiedId === inv.id;
              const isRevoking = busy === `revoke-${inv.id}`;
              return (
                <div
                  key={inv.id}
                  style={{
                    padding: 12,
                    background: "white",
                    border: "1px solid #ddd6fe",
                    borderRadius: 10,
                    opacity: isExpired || isExhausted ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <code
                      style={{
                        fontFamily: "monospace",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#4c1d95",
                        padding: "2px 8px",
                        background: "#f5f3ff",
                        borderRadius: 6,
                        letterSpacing: 0.5,
                      }}
                    >
                      {inv.code}
                    </code>
                    {isExpired && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.errorDarker,
                          background: colors.errorBg,
                          padding: "2px 8px",
                          borderRadius: 12,
                        }}
                      >
                        {t("expiredLabel")}
                      </span>
                    )}
                    {isExhausted && !isExpired && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.warningDarker,
                          background: colors.warningBgAmber,
                          padding: "2px 8px",
                          borderRadius: 12,
                        }}
                      >
                        {t("exhaustedLabel")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
                    {inv.maxUses == null
                      ? t("usesUnlimited", { uses: inv.uses })
                      : t("usesLabel", { uses: inv.uses, max: inv.maxUses })}
                    {inv.expiresAtUtc && (
                      <>
                        {" · "}
                        {t("expiresLabel", { date: formatMatchDateTime(inv.expiresAtUtc, null, locale) })}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!isExpired && !isExhausted && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(inv)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid #c4b5fd",
                            background: "white",
                            fontSize: 12,
                            color: "#4c1d95",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {isCopied ? t("copied") : t("copyButton")}
                        </button>
                        <ShareButtons
                          context="poolInvite"
                          url={shareUrlFor(inv.code)}
                          data={{ poolName: "", inviteCode: inv.code }}
                          size="sm"
                        />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv)}
                      disabled={isExpired || isRevoking}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${colors.errorBorder}`,
                        background: "white",
                        fontSize: 12,
                        color: colors.errorDarker,
                        cursor: isExpired || isRevoking ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        opacity: isExpired ? 0.5 : 1,
                      }}
                    >
                      {isRevoking ? "..." : t("revokeButton")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Generate button / form ── */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: colors.purple,
            color: "white",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {"➕"} {t("generateButton")}
        </button>
      ) : (
        <div
          style={{
            padding: 16,
            background: "white",
            border: "1px solid #ddd6fe",
            borderRadius: 10,
          }}
        >
          {/* maxUses */}
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4c1d95", marginBottom: 4 }}>
            {t("formMaxUses")}
          </label>
          <input
            type="number"
            min={1}
            value={formMaxUses}
            onChange={(e) => setFormMaxUses(Math.max(1, parseInt(e.target.value || "1", 10)))}
            style={{
              width: "100%",
              padding: 8,
              fontSize: 14,
              borderRadius: 6,
              border: "1px solid #c4b5fd",
              boxSizing: "border-box",
              marginBottom: 4,
            }}
          />
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>
            {t("formMaxUsesHint", { remaining: remainingSlots })}
          </div>

          {/* Expiry block */}
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4c1d95", marginBottom: 6 }}>
            {t("formExpires")}
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {EXPIRY_PRESETS_HOURS.map((h) => {
              const isActive = expiryMode === "preset" && presetHours === h;
              const labelKey =
                h === 1 ? "expiresPreset1h"
                : h === 6 ? "expiresPreset6h"
                : h === 24 ? "expiresPreset24h"
                : h === 168 ? "expiresPreset7d"
                : "expiresPreset30d";
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setExpiryMode("preset");
                    setPresetHours(h);
                    setCustomError(null);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 16,
                    border: `1px solid ${isActive ? colors.purple : "#c4b5fd"}`,
                    background: isActive ? colors.purple : "white",
                    color: isActive ? "white" : "#4c1d95",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t(labelKey)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setExpiryMode("custom")}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                border: `1px solid ${expiryMode === "custom" ? colors.purple : "#c4b5fd"}`,
                background: expiryMode === "custom" ? colors.purple : "white",
                color: expiryMode === "custom" ? "white" : "#4c1d95",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("expiresCustom")}
            </button>
          </div>

          {expiryMode === "custom" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>
                    {t("expiresCustomDaysLabel")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={EXPIRY_CUSTOM_MAX_DAYS}
                    value={customDays}
                    onChange={(e) => {
                      setCustomDays(parseInt(e.target.value || "0", 10));
                      setCustomError(null);
                    }}
                    style={{
                      width: "100%",
                      padding: 8,
                      fontSize: 14,
                      borderRadius: 6,
                      border: `1px solid ${customError ? colors.errorBorder : "#c4b5fd"}`,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>
                    {t("expiresCustomHoursLabel")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={customHours}
                    onChange={(e) => {
                      setCustomHours(parseInt(e.target.value || "0", 10));
                      setCustomError(null);
                    }}
                    style={{
                      width: "100%",
                      padding: 8,
                      fontSize: 14,
                      borderRadius: 6,
                      border: `1px solid ${customError ? colors.errorBorder : "#c4b5fd"}`,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: customError ? colors.errorDarker : colors.textMuted }}>
                {customError ? t(customError) : t("expiresCustomHint")}
              </div>
            </div>
          )}

          {/* Live preview of resulting expiry */}
          <div
            style={{
              padding: 8,
              background: "#f5f3ff",
              borderRadius: 6,
              fontSize: 12,
              color: "#4c1d95",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            {t("expiresSummary", { date: previewExpiresAt })}
          </div>

          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 14 }}>
            {t("formExpiresHint")}
          </div>

          {/* Submit / cancel */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy === "creating"}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: colors.purple,
                color: "white",
                fontSize: 14,
                fontWeight: 700,
                cursor: busy === "creating" ? "not-allowed" : "pointer",
                opacity: busy === "creating" ? 0.7 : 1,
              }}
            >
              {busy === "creating" ? t("generating") : t("formSubmit")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setCustomError(null);
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #c4b5fd",
                background: "white",
                color: "#4c1d95",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("formCancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
