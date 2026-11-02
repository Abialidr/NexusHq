"use client";

// Shared client UI: toast, slide-in drawer, modal and status chip.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2400);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={`toast ${show ? "show" : ""}`} role="status" aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
}

export function Drawer({ open, onClose, kicker, title, children, footer }: {
  open: boolean; onClose: () => void; kicker: string; title: string; children: ReactNode; footer: ReactNode;
}) {
  useEscape(open, onClose);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) setTimeout(() => closeRef.current?.focus(), 50); }, [open]);
  return (
    <>
      <div className={`scrim ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open}>
        {open && (
          <>
            <div className="drawer-head">
              <div><div className="kicker">{kicker}</div><h2>{title}</h2></div>
              <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
            </div>
            <div className="drawer-body">{children}</div>
            <div className="drawer-foot">{footer}</div>
          </>
        )}
      </aside>
    </>
  );
}

export function Modal({ open, onClose, kicker, title, children, footer }: {
  open: boolean; onClose: () => void; kicker: string; title: string; children: ReactNode; footer: ReactNode;
}) {
  useEscape(open, onClose);
  return (
    <>
      <div className={`scrim ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`modal ${open ? "open" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="box">
          {open && (
            <>
              <div className="drawer-head">
                <div><div className="kicker">{kicker}</div><h2>{title}</h2></div>
                <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ marginLeft: "auto" }}><Icon name="x" /></button>
              </div>
              <div className="drawer-body">{children}</div>
              <div className="drawer-foot">{footer}</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const STATUS_CLASS: Record<string, string> = {
  published: "pub", approved: "pub", submitted: "pub",
  draft: "draft", opened: "draft",
  pending: "pending",
};
export function Status({ value }: { value: string }) {
  const label = value === "approved" ? "Published" : value.charAt(0).toUpperCase() + value.slice(1);
  return <span className={`chip ${STATUS_CLASS[value] ?? "hidden"}`}>{label}</span>;
}
