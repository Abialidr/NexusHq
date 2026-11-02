import type { Metadata } from "next";
import Page from "@/components/motion/Page";
import ContactForm from "@/components/site/ContactForm";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const { profile } = await getPortfolioContent();
  const channels = [{ label: "Email", value: profile.email, url: `mailto:${profile.email}` }, ...profile.socials.map((s) => ({ label: s.label, value: s.url, url: s.url }))];

  return (
    <Page>
      <section className="grid g2" style={{ gap: 48, padding: "72px 0 56px", alignItems: "start" }}>
        <div className="stack" style={{ gap: 20 }}>
          <span className="kicker">Contact</span>
          <h1 className="h-page">{profile.contactHeadline || "Let’s build something together."}</h1>
          {profile.contactLead && <p className="lead">{profile.contactLead}</p>}
          {profile.contactReply && <p className="muted">{profile.contactReply}</p>}
          <div className="stack" style={{ gap: 10, marginTop: 8 }}>
            {channels.map((c) => (
              <a className="card contact-link" href={c.url} key={c.label}><span className="kicker">{c.label}</span><span>{c.value}</span></a>
            ))}
          </div>
        </div>
        {profile.contactFormEnabled && <ContactForm email={profile.email} />}
      </section>
    </Page>
  );
}
