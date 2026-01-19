// Hook para obtener notificaciones de una pool con polling
// Sprint 3 - Sistema de Notificaciones

import { useState, useEffect, useCallback } from "react";
import { getPoolNotifications, type PoolNotifications } from "../lib/api";
import { getToken } from "../lib/auth";

type UsePoolNotificationsOptions = {
  // Intervalo de polling en milisegundos (default: 60 segundos)
  pollingInterval?: number;
  // Si es false, no hace polling automático
  enabled?: boolean;
};

type UsePoolNotificationsReturn = {
  notifications: PoolNotifications | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function usePoolNotifications(
  poolId: string | undefined,
  options: UsePoolNotificationsOptions = {}
): UsePoolNotificationsReturn {
  const { pollingInterval = 60000, enabled = true } = options;

  const [notifications, setNotifications] = useState<PoolNotifications | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!poolId) return;

    const token = getToken();
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await getPoolNotifications(token, poolId);
      setNotifications(data);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError(err.message || "Error obteniendo notificaciones");
    } finally {
      setIsLoading(false);
    }
  }, [poolId]);

  // Fetch inicial
  useEffect(() => {
    if (enabled && poolId) {
      fetchNotifications();
    }
  }, [enabled, poolId, fetchNotifications]);

  // Polling
  useEffect(() => {
    if (!enabled || !poolId || pollingInterval <= 0) return;

    const interval = setInterval(fetchNotifications, pollingInterval);

    return () => clearInterval(interval);
  }, [enabled, poolId, pollingInterval, fetchNotifications]);

  return {
    notifications,
    isLoading,
    error,
    refetch: fetchNotifications,
  };
}

// Helper para calcular totales de badges por tab
export function calculateTabBadges(notifications: PoolNotifications | null) {
  if (!notifications) {
    return {
      partidos: 0,
      leaderboard: 0,
      reglas: 0,
      resumen: 0,
      admin: 0,
    };
  }

  return {
    // Tab Partidos: picks pendientes + resultados pendientes (si es host)
    partidos: notifications.pendingPicks + (notifications.isHostOrCoAdmin ? notifications.pendingResults : 0),

    // Tab Leaderboard: sin badges por ahora
    leaderboard: 0,

    // Tab Reglas: sin badges
    reglas: 0,

    // Tab Resumen: sin badges
    resumen: 0,

    // Tab Admin: solicitudes pendientes + fases listas
    admin: notifications.pendingJoins + notifications.phasesReadyToAdvance.length,
  };
}

// Helper para determinar si hay deadlines urgentes (< 24h)
export function hasUrgentDeadlines(notifications: PoolNotifications | null): boolean {
  return (notifications?.urgentDeadlines?.length ?? 0) > 0;
}
