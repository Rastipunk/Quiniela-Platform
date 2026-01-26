import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { getToken, onAuthChange } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PoolPage } from "./pages/PoolPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ProfilePage } from "./pages/ProfilePage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { AdminEmailSettingsPage } from "./pages/AdminEmailSettingsPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { Layout } from "./components/Layout";

/**
 * Rutas que SIEMPRE deben ser accesibles, independientemente del estado de autenticación.
 * Esto incluye flujos de recuperación de contraseña que el usuario puede necesitar
 * incluso si tiene una sesión activa (ej: cambiar contraseña desde otro dispositivo).
 */
const AUTH_INDEPENDENT_ROUTES = ["/forgot-password", "/reset-password", "/terms", "/privacy", "/verify-email"];

/**
 * Componente para rutas protegidas (usuario autenticado)
 */
function AuthedApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/pools/:poolId" element={<PoolPage />} />
        <Route path="/admin/settings/email" element={<AdminEmailSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

/**
 * Componente para rutas públicas (usuario no autenticado)
 */
function PublicApp({ onLoggedIn }: { onLoggedIn: () => void }) {
  return (
    <Routes>
      <Route path="/" element={<LoginPage onLoggedIn={onLoggedIn} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Componente para rutas independientes de autenticación.
 * Estas rutas funcionan igual si el usuario está autenticado o no.
 */
function AuthIndependentRoutes() {
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
    </Routes>
  );
}

/**
 * Router principal que maneja la lógica de autenticación y rutas independientes.
 *
 * Arquitectura de rutas:
 * 1. Rutas independientes de auth (forgot-password, reset-password) → siempre accesibles
 * 2. Si autenticado → AuthedApp (dashboard, pools, profile)
 * 3. Si no autenticado → PublicApp (login)
 */
function AppRouter({ isAuthed, onLoggedIn }: { isAuthed: boolean; onLoggedIn: () => void }) {
  const location = useLocation();

  // Verificar si la ruta actual es independiente de autenticación
  const isAuthIndependentRoute = AUTH_INDEPENDENT_ROUTES.some(
    route => location.pathname === route || location.pathname.startsWith(route + "/")
  );

  // Si es una ruta independiente de auth, renderizarla sin importar el estado de autenticación
  if (isAuthIndependentRoute) {
    return <AuthIndependentRoutes />;
  }

  // Si no, usar la lógica normal de autenticación
  return isAuthed ? <AuthedApp /> : <PublicApp onLoggedIn={onLoggedIn} />;
}

export default function App() {
  const initial = useMemo(() => !!getToken(), []);
  const [isAuthed, setIsAuthed] = useState(initial);

  // ✅ Si api.ts detecta 401, hace logout() y dispara onAuthChange → volvemos a Login sin refresh manual
  useEffect(() => {
    return onAuthChange(() => setIsAuthed(!!getToken()));
  }, []);

  return (
    <BrowserRouter>
      <AppRouter isAuthed={isAuthed} onLoggedIn={() => setIsAuthed(true)} />
    </BrowserRouter>
  );
}
