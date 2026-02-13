"use client";

import { useState, useEffect } from "react";
import { getToken, onAuthChange } from "../lib/auth";

type UseAuthReturn = {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial check
    setToken(getToken());
    setIsLoading(false);

    // Listen for auth changes (login/logout)
    const unsub = onAuthChange(() => {
      setToken(getToken());
    });

    return unsub;
  }, []);

  return {
    token,
    isLoading,
    isAuthenticated: !!token,
  };
}
