"use client";

// One printable resume page (roadmap H2/H3). The same sheet shows the base resume and a job-tailored one; printing
// hides the admin around it (globals.css @media print), so "Save as PDF" gives a clean file.
import Icon from "@/components/Icon";

export interface ResumeData {
  name: string; role: string; contact: string[]; headline: string; summary: string; skills: string[];
  experience: { role: string; company: string; period: string; bullets: string[] }[];
  projects: { name: string; line: string }[];
  education: { title: string; org: string; when: string }[];
}

export function PrintButton() {
  return <button className="btn primary" onClick={() => window.print()}><Icon name="text" /> Print / Save as PDF</button>;
}

export default function ResumeSheet({ data }: { data: ResumeData }) {
  return (
    <article className="resume-sheet">
      <header>
        <h2>{data.name}</h2>
        {data.role && <div className="resume-role">{data.role}</div>}
        {data.contact.length > 0 && <div className="resume-contact">{data.contact.join(" · ")}</div>}
      </header>
      {(data.headline || data.summary) && (
        <section>
          {data.headline && <p className="resume-headline">{data.headline}</p>}
          {data.summary && <p>{data.summary}</p>}
        </section>
      )}
      {data.skills.length > 0 && (
        <section><h3>Skills</h3><p>{data.skills.join(" · ")}</p></section>
      )}
      {data.experience.length > 0 && (
        <section>
          <h3>Experience</h3>
          {data.experience.map((e, i) => (
            <div className="resume-item" key={i}>
              <div className="resume-item-head"><b>{e.role}</b>{e.company && <span> · {e.company}</span>}<span className="resume-when">{e.period}</span></div>
              {e.bullets.length > 0 && <ul>{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
            </div>
          ))}
        </section>
      )}
      {data.projects.length > 0 && (
        <section>
          <h3>Projects</h3>
          {data.projects.map((p, i) => <p className="resume-project" key={i}><b>{p.name}</b>{p.line && <> — {p.line}</>}</p>)}
        </section>
      )}
      {data.education.length > 0 && (
        <section>
          <h3>Education</h3>
          {data.education.map((e, i) => (
            <div className="resume-item-head" key={i}><b>{e.title}</b>{e.org && <span> · {e.org}</span>}<span className="resume-when">{e.when}</span></div>
          ))}
        </section>
      )}
    </article>
  );
}
