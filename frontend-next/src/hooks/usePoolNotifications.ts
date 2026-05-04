"use client";

// Hook para obtener notificaciones de una pool con polling
import { useState, useEffect, useCallback, useRef } from "react";
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

  // Ref to store the latest poolId for the manual refetch function
  const poolIdRef = useRef(poolId);
  poolIdRef.current = poolId;

  // Manual refetch (not used as a dependency)
  const refetch = useCallback(async () => {
    const currentPoolId = poolIdRef.current;
    if (!currentPoolId) return;

    const token = getToken();
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await getPoolNotifications(token, currentPoolId);
      setNotifications(data);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError(err.message || "Error obteniendo notificaciones");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch inicial + polling — inline fetch with cancelled flag
  useEffect(() => {
    if (!enabled || !poolId) return;

    let cancelled = false;

    const fetchData = async () => {
      const token = getToken();
      if (!token || cancelled) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await getPoolNotifications(token, poolId);
        if (!cancelled) setNotifications(data);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error fetching notifications:", err);
          setError(err.message || "Error obteniendo notificaciones");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();

    const interval = pollingInterval > 0
      ? setInterval(fetchData, pollingInterval)
      : undefined;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [enabled, poolId, pollingInterval]);

  return {
    notifications,
    isLoading,
    error,
    refetch,
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
      jugadores: 0,
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

    // Tab Jugadores: solicitudes pendientes (mover-aquí desde Admin —
    // es el lugar natural donde el host gestiona miembros, así no tiene
    // que ir al tab Admin sólo para aprobar a alguien).
    jugadores: notifications.pendingJoins,

    // Tab Admin: fases listas para avanzar (lo de aprobar miembros
    // vive ahora en Jugadores).
    admin: notifications.phasesReadyToAdvance.length,
  };
}

// Helper para determinar si hay deadlines urgentes (< 24h)
export function hasUrgentDeadlines(notifications: PoolNotifications | null): boolean {
  return (notifications?.urgentDeadlines?.length ?? 0) > 0;
}
