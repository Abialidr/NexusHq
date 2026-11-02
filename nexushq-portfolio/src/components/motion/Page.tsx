import { ViewTransition } from "react";

// Wraps a page's content so route changes fade the old page out and rise the new one in
// (CSS .page-out / .page-in in globals.css). It lives in each page, not the layout, because
// layouts persist across navigations and would never enter or exit.
export default function Page({ children, className = "wrap" }: { children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}
