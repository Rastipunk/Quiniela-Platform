// Hook para detectar viewport móvil con soporte para SSR
// Sprint 3 - Mobile UX Improvements

import { useState, useEffect } from "react";

// Breakpoints consistentes con estándares de diseño móvil
export const BREAKPOINTS = {
  mobile: 640,      // Móvil estándar (max-width para mobile-first)
  tablet: 768,      // Tablets pequeñas
  tabletLg: 1024,   // Tablets grandes / laptops pequeñas
  desktop: 1280,    // Desktop estándar
} as const;

// Touch target mínimo según WCAG 2.1 y Material Design guidelines
export const TOUCH_TARGET = {
  minimum: 44,      // 44x44px mínimo para accesibilidad
  comfortable: 48,  // 48x48px recomendado para mejor UX
} as const;

type UseIsMobileOptions = {
  // Breakpoint personalizado (default: 640px)
  breakpoint?: number;
  // Valor inicial para SSR (default: false - asume desktop)
  defaultValue?: boolean;
};

/**
 * Hook para detectar si el viewport es móvil
 *
 * @example
 * const isMobile = useIsMobile();
 * const isTablet = useIsMobile({ breakpoint: BREAKPOINTS.tablet });
 *
 * return (
 *   <div style={{ padding: isMobile ? 12 : 24 }}>
 *     {isMobile ? <MobileView /> : <DesktopView />}
 *   </div>
 * );
 */
export function useIsMobile(options: UseIsMobileOptions = {}): boolean {
  const { breakpoint = BREAKPOINTS.mobile, defaultValue = false } = options;

  // Inicializar con valor por defecto (SSR-safe)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Check if window is available (client-side)
    if (typeof window !== "undefined") {
      return window.innerWidth < breakpoint;
    }
    return defaultValue;
  });

  useEffect(() => {
    // Guard para SSR
    if (typeof window === "undefined") return;

    // Handler optimizado con matchMedia para mejor performance
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Set initial value
    handleChange(mediaQuery);

    // Modern API: addEventListener (Safari 14+, todos los demás navegadores modernos)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Fallback para navegadores más antiguos
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook para detectar si el viewport es tablet
 */
export function useIsTablet(): boolean {
  const isNotMobile = !useIsMobile({ breakpoint: BREAKPOINTS.mobile });
  const isNotDesktop = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });
  return isNotMobile && isNotDesktop;
}

/**
 * Hook que retorna el tipo de dispositivo actual
 */
export function useDeviceType(): "mobile" | "tablet" | "desktop" {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}

/**
 * Hook para detectar capacidad táctil del dispositivo
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkTouch = () => {
      setIsTouch(
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - msMaxTouchPoints es para IE/Edge legacy
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouch();
  }, []);

  return isTouch;
}

/**
 * Estilos base para elementos interactivos en móvil
 * Aplicar a botones, inputs, y elementos clickeables
 */
export const mobileInteractiveStyles = {
  // Touch targets accesibles
  touchTarget: {
    minHeight: TOUCH_TARGET.minimum,
    minWidth: TOUCH_TARGET.minimum,
  },

  // Touch target cómodo
  touchTargetComfortable: {
    minHeight: TOUCH_TARGET.comfortable,
    minWidth: TOUCH_TARGET.comfortable,
  },

  // Eliminar delay de 300ms en tap
  tapHighlight: {
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },

  // Feedback visual en touch
  touchFeedback: {
    transition: "transform 0.1s ease, opacity 0.1s ease",
  },
} as const;
