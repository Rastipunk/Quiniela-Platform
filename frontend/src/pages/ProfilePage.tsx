import { useEffect, useState } from "react";
import { getUserProfile, updateUserProfile, type UserProfile, type UpdateProfileInput } from "../lib/api";
import { getToken } from "../lib/auth";
import { EmailPreferencesSection } from "../components/EmailPreferencesSection";
import { EmailVerificationBanner } from "../components/EmailVerificationBanner";

export function ProfilePage() {
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
        throw new Error("No autenticado");
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

      // Comentario en español: calcular días restantes para cambio de username
      if (data.user.lastUsernameChangeAt) {
        const lastChange = new Date(data.user.lastUsernameChangeAt);
        const daysSince =
          (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        const daysRemaining = Math.ceil(30 - daysSince);

        if (daysRemaining > 0) {
          setUsernameWarning(
            `Podrás cambiar tu nombre de usuario en ${daysRemaining} días`
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
        throw new Error("No autenticado");
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
      setSuccessMessage("Perfil actualizado exitosamente");

      // Comentario en español: actualizar warning si cambió username
      if (data.user.lastUsernameChangeAt) {
        const lastChange = new Date(data.user.lastUsernameChangeAt);
        const daysSince =
          (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        const daysRemaining = Math.ceil(30 - daysSince);

        if (daysRemaining > 0) {
          setUsernameWarning(
            `Podrás cambiar tu nombre de usuario en ${daysRemaining} días`
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

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Cargando perfil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "red" }}>Error al cargar perfil</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h1>Mi Perfil</h1>

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
          <strong>Email:</strong> {profile.email}
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
              &#10004; Verificado
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
              Google
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
              Pendiente
            </span>
          )}
        </p>
        <p>
          <strong>Cuenta creada:</strong>{" "}
          {new Date(profile.createdAtUtc).toLocaleDateString("es-ES")}
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
            <strong>Nombre visible *</strong>
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
            <strong>Nombre de usuario *</strong>
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
            title="Solo letras, números y guión bajo"
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
              ⚠️ {usernameWarning}
            </p>
          )}
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
            Solo letras, números y guión bajo (3-20 caracteres). Puedes
            cambiarlo una vez cada 30 días.
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
              <strong>Nombre</strong>
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
              <strong>Apellido</strong>
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
              <strong>Fecha de nacimiento</strong>
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
              Debes tener al menos 13 años
            </p>
          </div>

          <div>
            <label
              htmlFor="gender"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
              <strong>Género</strong>
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
              <option value="">Selecciona...</option>
              <option value="MALE">Hombre</option>
              <option value="FEMALE">Mujer</option>
              <option value="OTHER">Otro</option>
              <option value="PREFER_NOT_TO_SAY">Prefiero no decir</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="country"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>País</strong>
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
            <option value="">Selecciona...</option>
            <option value="MX">México</option>
            <option value="CO">Colombia</option>
            <option value="ES">España</option>
            <option value="AR">Argentina</option>
            <option value="BR">Brasil</option>
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
            <option value="VE">Venezuela</option>
            <option value="EC">Ecuador</option>
            <option value="UY">Uruguay</option>
            <option value="PY">Paraguay</option>
            <option value="BO">Bolivia</option>
            <option value="CR">Costa Rica</option>
            <option value="PA">Panamá</option>
            <option value="US">Estados Unidos</option>
            <option value="CA">Canadá</option>
          </select>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            htmlFor="timezone"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>Zona horaria</strong>
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
            <option value="">Selecciona...</option>
            <optgroup label="🌎 América">
              <option value="America/Mexico_City">México (CDMX, Guadalajara) - GMT-6</option>
              <option value="America/Bogota">Colombia (Bogotá) - GMT-5</option>
              <option value="America/Lima">Perú (Lima) - GMT-5</option>
              <option value="America/Santiago">Chile (Santiago) - GMT-3</option>
              <option value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires) - GMT-3</option>
              <option value="America/Sao_Paulo">Brasil (São Paulo) - GMT-3</option>
            </optgroup>
            <optgroup label="🌍 Europa">
              <option value="Europe/Madrid">España (Madrid) - GMT+1</option>
              <option value="Europe/London">Reino Unido (Londres) - GMT+0</option>
            </optgroup>
            <optgroup label="🌎 Norteamérica">
              <option value="America/New_York">EE.UU. Este (Nueva York) - GMT-5</option>
              <option value="America/Chicago">EE.UU. Centro (Chicago) - GMT-6</option>
              <option value="America/Los_Angeles">EE.UU. Oeste (Los Ángeles) - GMT-8</option>
            </optgroup>
          </select>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" }}>
            Las fechas y horas se mostrarán en tu zona horaria
          </p>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label
            htmlFor="bio"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            <strong>Biografía</strong>
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
            {bioCharCount}/200 caracteres
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
            Cancelar
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
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      {/* Sección de preferencias de email (fuera del form principal) */}
      <EmailPreferencesSection />
    </div>
  );
}
