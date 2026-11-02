# Upwork MCP spike findings (C4–C5, 2026-10-23)

Connected through Claude Code 2.1.308, Codex 0.163.0 and agy 1.4.6 (OAuth, freelancer account, plan: Freelancer Basic).
Full tool list with schemas: [upwork-tools.json](upwork-tools.json) (34 tools, listed without calling them).
No job content is stored here (retention terms still unknown); only field names.

## How the tools work
- Every tool takes `action` + `org_uid` + `params`. `org_uid` comes from `list_accounts` (call it first).
- `get_tool_help(tool_name)` returns the full parameter reference for a tool.
- Writes (proposals, messages, offers, profile) return a **preview** and only run after `confirm_preview`.
- `set_tool_permission` can switch write confirmations off: must never be callable by an agent.

## Read-only allowlist for agents (proposed)
| Tool | Actions we use | Why |
|---|---|---|
| `list_accounts` | (none) | get `org_uid` |
| `get_tool_help` | (none) | parameter reference |
| `find_jobs` | `search`, `smart_search`, `get` | fetch jobs (keyword search, "recommended for my profile", full detail) |
| `get_profile` | `get`, `connects_balance` | profile for the judge/writer; Connects left |
| `list_freelancer_proposals` | list/get | past proposals as writing examples |

Everything else is blocked, in particular: `confirm_preview`, `confirm_draft`, `manage_proposals`, `send_message`,
`respond_to_offer`, `set_tool_permission`, `set_tool_mode`, `update_profile`, `boost_profile`, `save_job`, uploads.

## Fields per job
**From search / smart_search (list):** id, title, url, description_snippet, skills, budget, job_type, hourly_budget_type,
experience_level, duration, engagement, freelancers_to_hire, proposals_tier (e.g. "Fewer than 5"), created/published date,
client.country, client.verification_status. Paging: `hasMore`, `next_cursor`.

**From get (detail):** full description; client_record (spend_total, hire_rate_percent, jobs_posted, jobs_with_hires,
feedback_score, feedback_count, hours_total, open/active contracts); client_feedback reviews; client_work_history;
client_open_jobs; preferred_qualifications (min JSS, min earnings, rising talent, english, portfolio); hourly budget
min/max; category/subcategory; job activity (invites sent, interviewing, hired); applied; can_apply;
**connects_cost** and **connects_balance**.

## What this means for the pipeline
- Code gates are possible: verified payment, client spend, hire rate, feedback score, budget range, proposals tier,
  already applied / can_apply, Connects cost vs balance, required JSS/earnings.
- Two-step fetch: cheap list (search/smart_search) for the filter agent, `get` only for candidates (judge/writer).
- Descriptions arrive wrapped in `<untrusted_participant_content>`: treat as untrusted input (prompt injection) in
  every agent prompt.
- Cost observed: listing tools ≈ $0.29, a 5-call read-only run ≈ $0.18 (Sonnet, client-side estimate).

## Still open
- Upwork API & MCP Terms §4.1 (user to confirm): user-directed searches only, no continuous monitoring.
- Rate limits and data retention: not documented.
