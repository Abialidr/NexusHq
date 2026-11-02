import type { Metadata } from "next";
import Page from "@/components/motion/Page";
import TestimonialCards from "@/components/site/TestimonialCards";
import TiltCard from "@/components/motion/TiltCard";
import AvailabilityTable from "@/components/site/AvailabilityTable";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const { profile, testimonials } = await getPortfolioContent();
  return (
    <Page>
      <section className="hero" style={{ paddingTop: 72 }}>
        <div className="stack" style={{ gap: 20 }}>
          <span className="kicker">About me</span>
          <h1 className="h-page">Hey, I am {profile.name}.</h1>
          <p className="lead">{profile.intro}</p>
          <div className="facts about-facts" style={{ marginTop: 8 }}>
            <div><span>Based in</span><b>{profile.location}</b></div>
            <div><span>Works</span><b>{profile.workMode}</b></div>
            {profile.currently && <div><span>Now</span><b>{profile.currently}</b></div>}
          </div>
        </div>
        <TiltCard>{profile.avatarUrl && <img src={profile.avatarUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</TiltCard>
      </section>

      <section className="section">
        <div className="prose" style={{ maxWidth: 760 }}>
          <h2 style={{ marginTop: 0 }}>My story</h2>
          {profile.story.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </section>

      <TestimonialCards items={testimonials} placement="about" />

      <AvailabilityTable />

      {profile.hobbies.length > 0 && <section className="section">
        <h2 className="h-sec" style={{ marginBottom: 8 }}>Off the clock</h2>
        <p className="muted" style={{ marginBottom: 24 }}>What I do when I am not shipping.</p>
        <div className="grid g3">
          {profile.hobbies.map((h, i) => (
            <div className="card" key={i}><span className="chip sage" style={{ alignSelf: "flex-start" }}>Hobby</span><h3 className="h-card">{h.title}</h3><p className="muted small">{h.body}</p></div>
          ))}
        </div>
      </section>}

      {profile.photos.length > 0 && <section className="section about-gallery">
        <h2 className="h-sec" style={{ marginBottom: 24 }}>Snapshots</h2>
        <div className="grid g3">
          {profile.photos.map((p, i) => (
            <figure className="stack" style={{ gap: 8 }} key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element -- photo URLs will come from Supabase storage */}
              {p.url ? <img className="figure" src={p.url} alt={p.caption} style={{ aspectRatio: "3/4", objectFit: "cover" }} /> : <div className="figure" style={{ aspectRatio: "3/4" }}>Photo {i + 1}</div>}
              <figcaption className="small muted">{p.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>} 
    </Page>
  );
}
