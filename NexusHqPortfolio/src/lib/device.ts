"use client";

import { useEffect, useState } from "react";

// Phones and tablets: small screens, or touch-only devices of any size. The 3D café is too heavy
// for them (it can hang), so it is hidden and blocked there. Keep in sync with .desktop-only in globals.css.
export const MOBILE_QUERY = "(max-width: 900px), (hover: none) and (pointer: coarse)";

// null until mounted (the server cannot know the device), then true/false; follows resizes.
export function useIsMobile() {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}
