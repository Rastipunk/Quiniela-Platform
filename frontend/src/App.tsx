import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken, onAuthChange } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PoolPage } from "./pages/PoolPage";

function AuthedApp() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/pools/:poolId" element={<PoolPage />} />
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

  if (!isAuthed) {
    return <LoginPage onLoggedIn={() => setIsAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <AuthedApp />
    </BrowserRouter>
  );
}
