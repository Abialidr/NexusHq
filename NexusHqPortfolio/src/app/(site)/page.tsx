import Image from "next/image";
import Link from "next/link";
import EntryGateModal from "@/components/entry-gate/EntryGateModal";
import Page from "@/components/motion/Page";
import TestimonialCards from "@/components/site/TestimonialCards";
import WordReveal from "@/components/motion/WordReveal";
import TiltCard from "@/components/motion/TiltCard";
import CountUp from "@/components/motion/CountUp";
import ProjectCard from "@/components/site/ProjectCard";
import { getPortfolioContent } from "@/lib/content/get-portfolio-content";



export default async function HomePage() {
  const { profile, projects, experience, articles, testimonials } = await getPortfolioContent();
  const selected = [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)].slice(0, 3);
  const stack = profile.stack ?? [];
  const latest = articles[0];

  return (
    <>
      <EntryGateModal />
      <Page className="">
        <div className="wrap">
          <section className="hero">
            <div className="stack" style={{ gap: 24 }}>
              <div className="row"><span className="chip sage"><i className="dot" />{profile.availability}</span></div>
              <h1 className="h-hero" data-words><WordReveal lines={[`Hey, I am ${profile.name}.`, profile.headline]} /></h1>
              <p className="lead">{profile.intro}</p>
              <div className="row">
                <Link className="btn btn-primary" href="/projects">See my work <span className="arr">→</span></Link>
                <Link className="btn btn-ghost" href="/contact">Get in touch</Link>
              </div>
            </div>
            <TiltCard>
              {profile.avatarUrl && <img src={profile.avatarUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {profile.currently && <div className="badge"><i className="dot" /><span>Currently brewing <b>{profile.currently}</b></span></div>}
            </TiltCard>
          </section>

          {profile.stats.length > 0 && <section className="stats" aria-label="At a glance">
            {profile.stats.map((s) => (
              <div className="stat" key={s.label}><CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} /><span>{s.label}</span></div>
            ))}
          </section>}
        </div>

        <div className="marquee" aria-label="Tech I work with">
          <div className="marquee-track">
            {stack.map((t) => <span key={t}>{t}</span>)}
            {stack.map((t) => <span key={`${t}-2`} aria-hidden="true">{t}</span>)}
          </div>
        </div>

        <div className="wrap">
          <section className="section">
            <div className="row between" style={{ marginBottom: 28 }}><h2 className="h-sec">Selected projects</h2><Link className="link" href="/projects">All projects →</Link></div>
            <div className="grid g3">{selected.map((p) => <ProjectCard key={p.slug} project={p} />)}</div>
          </section>

          <section className="section grid g2" style={{ gap: 48 }}>
            <div className="stack" style={{ gap: 20 }}>
              <div className="row between"><h2 className="h-sec">Experience</h2><Link className="link" href="/experience">Full history →</Link></div>
              <div className="timeline">
                {experience.map((e) => (
                  <div className="tl-item" key={e.slug} style={{ gridTemplateColumns: "1fr", gap: 6, padding: "20px 0" }}>
                    <span className="tl-when">{e.from} — {e.to}</span><b>{e.role} · {e.company}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 20 }}>
              <div className="row between"><h2 className="h-sec">What I work with</h2><Link className="link" href="/skills">All skills →</Link></div>
              <div className="skill-list">{stack.slice(0, 9).map((s) => <span className="skill" key={s}><i />{s}</span>)}</div>
              {latest && (
                <Link className="card" href={`/articles/${latest.slug}`} style={{ marginTop: 8 }}>
                  <span className="kicker">Latest article</span><h3 className="h-card">{latest.title}</h3>
                  <p className="muted small">{latest.date} · {latest.readMinutes} min read</p><span className="arrow">Read it →</span>
                </Link>
              )}
            </div>
          </section>

          <TestimonialCards items={testimonials} placement="home" />

          <section className="section">
            <Link className="card cafe-card" href="/3d">
              <div className="cafe-shot">
                <Image src="/images/cafe-preview.jpg" alt="The 3D coffee & code café: the owner coding at the counter" fill sizes="(max-width: 900px) 100vw, 600px" />
                <span className="live"><i className="dot" />Live 3D</span>
              </div>
              <div className="cafe-body">
                <span className="kicker">The 3D version</span><h2 className="h-sec">Step into the café</h2>
                <p className="muted">The same portfolio as a little 3D coffee shop. Click the menu board for skills, the bookshelf for projects, or say hi to the barista.</p>
                <span className="arrow">Walk in →</span>
              </div>
            </Link>
          </section>

          <section className="section">
            <div className="band">
              <div className="steam" aria-hidden="true"><i /><i /><i /></div>
              <h2>Have a project in mind? Let’s talk over a coffee.</h2>
              <Link className="btn btn-primary" href="/contact">Start a conversation <span className="arr">→</span></Link>
            </div>
          </section>
        </div>
      </Page>
    </>
  );
}
