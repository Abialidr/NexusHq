"use client";

// Public testimonial form (no sign-in). Records video or audio in the browser with MediaRecorder (or takes an
// uploaded file), uploads it to the private testimonial-uploads bucket under incoming/, then inserts a Pending row.
// RLS only allows exactly that: pending, unplaced, and either the open link is on or the request token is valid.
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";

type Kind = "video" | "audio" | "text";
const MAX_SECONDS = 120;

function extFor(type: string) {
  if (type.includes("mp4")) return "mp4";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("wav")) return "wav";
  return "webm";
}

export default function CollectForm({ token, clientName, projectName, allowed }: {
  token: string | null; clientName: string; projectName: string | null; allowed: Kind[];
}) {
  const [kind, setKind] = useState<Kind>(allowed[0] ?? "text");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [camError, setCamError] = useState("");
  const [text, setText] = useState("");
  const [name, setName] = useState(clientName);
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(5);
  const [consent, setConsent] = useState(true);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const stopStream = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { stopStream(); clearInterval(timer.current); }, []);
  useEffect(() => { reset(); stopStream(); setCamError(""); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(null); setBlobUrl(""); setDuration(0); setElapsed(0);
  }
  function pickFile(f?: File | null) {
    if (!f) return;
    reset();
    setBlob(f);
    setBlobUrl(URL.createObjectURL(f));
  }

  async function start() {
    setCamError("");
    reset();
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === "video" ? { video: { width: 1280, height: 720 }, audio: true } : { audio: true });
      stream.current = s;
      if (live.current && kind === "video") { live.current.srcObject = s; live.current.muted = true; await live.current.play().catch(() => {}); }
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(s);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunks, { type: rec.mimeType || (kind === "video" ? "video/webm" : "audio/webm") });
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
        stopStream();
      };
      recorder.current = rec;
      rec.start(1000);
      setRecording(true);
      const t0 = Date.now();
      timer.current = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000);
        setElapsed(sec);
        if (sec >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setCamError(kind === "video" ? "Camera or microphone access was blocked. Allow it in your browser, or upload a video instead." : "Microphone access was blocked. Allow it in your browser, or upload a file instead.");
    }
  }
  function stop() {
    clearInterval(timer.current);
    setDuration((d) => d || elapsedRef.current);
    recorder.current?.state === "recording" && recorder.current.stop();
    setRecording(false);
  }
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  async function submit() {
    setError("");
    if (!name.trim()) return setError("Please add your name.");
    if (kind === "text" && text.trim().length < 10) return setError("Please write a few words.");
    if (kind !== "text" && !blob) return setError(`Please record or upload your ${kind === "video" ? "video" : "voice note"} first.`);
    setBusy(true);
    const supabase = createClient();
    const upload = async (b: Blob, type: string) => {
      const path = `incoming/${crypto.randomUUID()}.${extFor(type)}`;
      const { error } = await supabase.storage.from("testimonial-uploads").upload(path, b, { contentType: type });
      if (error) throw new Error(error.message);
      return path;
    };
    try {
      const media_path = blob && kind !== "text" ? await upload(blob, blob.type || "video/webm") : null;
      const avatar_path = avatar ? await upload(avatar, avatar.type) : null;
      const { error } = await supabase.from("testimonials").insert({
        name: name.trim(), role: role.trim(), kind,
        quote: kind === "text" ? text.trim() : "",
        media_path, avatar_path, rating, consent,
        duration_s: kind === "text" ? null : Math.min(600, duration || elapsedRef.current || 0) || null,
        source: token ? "request" : "open", request_id: token,
      });
      if (error) throw new Error(error.message.includes("row-level security") ? "This link is no longer accepting testimonials." : error.message);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "36px 20px" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--sage-soft)", color: "var(--sage)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="check" /></div>
        <h2 style={{ fontSize: 24 }}>Thank you{name ? `, ${name.split(" ")[0]}` : ""}!</h2>
        <p className="muted" style={{ marginTop: 6 }}>Your words are on their way. They are reviewed before anything goes live.</p>
      </div>
    );
  }

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const MODES: Record<Kind, [string, string, string]> = { video: ["video", "Video", "up to 2 min"], audio: ["mic", "Voice note", "up to 2 min"], text: ["text", "Write", "a few lines"] };

  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {allowed.length > 1 && (
        <div className="modes" role="group" aria-label="Testimonial format">
          {allowed.map((k) => (
            <button key={k} type="button" className="mode" aria-pressed={kind === k} onClick={() => !recording && setKind(k)}>
              <Icon name={MODES[k][0]} /><b>{MODES[k][1]}</b><small>{MODES[k][2]}</small>
            </button>
          ))}
        </div>
      )}

      <div className="prompts"><b>Need a nudge?</b><span>• What problem were you trying to solve?</span><span>• What was it like working together?</span><span>• What changed afterwards?</span></div>

      {kind === "video" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className={`rec ${recording ? "live" : ""}`}>
            {blobUrl ? <video src={blobUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <video ref={live} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: recording ? "block" : "none" }} />}
            {!blobUrl && <>
              {!recording && <span className="tip">Find good light and look at the lens. Up to 2 minutes.</span>}
              <button type="button" className="rec-btn" aria-label={recording ? "Stop recording" : "Start recording"} onClick={recording ? stop : start}><i /></button>
              <span className="timer">{mm(elapsed)} / {mm(MAX_SECONDS)}</span>
            </>}
          </div>
          <div className="row-flex" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {blobUrl && <button type="button" className="btn sm" onClick={reset}>Record again</button>}
            <label className="btn sm ghost" style={{ position: "relative" }}>Upload a video instead<input type="file" accept="video/*" style={{ position: "absolute", inset: 0, opacity: 0 }} onChange={(e) => pickFile(e.target.files?.[0])} /></label>
          </div>
        </div>
      )}

      {kind === "audio" && (
        <div className="mic-stage">
          {blobUrl ? <audio src={blobUrl} controls style={{ width: "100%" }} /> : (
            <button type="button" className="big-mic" aria-label={recording ? "Stop recording" : "Start recording"} onClick={recording ? stop : start}
              style={recording ? { background: "#e05a47" } : undefined}><Icon name={recording ? "x" : "mic"} /></button>
          )}
          <span className="mono faint">{blobUrl ? "Listen back before sending" : recording ? `Recording · ${mm(elapsed)} — tap to stop` : "Tap to record"}</span>
          <div className="row-flex" style={{ gap: 8 }}>
            {blobUrl && <button type="button" className="btn sm" onClick={reset}>Record again</button>}
            <label className="btn sm ghost" style={{ position: "relative" }}>Upload an audio file instead<input type="file" accept="audio/*" style={{ position: "absolute", inset: 0, opacity: 0 }} onChange={(e) => pickFile(e.target.files?.[0])} /></label>
          </div>
        </div>
      )}

      {kind === "text" && (
        <div className="field"><label htmlFor="tx">Your testimonial</label>
          <textarea id="tx" style={{ minHeight: 150 }} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Working together was…" />
          <span className="hint">2–5 sentences is perfect.</span></div>
      )}
      {camError && <p className="err">{camError}</p>}

      <div className="fields">
        <div className="field"><label htmlFor="nm">Your name *</label><input id="nm" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="rl">Role & company</label><input id="rl" maxLength={160} value={role} onChange={(e) => setRole(e.target.value)} placeholder={projectName ? `e.g. Founder, ${projectName}` : "e.g. Founder, Acme"} /></div>
        <div className="field full"><label>Rating</label>
          <div className="rate" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>{n <= rating ? "★" : "☆"}</button>)}
          </div></div>
        <div className="field full"><label>Photo (optional)</label>
          <label className="drop" style={{ padding: 14 }}><b>{avatar ? avatar.name : "Add a headshot"}</b><span className="faint">or your initials are used</span>
            <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} /></label></div>
        <div className="field full"><label className="toggle"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> You may show this on the website with my name</label></div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="button" className="btn primary" style={{ justifyContent: "center", padding: 12 }} disabled={busy || recording} onClick={submit}>
        {busy ? "Sending…" : "Send testimonial"}
      </button>
    </div>
  );
}
