// Shapes of the public portfolio content. Today they are filled from local placeholder data
// (lib/content/get-portfolio-content.ts); later from NexusHQ's published Supabase views.

export interface Link {
  label: string;
  url: string;
}

export interface PortfolioProfile {
  name: string;
  role: string;
  headline: string;
  intro: string;
  story: string[];
  location: string;
  workMode: string;
  currently: string;
  availability: string;
  email: string;
  stack?: string[];
  contactHeadline?: string;
  contactLead?: string;
  contactReply?: string;
  contactFormEnabled?: boolean;
  avatarUrl?: string;
  resumeUrl?: string;
  socials: Link[];
  stats: Array<{ value: number; prefix?: string; suffix?: string; label: string }>;
  principles: Array<{ title: string; body: string }>;
  hobbies: Array<{ title: string; body: string }>;
  photos: Array<{ url?: string; caption: string }>;
}

export interface PortfolioProject {
  slug: string;
  name: string;
  kind: string;
  category: "web" | "ai" | "platform";
  year: string;
  summary: string;
  featured: boolean;
  coverImageUrl?: string;
  media?: Array<{ kind: "image" | "video"; url: string; label: string }>;
  skills: string[];
  links: Link[];
  role: string;
  timeline: string;
  team: string;
  problem: string;
  built: string;
  decisions: string[];
  quote?: string;
  results: string;
}

export interface PortfolioExperience {
  slug: string;
  role: string;
  company: string;
  from: string;
  to: string;
  place: string;
  type: string;
  summary: string;
  highlights: string[];
  skills: string[];
}

export interface PortfolioEducation {
  title: string;
  org: string;
  when: string;
  subjects: string[];
}

export interface PortfolioSkillGroup {
  title: string;
  skills: string[];
}

export interface PortfolioOpenSource {
  name: string;
  relation: string;
  summary: string;
  badge: string;
  url: string;
}

export interface PortfolioArticle {
  slug: string;
  title: string;
  date: string;
  readMinutes: number;
  summary: string;
  coverImageUrl?: string;
  body: Array<{ type: "p" | "h2" | "quote" | "code"; text: string }>;
}

export interface PortfolioTestimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  pullQuote: string;
  rating?: number;
  avatarUrl?: string;
  sourceLabel: string;
  sourceUrl?: string;
  reviewedOn?: string;
  placements: string[];
  projectSlug?: string;
  projectName?: string;
}

export interface PortfolioContent {
  profile: PortfolioProfile;
  projects: PortfolioProject[];
  experience: PortfolioExperience[];
  education: PortfolioEducation[];
  skills: PortfolioSkillGroup[];
  openSource: PortfolioOpenSource[];
  articles: PortfolioArticle[];
  testimonials: PortfolioTestimonial[];
}
