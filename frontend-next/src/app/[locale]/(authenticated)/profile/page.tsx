"use client";

import { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile, type UserProfile, type UpdateProfileInput } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { EmailPreferencesSection } from "@/components/EmailPreferencesSection";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { useTranslations, useLocale } from "next-intl";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const locale = useLocale();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "" as "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | "",
    bio: "",
    country: "",
    timezone: "",
  });

  const [usernameWarning, setUsernameWarning] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      if (!token) {
        throw new Error(t("notAuthenticated"));
      }

      const data = await getUserProfile(token);
      setProfile(data.user);
      setFormData({
        displayName: data.user.displayName || "",
        username: data.user.username || "",
        firstName: data.user.firstName || "",
        lastName: data.user.lastName || "",
        dateOfBirth: data.user.dateOfBirth
          ? data.user.dateOfBirth.split("T")[0]
          : "",
        gender: data.user.gender || "",
        bio: data.user.bio || "",
        country: data.user.country || "",
        timezone: data.user.timezone || "",
      });

      // Calcular días restantes para cambio de username
      if (data.user.lastUsernameChangeAt) {
        const lastChange = new Date(data.user.lastUsernameChangeAt);
        const daysSince =
          (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        const daysRemaining = Math.ceil(30 - daysSince);

        if (daysRemaining > 0) {
          setUsernameWarning(
            t("usernameChangeWait", { days: daysRemaining })
          );
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error(t("notAuthenticated"));
      }

      const payload: UpdateProfileInput = {
        displayName: formData.displayName || undefined,
        username: formData.username || undefined,
        firstName: formData.firstName || null,
        lastName: formData.lastName || null,
        dateOfBirth: formData.dateOfBirth
          ? new Date(formData.dateOfBirth).toISOString()
          : null,
        gender: formData.gender || null,
        bio: formData.bio || null,
        country: formData.country || null,
        timezone: formData.timezone || null,
      };

      const data = await updateUserProfile(token, payload);
      setProfile(data.user);
      setSuccessMessage(t("updateSuccess"));

      // Actualizar warning si cambió username
      if (data.user.lastUsernameChangeAt) {
        const lastChange = new Date(data.user.lastUsernameChangeAt);
        const daysSince =
          (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        const daysRemaining = Math.ceil(30 - daysSince);

        if (daysRemaining > 0) {
          setUsernameWarning(
            t("usernameChangeWait", { days: daysRemaining })
          );
        } else {
          setUsernameWarning(null);
        }
      }

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const bioCharCount = formData.bio?.length || 0;

  const localeDateString = locale === "es" ? "es-ES" : locale === "pt" ? "pt-BR" : "en-US";

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "red" }}>{t("loadError")}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h1>{t("title")}</h1>

      <EmailVerificationBanner
        emailVerified={profile.emailVerified}
        isGoogleAccount={profile.isGoogleAccount}
        email={profile.email}
      />

      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: "8px",
        }}
      >
        <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>{t("emailLabel")}</strong> {profile.email}
          {profile.emailVerified ? (
            <span
              style={{
                background: "#d1fae5",
                color: "#065f46",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 500,
              }}
            >
              {`\u2714 ${t("verified")}`}
            </span>
          ) : profile.isGoogleAccount ? (
            <span
              style={{
                background: "#dbeafe",
                color: "#1e40af",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 500,
              }}
            >
              {t("googleBadge")}
            </span>
          ) : (
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 12,
                fontWeight: 500,
              }}
            >
              {t("pendingBadge")}
            </span>
          )}
        </p>
        <p>
          <strong>{t("createdAt")}</strong>{" "}
          {new Date(profile.createdAtUtc).toLocaleDateString(localeDateString)}
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            background: "#fee",
            color: "#c00",
            borderRadius: "4px",
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            background: "#efe",
            color: "#0a0",
            borderRadius: "4px",
          }}
        >
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="displayName"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>{t("displayName")}</strong>
          </label>
          <input
            id="displayName"
            type="text"
            value={formData.displayName}
            onChange={(e) =>
              setFormData({ ...formData, displayName: e.target.value })
            }
            required
            maxLength={100}
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="username"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>{t("username")}</strong>
          </label>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
            minLength={3}
            maxLength={20}
            pattern="^[a-zA-Z0-9_]+$"
            title={t("usernameHint")}
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
          {usernameWarning && (
            <p style={{ fontSize: "0.875rem", color: "#f59e0b", marginTop: "0.25rem" }}>
              {usernameWarning}
            </p>
          )}
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
            {t("usernameRules")}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <label
              htmlFor="firstName"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              <strong>{t("firstName")}</strong>
            </label>
            <input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              maxLength={50}
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="lastName"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              <strong>{t("lastName")}</strong>
            </label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              maxLength={50}
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <label
              htmlFor="dateOfBirth"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              <strong>{t("dateOfBirth")}</strong>
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) =>
                setFormData({ ...formData, dateOfBirth: e.target.value })
              }
              max={new Date().toISOString().split("T")[0]}
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
            <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
              {t("ageRequirement")}
            </p>
          </div>

          <div>
            <label
              htmlFor="gender"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              <strong>{t("gender")}</strong>
            </label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gender: e.target.value as any,
                })
              }
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            >
              <option value="">{t("selectPlaceholder")}</option>
              <option value="MALE">{t("genderMale")}</option>
              <option value="FEMALE">{t("genderFemale")}</option>
              <option value="OTHER">{t("genderOther")}</option>
              <option value="PREFER_NOT_TO_SAY">{t("genderPreferNot")}</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="country"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>{t("country")}</strong>
          </label>
          <select
            id="country"
            value={formData.country}
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">{t("selectPlaceholder")}</option>
            <option value="MX">{t("countries.MX")}</option>
            <option value="CO">{t("countries.CO")}</option>
            <option value="ES">{t("countries.ES")}</option>
            <option value="AR">{t("countries.AR")}</option>
            <option value="BR">{t("countries.BR")}</option>
            <option value="CL">{t("countries.CL")}</option>
            <option value="PE">{t("countries.PE")}</option>
            <option value="VE">{t("countries.VE")}</option>
            <option value="EC">{t("countries.EC")}</option>
            <option value="UY">{t("countries.UY")}</option>
            <option value="PY">{t("countries.PY")}</option>
            <option value="BO">{t("countries.BO")}</option>
            <option value="CR">{t("countries.CR")}</option>
            <option value="PA">{t("countries.PA")}</option>
            <option value="US">{t("countries.US")}</option>
            <option value="CA">{t("countries.CA")}</option>
          </select>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="timezone"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>{t("timezone")}</strong>
          </label>
          <select
            id="timezone"
            value={formData.timezone}
            onChange={(e) =>
              setFormData({ ...formData, timezone: e.target.value })
            }
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          >
            <option value="">{t("selectPlaceholder")}</option>
            <optgroup label={`\uD83C\uDF0E ${t("timezoneGroups.americas")}`}>
              <option value="America/Mexico_City">{t("timezones.mexicoCity")}</option>
              <option value="America/Bogota">{t("timezones.bogota")}</option>
              <option value="America/Lima">{t("timezones.lima")}</option>
              <option value="America/Santiago">{t("timezones.santiago")}</option>
              <option value="America/Argentina/Buenos_Aires">{t("timezones.buenosAires")}</option>
              <option value="America/Sao_Paulo">{t("timezones.saoPaulo")}</option>
            </optgroup>
            <optgroup label={`\uD83C\uDF0D ${t("timezoneGroups.europe")}`}>
              <option value="Europe/Madrid">{t("timezones.madrid")}</option>
              <option value="Europe/London">{t("timezones.london")}</option>
            </optgroup>
            <optgroup label={`\uD83C\uDF0E ${t("timezoneGroups.northAmerica")}`}>
              <option value="America/New_York">{t("timezones.newYork")}</option>
              <option value="America/Chicago">{t("timezones.chicago")}</option>
              <option value="America/Los_Angeles">{t("timezones.losAngeles")}</option>
            </optgroup>
          </select>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
            {t("timezoneHint")}
          </p>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label
            htmlFor="bio"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>{t("bio")}</strong>
          </label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) =>
              setFormData({ ...formData, bio: e.target.value })
            }
            maxLength={200}
            rows={4}
            style={{
              width: "100%",
              padding: "0.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontFamily: "inherit",
            }}
          />
          <p
            style={{
              fontSize: "0.875rem",
              color: bioCharCount > 200 ? "#c00" : "#666",
              marginTop: "0.25rem",
              textAlign: "right",
            }}
          >
            {t("bioCount", { count: bioCharCount })}
          </p>
        </div>

        <div
          style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}
        >
          <button
            type="button"
            onClick={() => window.history.back()}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              background: "white",
              color: "#333",
              cursor: "pointer",
            }}
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "none",
              background: saving ? "#ccc" : "#007bff",
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? t("saving") : t("saveChanges")}
          </button>
        </div>
      </form>

      {/* Sección de preferencias de email (fuera del form principal) */}
      <EmailPreferencesSection />
    </div>
  );
}
