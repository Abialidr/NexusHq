// The Find jobs pipeline's shared vocabulary: job stages (one inbox tab each), the free code gates applied before
// any AI ranking, and how big the shortlist is. The worker writes jobs; the admin reads them (public.jobs).

import type { TailoredResume } from "./upwork.ts";

export const JOB_STAGES = ["found", "gated_out", "filtered_out", "shortlisted", "bid", "skipped"] as const;
export type JobStage = (typeof JOB_STAGES)[number];
export const isJobStage = (v: unknown): v is JobStage => (JOB_STAGES as readonly unknown[]).includes(v);

export const JOB_STAGE_LABEL: Record<JobStage, string> = {
  found: "Found", gated_out: "Gated out", filtered_out: "Filtered out", shortlisted: "Shortlist", bid: "Bid", skipped: "Skipped",
};

// Fields kept from a search result (find_jobs search / smart_search) and from the job detail (find_jobs get).
export interface JobSummary {
  id: string;
  title: string;
  url: string;
  description_snippet?: string;
  skills?: string[];
  budget?: string;
  job_type?: string;
  experience_level?: string;
  proposals_tier?: string;
  client_country?: string;
  client_verified?: boolean;
  published_date?: string;
  found_by?: string; // why Search picked it up: "Upwork recommended" or the query that found it
}

// The Filter & rank agent's verdict on one job (public.jobs.assessment).
export interface JobAssessment {
  fit_score: number;        // 0-100: how well the job matches your skills and projects
  win_chance: number;       // 0-100: estimated chance of winning it (fit, competition, client, budget)
  competition: string;      // e.g. "5 to 10 proposals"; what Upwork shows about other applicants
  why: string;              // why it was kept or dropped
  matched_skills: string[]; // your skills this job asks for
  missing_skills: string[]; // what it asks for that your profile doesn't show
  stage: "pre" | "final";   // pre = list data only, final = with job details
}

export interface JobDetail {
  description?: string;
  client_spend_total?: number | null;
  client_hire_rate_percent?: number | null;
  client_feedback_score?: number | null;
  client_jobs_posted?: number | null;
  hourly_min?: number | null;
  hourly_max?: number | null;
  connects_cost?: number | null;
  applied?: boolean;
  can_apply?: boolean;
  bid_stats?: string | null; // only on Freelancer Plus
}

export interface SuggestedBid {
  amount: number;
  unit: "hour" | "fixed";
  reason: string;
}

export interface JobDraft {
  cover_letter: string;
  resume_highlights: string[];
  questions?: string[];
  resume?: TailoredResume; // roadmap H3: the resume tailored to this job (drafts written before H have none)
}

// Free checks (no tokens) that drop obvious misses before Claude sees a job. Kept lenient on purpose: anything
// unknown passes and is left to the Filter agent. These are the defaults; the Filter & rank card can change them.
export const GATES = {
  requireVerifiedPayment: true,
  skipCrowded: false,                       // off: 50+ proposal jobs go to the ranking, which lowers their win chance
  maxProposalsTier: /50\+|more than 50/i,   // proposals_tier text that means too crowded
  minHourlyMax: 20,                         // USD/hr: drop hourly jobs whose top rate is below this
  minFixed: 100,                            // USD: drop fixed-price jobs below this
  minHireRateWhenExperienced: 15,           // %: clients with 5+ posts who almost never hire
};

export type Gates = typeof GATES;

// The defaults with the Filter & rank card's overrides applied.
export function gatesFrom(o: { gateMinHourly?: number; gateMinFixed?: number; gateSkipCrowded?: boolean; gateRequireVerified?: boolean }): Gates {
  return {
    ...GATES,
    minHourlyMax: o.gateMinHourly ?? GATES.minHourlyMax,
    minFixed: o.gateMinFixed ?? GATES.minFixed,
    skipCrowded: o.gateSkipCrowded ?? GATES.skipCrowded,
    requireVerifiedPayment: o.gateRequireVerified ?? GATES.requireVerifiedPayment,
  };
}

// Shortlist = the best `percent`% of what was found (the Filter & rank agent's Shortlist % setting), at least 1.
export function shortlistSize(found: number, percent = 10) {
  return Math.max(1, Math.ceil((found * percent) / 100));
}

// Stored jobs are deleted after this many days unless you bid on them (Upwork's retention terms aren't published).
export const JOB_RETENTION_DAYS = 30;
