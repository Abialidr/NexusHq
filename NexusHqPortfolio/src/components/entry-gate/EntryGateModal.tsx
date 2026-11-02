"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./EntryGateModal.module.css";

const VISITOR_KEY = "nexushq_visitor";

type Mode = "3D" | "2D";

type StoredVisitor = { name: string; email: string };

type Errors = { name?: string; email?: string; mode?: string };

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function EntryGateModal() {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [hasMounted, setHasMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [knownVisitor, setKnownVisitor] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    try {
      const storedVisitor = localStorage.getItem(VISITOR_KEY);
      if (storedVisitor) {
        const parsed = JSON.parse(storedVisitor) as Partial<StoredVisitor> | null;
        if (typeof parsed?.name === "string" && parsed.name.trim() && typeof parsed.email === "string" && EMAIL_PATTERN.test(parsed.email.trim())) {
          setName(parsed.name);
          setEmail(parsed.email);
          setKnownVisitor(true);
        }
      }
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    (nameInputRef.current ?? closeRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    // the 2D site is already rendered behind the modal; keep it still until a choice is made
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [visible]);

  if (!hasMounted || !visible) return null;

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = "Please enter your name";
    if (!email.trim() || !EMAIL_PATTERN.test(email.trim())) next.email = "Please enter a valid email";
    if (!mode) next.mode = "Choose how you'd like to explore";
    return next;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !mode) return;

    try {
      localStorage.setItem(VISITOR_KEY, JSON.stringify({ name: name.trim(), email: email.trim() }));
    } catch {
      // storage unavailable — proceed without persisting
    }

    // 2D: the site is already here behind the modal, so just reveal it
    if (mode === "3D") router.push("/3d");
    else setVisible(false);
  };

  const isDisabled = !name.trim() || !email.trim() || !mode;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="entry-gate-title">
      <div className={styles.panel} ref={panelRef}>
        <button ref={closeRef} type="button" className={styles.closeButton} aria-label="Close experience chooser" onClick={() => setVisible(false)}>✕</button>
        <p className={styles.eyebrow}>coffee &amp; code · Enter the portfolio</p>
        <h2 id="entry-gate-title" className={styles.title}>
          {knownVisitor ? "Welcome back. How would you like to explore?" : "A couple of details before you explore."}
        </h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {!knownVisitor && <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="entry-gate-name">Name</label>
            <input
              ref={nameInputRef}
              id="entry-gate-name"
              className={styles.input}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            {errors.name ? <p className={styles.errorText}>{errors.name}</p> : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="entry-gate-email">Email</label>
            <input
              id="entry-gate-email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            {errors.email ? <p className={styles.errorText}>{errors.email}</p> : null}
          </div>
          </>}
          <div className={styles.field} role="group" aria-label="Choose your experience">
            <span className={styles.label}>Choose your experience</span>
            <div className={styles.modeGroup}>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === "3D" ? styles.modeButtonActive : ""}`}
                aria-pressed={mode === "3D"}
                onClick={() => setMode("3D")}
              >
                <b>Enter in 3D</b>
                <span>Walk into the coffee shop</span>
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === "2D" ? styles.modeButtonActive : ""}`}
                aria-pressed={mode === "2D"}
                onClick={() => setMode("2D")}
              >
                <b>Explore in 2D</b>
                <span>Fast and easy to scan</span>
              </button>
            </div>
            {errors.mode ? <p className={styles.errorText}>{errors.mode}</p> : null}
          </div>
          <button type="submit" className={styles.submitButton} disabled={isDisabled}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
