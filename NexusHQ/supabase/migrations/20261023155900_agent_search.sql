-- The Search agent (agreed base flow: Search → gates → Filter & rank → Writer). Its own file because a new enum
-- value can't be used in the same transaction that adds it; 20261023160100_job_pipeline inserts the row.
alter type public.agent_id add value if not exists 'search';
