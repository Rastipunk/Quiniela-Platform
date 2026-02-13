"use client";

// Hook para detectar viewport movil con soporte para SSR
import { useState, useEffect } from "react";

export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  tabletLg: 1024,
  desktop: 1280,
} as const;

export const TOUCH_TARGET = {
  minimum: 44,
  comfortable: 48,
} as const;

type UseIsMobileOptions = {
  breakpoint?: number;
  defaultValue?: boolean;
};

export function useIsMobile(options: UseIsMobileOptions = {}): boolean {
  const { breakpoint = BREAKPOINTS.mobile, defaultValue = false } = options;

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < breakpoint;
    }
    return defaultValue;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    handleChange(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [breakpoint]);

  return isMobile;
}

export function useIsTablet(): boolean {
  const isNotMobile = !useIsMobile({ breakpoint: BREAKPOINTS.mobile });
  const isNotDesktop = useIsMobile({ breakpoint: BREAKPOINTS.tabletLg });
  return isNotMobile && isNotDesktop;
}

export function useDeviceType(): "mobile" | "tablet" | "desktop" {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}

export const mobileInteractiveStyles = {
  touchTarget: {
    minHeight: TOUCH_TARGET.minimum,
    minWidth: TOUCH_TARGET.minimum,
  },
  touchTargetComfortable: {
    minHeight: TOUCH_TARGET.comfortable,
    minWidth: TOUCH_TARGET.comfortable,
  },
  tapHighlight: {
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation" as const,
  },
  touchFeedback: {
    transition: "transform 0.1s ease, opacity 0.1s ease",
  },
} as const;
