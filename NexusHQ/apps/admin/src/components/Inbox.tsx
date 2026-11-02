"use client";

import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Drawer, useToast } from "@/components/ui";
import type { Row } from "@/lib/database.types";
import { deleteMessage, setMessageRead } from "@/app/actions";

// Contact-form messages from the public site. Opening one marks it read.
export default function Inbox({ messages }: { messages: Row<"contact_messages">[] }) {
  const toast = useToast();
  const [open, setOpen] = useState<Row<"contact_messages"> | null>(null);
  const [pending, start] = useTransition();

  const view = (m: Row<"contact_messages">) => {
    setOpen(m);
    if (!m.read_at) start(async () => { await setMessageRead(m.id, true); });
  };

  return (
    <>
      <div className="page-head"><div><div className="kicker">Inbox</div><h1>Contact messages</h1><p>Messages sent from the Contact page form.</p></div></div>
      <div className="card">
        {messages.length ? (
          <table>
            <thead><tr><th>From</th><th>Message</th><th className="hide-sm">Received</th></tr></thead>
            <tbody>{messages.map((m) => (
              <tr key={m.id} onClick={() => view(m)} style={{ fontWeight: m.read_at ? 400 : 600 }}>
                <td><div className="cell-main"><b>{m.name}</b><small>{m.email}</small></div></td>
                <td><span className={m.read_at ? "muted" : ""} style={{ display: "block", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.message}</span></td>
                <td className="hide-sm muted">{new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="empty"><Icon name="mail" /><h2 style={{ fontSize: 18, margin: "10px 0 6px" }}>No messages yet</h2><p>When the portfolio’s contact form sends to Supabase, messages land here.</p></div>}
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} kicker="Contact message" title={open?.name ?? ""}
        footer={<>
          <button className="btn ghost danger sm" disabled={pending} onClick={() => open && confirm("Delete this message?") && start(async () => { await deleteMessage(open.id); toast("Deleted"); setOpen(null); })}><Icon name="trash" /> Delete</button>
          <button className="btn ghost sm" disabled={pending} onClick={() => open && start(async () => { await setMessageRead(open.id, false); toast("Marked unread"); setOpen(null); })}>Mark unread</button>
          <span className="spacer" />
          {open && <a className="btn primary sm" href={`mailto:${open.email}?subject=${encodeURIComponent("Re: your message")}`}><Icon name="mail" /> Reply</a>}
        </>}>
        {open && (
          <>
            <div className="muted">{open.email} · {new Date(open.created_at).toLocaleString("en-GB")}</div>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 15 }}>{open.message}</p>
          </>
        )}
      </Drawer>
    </>
  );
}
