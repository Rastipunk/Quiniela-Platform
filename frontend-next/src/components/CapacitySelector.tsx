"use client";

import { colors } from "@/lib/theme";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  getPersonalTiers,
  getCorporateTiers,
  getPersonalTiersUsd,
  getCorporateTiersUsd,
  getTierForCustomCount,
  getTierForCustomCountUsd,
  formatPrice,
  PERSONAL_FREE_LIMIT,
  CORPORATE_FREE_LIMIT,
  INCREMENT,
  type PoolType,
  type PricingTier,
  type Currency,
} from "@/lib/pricing";

type CapacitySelectorProps = {
  type: PoolType;
  selectedCapacity: number;
  onSelect: (capacity: number) => void;
  currentCapacity?: number; // for admin panel expansion
  mode: "creation" | "expansion";
  /** If false, paid tiers show "Coming Soon" overlay. Only ADMIN can see/select paid tiers. */
  allowPaidTiers?: boolean;
  /** Currency to display prices in. Defaults to COP. */
  currency?: Currency;
};

export default function CapacitySelector({
  type,
  selectedCapacity,
  onSelect,
  currentCapacity,
  mode,
  allowPaidTiers = false,
  currency = "COP",
}: CapacitySelectorProps) {
  const t = useTranslations("pricing");
  const [customInput, setCustomInput] = useState("");

  const tiers = useMemo(() => {
    const getTiers = currency === "USD"
      ? (type === "personal" ? getPersonalTiersUsd : getCorporateTiersUsd)
      : (type === "personal" ? getPersonalTiers : getCorporateTiers);
    const allTiers = getTiers(300);
    if (mode === "expansion" && currentCapacity) {
      return allTiers.filter((tier) => tier.maxParticipants > currentCapacity);
    }
    return allTiers;
  }, [type, mode, currentCapacity, currency]);

  const customCount = parseInt(customInput, 10);
  const isValidCustom = !isNaN(customCount) && customCount > 0;

  const customTier = useMemo(() => {
    if (!isValidCustom) return null;
    const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;
    if (customCount <= freeLimit) return "FREE_COVERS";
    if (customCount <= 300) return "IN_LIST";
    return currency === "USD"
      ? getTierForCustomCountUsd(type, customCount)
      : getTierForCustomCount(type, customCount);
  }, [isValidCustom, customCount, type, currency]);

  const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>
        {t("title")}
      </h4>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: colors.textMuted }}>
        {t("description")}
      </p>

      {/* Info banner — different for personal vs corporate */}
      {mode === "creation" && type === "personal" && (
        <div style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #dcfce7, #d1fae5)",
          border: "2px solid #86efac",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#166534", marginBottom: 6 }}>
            {t("personalFreeTitle")}
          </div>
          <div style={{ fontSize: 13, color: "#15803d", lineHeight: 1.6 }}>
            &#10003; {t("personalFreeDesc")}<br />
            &#10003; {t("personalExpandNotice")}
          </div>
        </div>
      )}
      {mode === "creation" && type === "corporate" && (
        <div style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #dcfce7, #d1fae5)",
          border: "2px solid #86efac",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#166534", marginBottom: 6 }}>
            {t("trialTitle")}
          </div>
          <div style={{ fontSize: 13, color: "#15803d", lineHeight: 1.6 }}>
            &#10003; {t("trialNoCreditCard")}<br />
            &#10003; {t("trialPlayersJoin")}<br />
            &#10003; {t("trialNotifyEmail")}
          </div>
          <div style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.7)",
            fontSize: 12,
            color: colors.successDarker,
            lineHeight: 1.5,
          }}>
            <strong>{t("trialModeLabel")}:</strong> {t("trialModeDesc")}
          </div>
        </div>
      )}

      {/* Tier list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tiers.map((tier) => {
          const isSelected = selectedCapacity === tier.maxParticipants;
          const isFreeTier = type === "personal" ? tier.isFree : tier.maxParticipants === CORPORATE_FREE_LIMIT;
          const isPaid = !isFreeTier;
          const isLocked = isPaid && !allowPaidTiers;

          return (
            <div
              key={tier.maxParticipants}
              onClick={() => {
                if (!isLocked) onSelect(tier.maxParticipants);
              }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isLocked) { e.preventDefault(); onSelect(tier.maxParticipants); }}}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-disabled={isLocked}
              style={{
                position: "relative",
                padding: "14px 16px",
                borderRadius: 12,
                border: `2px solid ${isSelected ? colors.brand : colors.borderLight}`,
                background: isSelected ? "#eef2ff" : colors.white,
                cursor: isLocked ? "default" : "pointer",
                overflow: "hidden",
                transition: "border-color 0.15s, background 0.15s",
                minHeight: isLocked ? 64 : undefined,
              }}
            >
              {/* Content */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${isSelected ? colors.brand : colors.borderMedium}`,
                      background: isSelected ? colors.brand : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.white }} />
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
                      {isFreeTier && type === "corporate"
                        ? t("corporateTrialLabel")
                        : t("upTo", { count: tier.maxParticipants })}
                    </span>
                    {tier.savingsPercent > 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.successAlt,
                          background: colors.successBgLight,
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        {t("save", { percent: tier.savingsPercent })}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  {isFreeTier && type === "personal" ? (
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.successAlt,
                        background: colors.successBgLight,
                        padding: "3px 12px",
                        borderRadius: 999,
                      }}
                    >
                      {t("free")}
                    </span>
                  ) : isFreeTier && type === "corporate" ? (
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.successAlt,
                        background: colors.successBgLight,
                        padding: "3px 12px",
                        borderRadius: 999,
                      }}
                    >
                      {t("corporateFreeTrial")}
                    </span>
                  ) : (
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>
                        {formatPrice(tier.totalPrice, currency)}
                      </span>
                      {tier.pricePerIncrement > 0 && tier.maxParticipants > (type === "personal" ? 50 : CORPORATE_FREE_LIMIT) && (
                        <div style={{ fontSize: 11, color: colors.textLighter }}>
                          +{formatPrice(tier.pricePerIncrement, currency)} {t("per50")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Corporate free trial note */}
              {type === "corporate" && isFreeTier && (
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginLeft: 28 }}>
                  {t("corporateTrialNote")}
                </div>
              )}

              {/* Locked overlay for non-admin users */}
              {isLocked && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.82)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    zIndex: 2,
                    backdropFilter: "blur(1px)",
                  }}
                >
                  <span style={{ fontSize: 14 }}>&#128274;</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.brand }}>
                    {t("comingSoon")}
                  </span>
                </div>
              )}
              {/* Paid tier indicator (when unlocked) */}
              {isPaid && !isLocked && !isSelected && (
                <div style={{ fontSize: 11, color: colors.brand, marginTop: 4, marginLeft: 28, fontWeight: 600 }}>
                  {t("paidTier")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom input for >300 */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          background: colors.bgLighter,
          border: "1px solid #e5e7eb",
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, color: colors.textDark, display: "block", marginBottom: 8 }}>
          {t("customTitle")}
        </label>
        <input
          type="number"
          min={1}
          placeholder={t("customPlaceholder")}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {isValidCustom && customTier === "FREE_COVERS" && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: colors.successBgLight, color: colors.successAlt, fontSize: 13, fontWeight: 600 }}>
            {t("customFreeCovered", { limit: freeLimit })}
          </div>
        )}

        {isValidCustom && customTier === "IN_LIST" && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#eef2ff", color: colors.brand, fontSize: 13, fontWeight: 600 }}>
            {t("customInList")}
          </div>
        )}

        {isValidCustom && customTier && customTier !== "FREE_COVERS" && customTier !== "IN_LIST" && (
          <div
            style={{
              marginTop: 10,
              padding: 16,
              borderRadius: 10,
              background: colors.white,
              border: `2px solid ${selectedCapacity === (customTier as PricingTier).maxParticipants ? colors.brand : "#e5e7eb"}`,
            }}
          >
            <div style={{ fontSize: 13, color: colors.textDark, lineHeight: 1.6 }}>
              {t("customResult", {
                requested: customCount,
                offered: (customTier as PricingTier).maxParticipants,
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>
              {formatPrice((customTier as PricingTier).totalPrice, currency)}
            </div>
            {(customTier as PricingTier).savingsPercent > 0 && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.successAlt,
                  background: colors.successBgLight,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {t("save", { percent: (customTier as PricingTier).savingsPercent })}
              </span>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: colors.textLighter }}>
              {t("customReason", {
                requested: customCount,
                offered: (customTier as PricingTier).maxParticipants,
                increment: INCREMENT,
              })}
            </div>

            {/* Select button */}
            <button
              onClick={() => onSelect((customTier as PricingTier).maxParticipants)}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: colors.brand,
                color: colors.white,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("customSelect", { count: (customTier as PricingTier).maxParticipants })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
