-- Cleanup (roadmap G). The Judge agent's job moved into Filter & rank (20261023160100_job_pipeline); its settings row
-- is no longer read by the admin or the worker. The 'judge' enum value stays: Postgres can't drop enum values safely.
delete from public.agent_settings where agent = 'judge';
