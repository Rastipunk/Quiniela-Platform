"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  getPersonalTiers,
  getCorporateTiers,
  getTierForCustomCount,
  getFullPriceSavings,
  PERSONAL_FREE_LIMIT,
  CORPORATE_FREE_LIMIT,
  INCREMENT,
  type PoolType,
  type PricingTier,
} from "@/lib/pricing";

type CapacitySelectorProps = {
  type: PoolType;
  selectedCapacity: number;
  onSelect: (capacity: number) => void;
  currentCapacity?: number; // for admin panel expansion
  mode: "creation" | "expansion";
};

export default function CapacitySelector({
  type,
  selectedCapacity,
  onSelect,
  currentCapacity,
  mode,
}: CapacitySelectorProps) {
  const t = useTranslations("pricing");
  const [customInput, setCustomInput] = useState("");

  const tiers = useMemo(() => {
    const allTiers = type === "personal" ? getPersonalTiers(300) : getCorporateTiers(300);
    if (mode === "expansion" && currentCapacity) {
      return allTiers.filter((tier) => tier.maxParticipants > currentCapacity);
    }
    return allTiers;
  }, [type, mode, currentCapacity]);

  const customCount = parseInt(customInput, 10);
  const isValidCustom = !isNaN(customCount) && customCount > 0;

  const customTier = useMemo(() => {
    if (!isValidCustom) return null;
    const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;
    if (customCount <= freeLimit) return "FREE_COVERS";
    if (customCount <= 300) return "IN_LIST";
    return getTierForCustomCount(type, customCount);
  }, [isValidCustom, customCount, type]);

  const customSavings = useMemo(() => {
    if (!customTier || customTier === "FREE_COVERS" || customTier === "IN_LIST") return null;
    return getFullPriceSavings(customTier, type);
  }, [customTier, type]);

  const freeLimit = type === "personal" ? PERSONAL_FREE_LIMIT : CORPORATE_FREE_LIMIT;

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>
        {t("title")}
      </h4>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
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
            color: "#065f46",
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
          const isLocked = !isFreeTier;

          return (
            <div
              key={tier.maxParticipants}
              onClick={() => {
                if (!isLocked) onSelect(tier.maxParticipants);
              }}
              style={{
                position: "relative",
                padding: "14px 16px",
                borderRadius: 12,
                border: `2px solid ${isSelected ? "#4f46e5" : "#e5e7eb"}`,
                background: isSelected ? "#eef2ff" : "#fff",
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
                      border: `2px solid ${isSelected ? "#4f46e5" : "#d1d5db"}`,
                      background: isSelected ? "#4f46e5" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
                      {t("upTo", { count: tier.maxParticipants })}
                    </span>
                    {tier.savingsPercent > 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#16a34a",
                          background: "#dcfce7",
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
                        color: "#16a34a",
                        background: "#dcfce7",
                        padding: "3px 12px",
                        borderRadius: 999,
                      }}
                    >
                      {t("free")}
                    </span>
                  ) : (
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>
                        ${tier.totalPrice.toFixed(2)}
                      </span>
                      {tier.pricePerIncrement > 0 && tier.maxParticipants > (type === "personal" ? 50 : CORPORATE_FREE_LIMIT) && (
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          +${tier.pricePerIncrement.toFixed(2)} {t("per50")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Corporate base note */}
              {type === "corporate" && tier.maxParticipants === CORPORATE_FREE_LIMIT && (
                <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 4, marginLeft: 28 }}>
                  {t("corporateIncludes", { count: CORPORATE_FREE_LIMIT })}
                </div>
              )}

              {/* Locked overlay */}
              {isLocked && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.82)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    backdropFilter: "blur(1px)",
                  }}
                >
                  <div style={{ fontSize: 18 }}>&#128274;</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#4f46e5" }}>
                    {t("comingSoon")}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                    {t("comingSoonDesc")}
                  </div>
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
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>
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
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#dcfce7", color: "#16a34a", fontSize: 13, fontWeight: 600 }}>
            {t("customFreeCovered", { limit: freeLimit })}
          </div>
        )}

        {isValidCustom && customTier === "IN_LIST" && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#eef2ff", color: "#4f46e5", fontSize: 13, fontWeight: 600 }}>
            {t("customInList")}
          </div>
        )}

        {isValidCustom && customTier && customTier !== "FREE_COVERS" && customTier !== "IN_LIST" && (
          <div
            style={{
              position: "relative",
              marginTop: 10,
              padding: 16,
              borderRadius: 10,
              background: "#fff",
              border: "2px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              {t("customResult", {
                requested: customCount,
                offered: (customTier as PricingTier).maxParticipants,
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800, color: "#1a1a2e" }}>
              ${(customTier as PricingTier).totalPrice.toFixed(2)}
            </div>
            {customSavings && customSavings.savedAmount > 0 && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#9ca3af", textDecoration: "line-through" }}>
                  ${customSavings.fullPrice.toFixed(2)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#16a34a",
                    background: "#dcfce7",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {t("customSaving", {
                    percent: customSavings.savedPercent,
                    amount: customSavings.savedAmount.toFixed(2),
                  })}
                </span>
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
              {t("customReason", {
                requested: customCount,
                offered: (customTier as PricingTier).maxParticipants,
                increment: INCREMENT,
              })}
            </div>

            {/* Locked overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.82)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2,
                backdropFilter: "blur(1px)",
              }}
            >
              <div style={{ fontSize: 18 }}>&#128274;</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#4f46e5" }}>
                {t("comingSoon")}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                {t("comingSoonDesc")}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
