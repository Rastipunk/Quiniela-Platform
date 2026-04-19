"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackMetaEvent } from "@/lib/metaPixel";

const CONSENT_KEY = "p4a_cookie_consent";

export function MetaPixelPageView() {
  const pathname = usePathname();
  const prev = useRef(pathname);

  useEffect(() => {
    if (pathname === prev.current) return;
    prev.current = pathname;

    if (typeof window === "undefined") return;
    if (localStorage.getItem(CONSENT_KEY) !== "granted") return;

    trackMetaEvent("PageView");
  }, [pathname]);

  return null;
}
