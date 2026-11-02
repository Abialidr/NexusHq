-- The Filter & rank agent's full verdict per job (shared JobAssessment): fit score, win chance, competition, why kept or
-- dropped, matched / missing skills, and whether it came from the first pass (list data) or the final ranking.
alter table public.jobs add column if not exists assessment jsonb;
