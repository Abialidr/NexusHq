"use client";

import { useState } from "react";

// Until NexusHQ has a server-side messages endpoint (see ARCHITECTURE.md §9), sending opens
// the visitor's email app with the message filled in.
export default function ContactForm({ email }: { email: string }) {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const subject = `${f.get("topic")} — from ${f.get("name")}`;
    const body = `${f.get("message")}\n\n${f.get("name")} · ${f.get("from")}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <form className="card" style={{ padding: 28, gap: 16 }} onSubmit={onSubmit}>
      <h2 className="h-card">Send a message</h2>
      <div className="grid g2" style={{ gap: 12 }}>
        <div className="field"><label htmlFor="cf-name">Name</label><input className="input" id="cf-name" name="name" placeholder="Your name" required autoComplete="name" /></div>
        <div className="field"><label htmlFor="cf-from">Email</label><input className="input" id="cf-from" name="from" type="email" placeholder="you@company.com" required autoComplete="email" /></div>
      </div>
      <div className="field">
        <label htmlFor="cf-topic">What is it about?</label>
        <select className="input" id="cf-topic" name="topic"><option>A freelance project</option><option>A full-time role</option><option>Just saying hi</option></select>
      </div>
      <div className="field"><label htmlFor="cf-msg">Message</label><textarea className="input" id="cf-msg" name="message" placeholder="Tell me a little about it…" required /></div>
      <div className="row">
        <button className="btn btn-primary" type="submit">Send message <span className="arr">→</span></button>
        {sent && <span className="form-note" role="status">Your email app should open with the message ready to send.</span>}
      </div>
    </form>
  );
}
