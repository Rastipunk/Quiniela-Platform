"use client";

import { useTranslations } from "next-intl";
import { kickMember, banMember } from "@/lib/api";
import type { ExpulsionModalData } from "../poolTypes";
import { colors, radii, zIndex, shadows, fontSize, fontWeight, spacing, modalOverlayDarkStyle } from "@/lib/theme";

export interface ExpulsionModalProps {
  data: ExpulsionModalData;
  onClose: () => void;
  poolId: string;
  token: string;
  busyKey: string | null;
  setBusyKey: (key: string | null) => void;
  setError: (error: string | null) => void;
  friendlyError: (e: any) => string;
  reload: () => Promise<void>;
}

export function ExpulsionModal({ data, onClose, poolId, token, busyKey, setBusyKey, setError, friendlyError, reload }: ExpulsionModalProps) {
  const t = useTranslations("pool");

  return (
    <div
      style={{ ...modalOverlayDarkStyle, zIndex: zIndex.expulsion, padding: spacing.xl }}
      onClick={onClose}
    >
      <div
        style={{ background: colors.white, borderRadius: radii["2xl"], padding: spacing["2xl"], maxWidth: 550, width: "100%", boxShadow: shadows.lg }}
        onClick={(e) => e.stopPropagation()}
      >
        {data.type === "KICK" ? (
          <>
            <h3 style={{ margin: 0, marginBottom: spacing.md, fontSize: fontSize["2xl"], fontWeight: fontWeight.bold, color: colors.warning }}>
              👋 {t("expulsion.kickTitle", { name: data.memberName })}
            </h3>
            <div style={{ marginBottom: spacing.lg, padding: spacing.md, background: colors.warningBg, border: `1px solid ${colors.warning}`, borderRadius: radii.lg, fontSize: fontSize.md, lineHeight: 1.6 }}>
              {t.rich("expulsion.kickWarning", { strong: (chunks) => <strong>{chunks}</strong> })}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token || !poolId || busyKey) return;
                const reason = (new FormData(e.currentTarget).get("reason") as string) || undefined;
                setBusyKey(`kick:${data.memberId}`);
                setError(null);
                try {
                  await kickMember(token, poolId, data.memberId, reason);
                  await reload();
                  onClose();
                  alert(`✅ ${t("expulsion.kickSuccess", { name: data.memberName })}`);
                } catch (err: any) {
                  setError(friendlyError(err));
                } finally {
                  setBusyKey(null);
                }
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <div>
                <label style={{ display: "block", fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 6, color: colors.textDark }}>
                  {t("expulsion.kickReasonLabel")}
                </label>
                <textarea name="reason" rows={2} placeholder={t("expulsion.kickReasonPlaceholder")}
                  style={{ width: "100%", padding: 10, border: `1px solid ${colors.border}`, borderRadius: radii.md, fontSize: fontSize.base, fontFamily: "inherit", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={onClose} disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#333", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {t("expulsion.cancel")}
                </button>
                <button type="submit" disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "none", background: busyKey ? "#ccc" : "#ffc107", color: "#fff", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {busyKey ? `⏳ ${t("expulsion.kicking")}` : `👋 ${t("expulsion.kickButton")}`}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#dc3545" }}>
              🚫 {t("expulsion.banTitle", { name: data.memberName })}
            </h3>
            <div style={{ marginBottom: 16, padding: 14, background: "#f8d7da", border: "2px solid #dc3545", borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#721c24" }}>
                ⚠️ {t("expulsion.banWarning")}
              </div>
              <ul style={{ margin: "8px 0", paddingLeft: 20, color: "#721c24" }}>
                <li>{t("expulsion.banDetail1")}</li>
                <li>{t("expulsion.banDetail2")}</li>
                <li>{t("expulsion.banDetail3")}</li>
              </ul>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!token || !poolId || busyKey) return;
                const formData = new FormData(e.currentTarget);
                const reason = formData.get("reason") as string;
                const deletePicks = (formData.get("deletePicks") as string) === "true";
                if (!reason || reason.trim().length === 0) {
                  alert(`❌ ${t("expulsion.banReasonRequired")}`);
                  return;
                }
                setBusyKey(`ban:${data.memberId}`);
                setError(null);
                try {
                  await banMember(token, poolId, data.memberId, reason, deletePicks);
                  await reload();
                  onClose();
                  alert(`✅ ${t("expulsion.banSuccess", { name: data.memberName })}`);
                } catch (err: any) {
                  setError(friendlyError(err));
                } finally {
                  setBusyKey(null);
                }
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                  {t("expulsion.banReasonLabel")}
                </label>
                <textarea name="reason" required rows={3} placeholder={t("expulsion.banReasonPlaceholder")}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" name="deletePicks" value="true" />
                  <span>{t.rich("expulsion.deletePicks", { strong: (chunks) => <strong>{chunks}</strong> })}</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={onClose} disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#333", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {t("expulsion.cancel")}
                </button>
                <button type="submit" disabled={busyKey !== null}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "none", background: busyKey ? "#ccc" : "#dc3545", color: "#fff", cursor: busyKey ? "wait" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {busyKey ? `⏳ ${t("expulsion.banning")}` : `🚫 ${t("expulsion.banButton")}`}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
