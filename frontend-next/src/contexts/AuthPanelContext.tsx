"use client";

import { createContext, useContext } from "react";

interface AuthPanelContextType {
  openAuthPanel: (mode?: "login" | "register", redirectTo?: string) => void;
}

export const AuthPanelContext = createContext<AuthPanelContextType>({
  openAuthPanel: () => {},
});

export function useAuthPanel() {
  return useContext(AuthPanelContext);
}
