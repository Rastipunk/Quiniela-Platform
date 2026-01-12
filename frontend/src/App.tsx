import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken, onAuthChange } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PoolPage } from "./pages/PoolPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Layout } from "./components/Layout";

function AuthedApp() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/pools/:poolId" element={<PoolPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function PublicApp({ onLoggedIn }: { onLoggedIn: () => void }) {
  return (
    <Routes>
      <Route path="/" element={<LoginPage onLoggedIn={onLoggedIn} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
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
      {isAuthed ? <AuthedApp /> : <PublicApp onLoggedIn={() => setIsAuthed(true)} />}
    </BrowserRouter>
  );
}
