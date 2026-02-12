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
import { LandingPage } from "./pages/LandingPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { FAQPage } from "./pages/FAQPage";
import { Layout } from "./components/Layout";
import { PublicLayout } from "./components/PublicLayout";
import { BetaFeedbackBar } from "./components/BetaFeedbackBar";

/**
 * Rutas que SIEMPRE deben ser accesibles, independientemente del estado de autenticación.
 * Esto incluye flujos de recuperación de contraseña y páginas legales.
 */
const ALWAYS_INDEPENDENT_ROUTES = [
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/verify-email",
];

/**
 * Rutas de auth que no tienen sentido cuando el usuario ya está autenticado.
 * Si el usuario está autenticado y navega a estas, redirigir a dashboard.
 */
const AUTH_ONLY_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
];

/**
 * Rutas de contenido público que se renderizan en PublicLayout cuando no autenticado,
 * pero en Layout (con NavBar) cuando autenticado.
 */
const PUBLIC_CONTENT_ROUTES = [
  "/how-it-works",
  "/faq",
  "/login",
];

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
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
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
    <PublicLayout onLoggedIn={onLoggedIn}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicLayout>
  );
}

/**
 * Componente para rutas independientes de autenticación.
 * Estas rutas funcionan igual si el usuario está autenticado o no.
 */
function AuthIndependentRoutes({ onLoggedIn }: { onLoggedIn: () => void }) {
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/login" element={<LoginPage onLoggedIn={onLoggedIn} />} />
      <Route
        path="/how-it-works"
        element={
          <PublicLayout onLoggedIn={onLoggedIn}>
            <HowItWorksPage />
          </PublicLayout>
        }
      />
      <Route
        path="/faq"
        element={
          <PublicLayout onLoggedIn={onLoggedIn}>
            <FAQPage />
          </PublicLayout>
        }
      />
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
  const path = location.pathname;

  // Si el usuario está autenticado y está en una ruta de auth (login, forgot-password, etc.), redirigir a dashboard
  if (isAuthed && AUTH_ONLY_ROUTES.some(r => path === r || path.startsWith(r + "/"))) {
    return <Navigate to="/" replace />;
  }

  // Rutas siempre independientes (terms, privacy, verify-email): renderizan sin importar auth
  const isAlwaysIndependent = ALWAYS_INDEPENDENT_ROUTES.some(
    r => path === r || path.startsWith(r + "/")
  );
  if (isAlwaysIndependent) {
    return <AuthIndependentRoutes onLoggedIn={onLoggedIn} />;
  }

  // Si autenticado: AuthedApp maneja todo (incluyendo /faq, /how-it-works con NavBar)
  if (isAuthed) {
    return <AuthedApp />;
  }

  // No autenticado: rutas de contenido público van a AuthIndependentRoutes (con PublicLayout)
  const isPublicContent = PUBLIC_CONTENT_ROUTES.some(
    r => path === r || path.startsWith(r + "/")
  );
  if (isPublicContent) {
    return <AuthIndependentRoutes onLoggedIn={onLoggedIn} />;
  }

  // Todo lo demás: PublicApp (landing page)
  return <PublicApp onLoggedIn={onLoggedIn} />;
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
      <BetaFeedbackBar />
      <AppRouter isAuthed={isAuthed} onLoggedIn={() => setIsAuthed(true)} />
    </BrowserRouter>
  );
}
