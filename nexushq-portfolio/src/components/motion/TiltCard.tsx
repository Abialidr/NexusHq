"use client";

import { useRef } from "react";

// The hero portrait card: tilts a few degrees toward the cursor with a soft moving highlight.
export default function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (vars: Record<string, string>) => Object.entries(vars).forEach(([k, v]) => ref.current?.style.setProperty(k, v));

  return (
    <div
      ref={ref}
      className="hero-card"
      onPointerMove={(e) => {
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        set({ "--ry": `${((x - 0.5) * 10).toFixed(2)}deg`, "--rx": `${((0.5 - y) * 8).toFixed(2)}deg`, "--mx": `${(x * 100).toFixed(1)}%`, "--my": `${(y * 100).toFixed(1)}%` });
      }}
      onPointerLeave={() => set({ "--rx": "0deg", "--ry": "0deg" })}
    >
      <span className="shine" />
      {children}
    </div>
  );
}
