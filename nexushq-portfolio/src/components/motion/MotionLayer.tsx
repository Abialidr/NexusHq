"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Scroll reveals use Web Animations without changing React-owned DOM attributes.
// This layout-level component may mount before streamed page boundaries hydrate.
const REVEAL = ".page-head > *, .card, .tl-item, .list-row, .figure, .band, .stat, .section > h2, .section > .row, .facts, .prose > *, .marquee";

export default function MotionLayer() {
  const pathname = usePathname();

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
    const main = document.getElementById("main");
    if (!main) return;
    const delays = new WeakMap<Element, number>();
    const animations = new Set<Animation>();
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const animation = entry.target.animate(
          [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 700, delay: delays.get(entry.target) ?? 0, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" },
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
        io.unobserve(entry.target);
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const observed = new WeakSet<Element>();
    const observeTargets = () => main.querySelectorAll<HTMLElement>(REVEAL).forEach((element) => {
      if (observed.has(element)) return;
      if (element.closest(".hero, [data-words]")) return;
      // Avoid animating descendants of an already selected reveal target.
      if (element.parentElement?.closest(REVEAL)) return;
      const siblings = [...(element.parentElement?.children ?? [])].filter((child) => child.matches(REVEAL));
      delays.set(element, Math.min(6, siblings.indexOf(element)) * 70);
      observed.add(element);
      io.observe(element);
    });
    observeTargets();
    const changes = new MutationObserver(observeTargets);
    changes.observe(main, { childList: true, subtree: true });
    return () => {
      changes.disconnect();
      io.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [pathname]);

  return null;
}
