import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "../lib/auth";
import { getUserProfile, type UserProfile } from "../lib/api";

export function NavBar() {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const token = getToken();
      if (!token) return;

      const data = await getUserProfile(token);
      setProfile(data.user);

      // Auto-actualizar timezone si no está configurado (cuentas existentes)
      if (!data.user.timezone) {
        await autoUpdateTimezone(token);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }

  async function autoUpdateTimezone(token: string) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { updateUserProfile } = await import("../lib/api");

      await updateUserProfile(token, { timezone });

      // Recargar perfil para reflejar el cambio
      const data = await getUserProfile(token);
      setProfile(data.user);

      console.log(`✓ Zona horaria configurada automáticamente: ${timezone}`);
    } catch (err) {
      console.error("Error auto-updating timezone:", err);
    }
  }

  function handleLogout() {
    clearToken();
    navigate("/");
    window.location.reload();
  }

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 2rem",
        background: "#1a1a1a",
        color: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      {/* Logo / Brand */}
      <Link
        to="/"
        style={{
          fontSize: "1.5rem",
          fontWeight: "bold",
          color: "white",
          textDecoration: "none",
        }}
      >
        ⚽ Quiniela
      </Link>

      {/* Navigation Links */}
      <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
        <Link
          to="/"
          style={{
            color: "white",
            textDecoration: "none",
            fontSize: "1rem",
            fontWeight: 500,
          }}
        >
          Mis Pools
        </Link>

        {/* User Menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              color: "white",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              {profile?.displayName?.charAt(0).toUpperCase() || "U"}
            </div>
            <span>{profile?.displayName || "Usuario"}</span>
            <span style={{ fontSize: "0.75rem" }}>▼</span>
          </button>

          {showUserMenu && (
            <>
              {/* Backdrop para cerrar el menú al hacer click fuera */}
              <div
                onClick={() => setShowUserMenu(false)}
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999,
                }}
              />

              {/* Dropdown Menu */}
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 0.5rem)",
                  right: 0,
                  background: "white",
                  color: "#333",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  minWidth: "200px",
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                {/* User Info */}
                <div
                  style={{
                    padding: "1rem",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                    {profile?.displayName}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#666" }}>
                    @{profile?.username}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.25rem" }}>
                    {profile?.email}
                  </div>
                </div>

                {/* Menu Items */}
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    display: "block",
                    padding: "0.75rem 1rem",
                    color: "#333",
                    textDecoration: "none",
                    borderBottom: "1px solid #eee",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  👤 Mi Perfil
                </Link>

                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "white",
                    border: "none",
                    color: "#d32f2f",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "1rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ffebee";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                  }}
                >
                  🚪 Cerrar Sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
