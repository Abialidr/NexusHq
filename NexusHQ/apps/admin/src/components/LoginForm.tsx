"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="next" value={next} />
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn primary" style={{ justifyContent: "center", padding: 12 }} disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
