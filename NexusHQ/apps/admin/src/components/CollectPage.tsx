import CollectForm from "@/components/CollectForm";
import type { TestimonialKind } from "@/lib/database.types";

// Shared frame for the open (/kind-words) and personal (/kind-words/[token]) collection pages.
export default function CollectPage({ ownerName, ownerInitials, token, clientName, projectName, allowed, closed }: {
  ownerName: string; ownerInitials: string; token: string | null; clientName: string; projectName: string | null;
  allowed: TestimonialKind[]; closed?: string;
}) {
  const first = clientName.split(" ")[0];
  return (
    <div className="collect">
      <div className="wrap">
        <div className="hello">
          <div className="avatar">{ownerInitials}</div>
          <div>
            <div className="kicker">Kind words{ownerName ? ` for ${ownerName}` : ""}</div>
            <h1>{first ? `Hi ${first} — how was it working together?` : "How was it working together?"}</h1>
          </div>
        </div>
        {closed ? (
          <div className="card card-pad"><h2 style={{ fontSize: 20 }}>This link isn’t active</h2><p className="muted" style={{ marginTop: 6 }}>{closed}</p></div>
        ) : (
          <>
            <p className="muted">Thanks for taking a minute{projectName ? ` to talk about ${projectName}` : ""}. Pick whatever is easiest: a quick video, a voice note, or a few typed lines. You can review it before sending.</p>
            <CollectForm token={token} clientName={clientName} projectName={projectName} allowed={allowed} />
          </>
        )}
        <p className="foot-note">Your submission is reviewed before anything is published.</p>
      </div>
    </div>
  );
}
