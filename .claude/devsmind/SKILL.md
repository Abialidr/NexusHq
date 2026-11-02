---
name: devsmind
description: DevsMind team code-graph MCP server — when and how to use it
---

# DevsMind — AI Workflow Skill

DevsMind is this team's shared code graph: every teammate's agent reads and writes the SAME one. Skip recording and the graph goes stale for everyone, and the reasoning behind your change exists only in this conversation: if it isn't captured at commit_changes this turn, it is lost.

Workflow:
1. start_session once before your first WRITE. It returns a session_id that every write requires (responses echo it back; never invent one; on a resumed conversation reuse the earlier id). Reads need no session: search and read freely first.
2. Find code with search_nodes BEFORE any grep or file read: a natural-language query and/or a pattern (a real regex, used exactly as given). It returns graph nodes (triage by confidence and relevance, not by how a name looks) plus a real file grep for what the graph doesn't index (config, CSS, markup). Empty means absent: retry once with a different query or pattern first.
3. Read one function/class with get_node_code, not the file. It already includes imports, named callers and callees, a file outline and recent reasoning. Before changing a signature add graph_depth and graph_direction:"in" for the full blast radius; before a refactor add history:"full" for every past revision and why.
4. Write EVERY file with edit_node (file_path + old_string + new_string; old_string:"" creates a file), never your own edit/write tool. If a file was already edited without it, stage_change records that edit without rewriting the file.
5. commit_changes at natural checkpoints and before ending a turn with staged work. It REQUIRES message (the user's request, verbatim), reasoning (one what_changed/why/goal for everything staged) and feedback (5 fields; answer for real, "none" only after checking). It REFUSES a brand-new node without a description (1-3 sentences of purpose, in words a teammate would search by): pass description on edit_node, or call add_description.
6. commit_changes is NOT git. It writes only to DevsMind's local graph. Never run git add, commit or push because it succeeded: a real git commit is the developer's separate decision, only when they ask.
7. rename_node for renames, deprecate_node for removals. Never delete a node: its history is lost.
8. For multi-session features call workflow_list, ask the user, then workflow_bind. Once bound, commit_changes logs steps itself; use workflow_add_step only for a decision or research finding that changed no code. workflow_sync attaches earlier work.

Each tool's own description lists its parameters and limits.

## Tool playbook

### Always write with edit_node

`edit_node` is the write path for **every** file, whatever the extension. Never use your own edit/write tool. Params: `file_path` + `old_string` + `new_string`; to create a file pass `old_string: ""` and the whole file as `new_string`. If the edit creates exactly ONE new function/class, pass `description` in the same call ("commit_changes contract" refuses an undescribed new node).

**Why:** it traces where the text landed to the real function/class, stages it, and answers with its callers; a plain edit tool records nothing. Writes outside any function (markup, config, imports) get no graph node, which is expected; the whole-file change is still staged.

**How to apply:** if a file already got edited WITHOUT it, call `stage_change` (same shape): it traces and stages the change already on disk without rewriting the file, and fails clearly if `new_string` is not found. It only recovers a miss; it is never a second way to edit.

### start_session first

`start_session` mints a `session_id` that every WRITE tool (`edit_node`, `commit_changes`, the other mutating calls) REQUIRES. Read-only tools (`search_nodes`, `get_node_code`, `list_nodes`, `get_activity_log`, the other getters) do NOT: search and read freely before it has run. Never invent an id; on a resumed conversation reuse the earlier one.

**Why:** a session ties a request's writes together on the local Activity log so it can be reverted as a unit. Reads mutate nothing, so gating them only adds friction.

**How to apply:** if a write errors saying `session_id` is required, call `start_session` and retry. `get_activity_log` takes `session_id` only as an optional filter: omit it unless you want one session, or you silently narrow a broad query.

### search_nodes before grep

`search_nodes` is the one search call: it covers the indexed graph AND the raw filesystem, so no external grep is needed. Pass `query` (natural language; drives meaning-matching) and/or `pattern` (a REAL regex, used exactly as you would give grep, not re-escaped). Pattern-only is a precision mode: exact grep + code-body matches. Your knowledge of identifiers, error strings and config keys makes a better pattern than any query.

It returns `nodes` (primary; each leads with `confidence`, `relevance`, `found_by`; `nodes_total` is the true count before the top-20 cap) and `files` (a real grep of every repo for what the graph does not model: CSS, JSON, `.env`, markup, wiring; sample lines name the enclosing function; `files_total` is exact and `offset` pages).

**Why:** empty buckets plus a `hint` mean it genuinely is not there; it never pads with guesses. Triage on `confidence`, not on a plausible-looking name: it is corroboration across independent layers, which you cannot reconstruct by eye. `used_by: 0` with a `used_by_note` means unverified, not dead.

**How to apply:** search before any grep or file read; retry once with a different query/pattern before concluding absence; fall back to a manual grep only if the response says `truncated: true`. Lockfiles and build artifacts are excluded by default (config, JSON, `.env` are not). A `compacted` field names what was trimmed; `compact:false` returns all. Next: "get_node_code graph params for callers and flows" for blast radius.

### get_node_code graph params for callers and flows

`get_node_code` already includes direct callers/callees by name on every call. `graph_depth` + `graph_direction` walk the transitive graph in that same call:
- `graph_depth: 2-3` + `graph_direction: "in"`: the full caller blast radius. Use BEFORE changing any signature or behaviour.
- `graph_depth: 3` + `graph_direction: "out"` + `graph_code: true`: the node plus everything it transitively calls, with source, in ONE call. Use it to trace a request or feature end to end.

**Why:** git shows what changed, never what depends on it, and one call replaces a long chain of per-function fetches.

**How to apply:** never chain per-function fetches. If `graph.code_truncated: true`, `graph.code_omitted_node_ids` names nodes whose code did not fit (fetch exactly those or raise `graph_code_budget`), while `graph.nodes_no_code_available` counts nodes whose source is genuinely missing (a bigger budget will not help). `graph.nodes_truncated: true` means the walk hit its 120-node cap. See "search_nodes before grep" and "get_node_code — the one node-read call".

### get_node_code — the one node-read call

`get_node_code` is the ONE node-read call: one function/class, live-parsed from disk, so trust it as current. Always included: `name`/`type`/`signature`/`description`, `imports`, `uses_nodes`/`used_by_nodes` (up to 20 named callers AND callees each way; `uses`/`used_by` are the true counts), `file_outline` (up to 40 other declarations in the file), and `recent_history` (the last 3 changes' reasoning, no code).

Reach further in the SAME call: `graph_depth`/`graph_direction` ("get_node_code graph params for callers and flows"), and `history:"full"` for every revision with diffable edits (pageable via `history_limit`/`history_offset`); use it before refactoring anything with a non-trivial `history_count`.

**Why:** git blame gives who and when; the decision context exists only in DevsMind history.

**How to apply:** do not re-open the file for imports, callers or siblings; those fields answer it. A `*_hint` means more is reachable in this same call. `snapshot_outdated: true` means the graph disagrees with disk (an `edit_node` there resyncs it). `source: "cached"` means the symbol was not found: check `file_outline`, then `rename_node` or `deprecate_node` ("Never delete a node").

### get_activity_log for "what changed"

`get_activity_log` answers "what changed", one entry per `commit_changes`. Filters compose (AND): `developer`, `session_id`, `since_hours` or `since`/`until`, `requirement_contains`. Each entry has `files` (every file that commit touched), `node_ids`, `developer`, `created_at`, `request`, `summary`, `status`, `source`; the response adds `all_files` and `total_matched` (the pre-`limit` count).

It reads two stores: the local log (full fidelity, gitignored, so EMPTY on a fresh clone) and shared graph history (lossier). `source`: `"auto"` (default) uses local and falls back to graph history only when local is empty; `"both"` adds sessions from other machines; `"local"`/`"graph"` force one. Graph-backed entries carry a `caveats` array.

**Why:** it is the only source of the full file set per commit, and the fallback makes the question answerable on a fresh clone.

**How to apply:** use `"auto"` for your own recent work; use `"both"` for TEAMMATES' work, since `auto` stops at your local store once it has anything. Human views: `devsmind activity` and `devsmind view` ("devsmind CLI commands").

### commit_changes contract

`commit_changes` fails unless all THREE are present:

1. `message`: the user's request, verbatim. Reuse the exact text on later commits for the same request; it merges them into one log entry.
2. `reasoning`: ONE object (`what_changed`/`why`/`goal`) for everything staged since the last commit.
3. `feedback`: 5 strings (`graph_problems`, `edge_problems`, `tools_used`, `dropped_and_why`, `devsmind_better`), each answered. `"none"` is allowed only after checking whether this task cost an extra call, a guess or a wrong turn. Never invent an issue.

It also REFUSES a batch with a brand-NEW node lacking a `description` (1-3 sentences of purpose, in words a teammate would search by). Nothing staged is lost: describe it via `add_description` (or inline on `edit_node`) and retry.

**`commit_changes` is NOT git.** It writes only to DevsMind's local graph and never runs `git add`/`git commit`/`git push`. Never run git on your own initiative because it succeeded or a task feels done; a real git commit is the developer's separate decision, only when asked.

**Why:** `edit_node`/`stage_change` only stage; nothing reaches the graph or the activity log until commit. `feedback` is the only channel that improves DevsMind ("Graph feedback queue").

**How to apply:** commit at natural checkpoints and before ending a turn with staged work. `add_feedback` sends the same 5 categories on demand, with no commit needed.

### list_nodes for discovery

`list_nodes` enumerates all nodes for a component, module or directory: use it for "what exists here", not "find the thing that does X" ("search_nodes before grep").

**Why:** search ranks and stops at the good hits; listing is exhaustive over a scope, which an audit or onboarding sweep needs.

**How to apply:** use it before reading a directory tree by hand, then drill in with `get_node_code`. It is PAGED: `{nodes, total, offset}`, `total` the true count, `limit` default 100 (max 500); a `truncated` flag and `hint` name the next call, so never read a short page as complete. Narrow with `type`/`file_path` instead of paging a whole repo. An oversized page degrades to id/name/type/file_path with a `compacted` note; `total` stays exact.

### Workflow tools for multi-session work

A workflow is a named, backward-looking log of how one piece of functionality grew across many nodes and sessions. It is not a task list and never "completes".

`start_session` flags a recent workflow worth continuing; otherwise `workflow_list` (`query` matches name, description and step content) finds one. Continue with `workflow_bind`, then `workflow_get_context` (`last_n` reads the tail). Binding is local to YOUR session; it never moves or displaces anyone else's. Others: `workflow_create`; `workflow_archive` (retire, no delete); `workflow_remove_step` (delete one mistaken step, no undo); `workflow_delete` (only an empty workflow); `workflow_import` (turn flow/architecture `.md` docs into workflows).

**Why:** a feature's decision history is invisible to git blame, and what was evaluated and rejected is kept nowhere else.

**How to apply:** once bound, `commit_changes` auto-logs a step, so skip `workflow_add_step` for ordinary code. Use it for a decision or research finding that changed no code, attaching docs by `doc_paths` (inside the repo), `doc_uploads` (copy up to 10 files in) or `doc_content` (paste text). If you worked unbound or on the wrong workflow, `workflow_sync` attaches it from your local activity log (previews until `confirm:true`; re-running is a no-op). See "commit_changes contract".

### Graph feedback queue

Graph-problem reports from `commit_changes`' `feedback`, or from `add_feedback`'s `graph_problem`/`edge_problem` at any time, drain through a supervised loop:

1. `read_graph_feedback`: unprocessed reports clustered by (node_id, category), most frequent first.
2. Re-verify against current code. `confidence` ("confirmed" = evidence, "suspected" = none) is a priority signal only; reports go stale. Only `add_feedback` can produce "confirmed", because its evidence is verified fresh at call time.
3. Fix: one `record_alias`/`link_nodes`/`merge_nodes` often resolves a whole cluster ("Graph maintenance tools").
4. `mark_graph_feedback_processed` with those ids, even when it does not apply, or the queue never drains.

`flag_indexer_rule` notes a recurring pattern worth a permanent indexer rule; it does not change the graph. `devsmind feedback` is the human view.

### Never delete a node

A renamed function/class goes through `rename_node`; a removed one through `deprecate_node`. Never delete.

**Why:** deleting a node destroys its recorded history (the reasoning behind every past change); nothing can recover it.

**How to apply:** if `get_node_code` returns `source: "cached"`, the symbol is gone from disk: verify what happened, then rename or deprecate rather than leave the graph stale. See "get_node_code — the one node-read call".

### Graph maintenance tools

Maintenance surface, not day-to-day lookup:

- `analyze_graph`: zero-token local health check (god entities, cycles, dangling edges, renames, orphaned nodes). `fix: true` applies only safe automatic fixes. CLI: `devsmind analyze`.
- `recheck_graph`: drift and disconnection sweep, pruning spurious nodes.
- `merge_nodes` / `split_node`: a node wrongly split, or wrongly lumped together.
- `link_nodes`: a real connection the AST couldn't prove (dynamic dispatch, generated bindings).
- `record_alias`: the same symbol known by another name; often fixes a whole feedback cluster.
- `create_missing_node`: something real the indexer never picked up.
- `get_visualizer_url`: the local URL for the interactive graph view (`devsmind view`).

These are the fixers the "Graph feedback queue" loop reaches for.

### Indexing tools

Indexing runs through the MCP tools: `index_start` → `index_checkpoint` → `index_continue` → `index_complete`. No external scripts.

**Why:** the checkpoint/continue pair is what makes progress survive a context reset.

**How to apply:** don't pause mid-index for confirmation; keep going until the workspace is indexed or the context limit is hit. `devsmind index` (first run) and `devsmind reindex` (incremental, for changes made outside `edit_node`) are the CLI counterparts ("devsmind CLI commands").

### devsmind CLI commands

`devsmind <cmd>`:

**Setup**: `init`, `start`, `rule` (build + place the workspace rule), `mcp` (register the server per tool), `memory`, `skill`, `style` (shorter agent replies).

**Graph**: `index` (first time), `reindex` (incremental), `sync` (load committed graph + history into the local brain.db), `analyze` (zero-AI health check), `describe` (backfill descriptions; safe to re-run), `embed` (local vector embeddings; `--force` for a model upgrade), `prune` (interactive permanent removal).

**Review**: `view` (graph visualizer plus Activity/Chat tabs), `activity`, `feedback`, `diff <node_id>`, `revert <node_id>` (undo an entity's most recent recorded edit), `workflow` / `workflow-import <path>`.

The activity and feedback logs are LOCAL and gitignored. See "get_activity_log for "what changed"".
