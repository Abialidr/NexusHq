## DevsMind — AI Brain

**DEVMIND_PATH**: `C:/work 2/portfolio-manager/.devsmind`
**Project**: portfolio-manager | **Mode**: embedded | **Tech**: Not specified | **Session timeout**: 60min
**Repos**: portfolio-manager → .
**Workflow style**: AUTOMATIC: stage, commit and track every edit without being asked


### What This Is

DevsMind is this team's shared code graph: every teammate's agent reads the same one you write to. `get_node_code` shows what git can't: live callers/callees and, with `history:"full"`, why a change was made. It is only as good as what gets recorded, so recording is not optional.

**`session_id` is required on every DevsMind WRITE** (`edit_node`, `commit_changes`, the other mutating calls); read-only tools do not need it. Call `start_session` before your first write and reuse the id it returns for the rest of the conversation (never invent one). `get_activity_log` also takes `session_id` as an OPTIONAL filter: don't pass your own by default or you silently narrow the query to one session.

### Tool Triggers

| Situation | Tool |
|-----------|------|
| **Before your first WRITE** | `start_session`, which mints the `session_id` writes require. On a resumed conversation reuse the earlier id |
| Find a module, feature, concept or code fragment, or config/CSS/markup the graph doesn't index | `search_nodes` with `query` (natural language) and/or `pattern` (a real regex, used exactly as you'd give grep). Returns `nodes` (triage on `confidence`/`relevance`, not on a plausible-looking name) and `files` (a real grep of every repo). `nodes_total`/`files_total` are exact; a `compacted` field says what was trimmed (`compact:false` for all). Never start with your own grep; retry once with a different query before giving up |
| List everything in a component or directory | `list_nodes`, paged: `total` is the true count, a `hint` names the next call |
| Read ONE function/class | `get_node_code`: imports, named callers/callees, file outline and recent reasoning included, so no raw file read afterward |
| Trace a flow, or what breaks if I change this | `get_node_code` with `graph_depth` + `graph_direction`: `"out"` + `graph_code:true` for a whole call flow, `"in"` at depth 2-3 for the full blast radius. One call, not a chain |
| Before refactoring | `get_node_code` with `history:"full"`: every revision with diffable edits |
| "What changed recently?" / which files did you touch / what did a TEAMMATE change | `get_activity_log`: every entry lists its `files`. `source` defaults to `"auto"` (local log, falling back to shared history); use `"both"` for teammates' work |
| ANY edit to ANY file | `edit_node` (`file_path` + `old_string` + `new_string`), never your own edit tool. It never refuses a file type and traces what you changed |
| Create a NEW file | `edit_node` with `old_string: ""` and the whole file as `new_string` |
| A file already got edited WITHOUT `edit_node` | `stage_change`: same params as `edit_node`, but it never writes the file, it only traces and stages the change already on disk. Prefer `edit_node`; this only recovers a miss |
| Checkpoints in a long task, and before ending a turn with staged work | `commit_changes` |
| Function/class renamed | `rename_node` |
| Function/class removed | `deprecate_node`. Never delete: history is lost |

### Recording Changes: Per Node, At Checkpoints

1. `edit_node` is the write path for **every** file, never your own edit/write tool. Writes landing outside any function (markup, config, imports) get no graph node, which is expected; the whole-file change is still staged so `commit_changes` makes it revertable.
2. Call `commit_changes` at natural checkpoints, not once at the end. `edit_node` only stages. Always commit before ending a turn with anything staged.
3. `commit_changes` REQUIRES all three of `message` (the user's request, verbatim; reuse the exact text on later commits for the same request), `reasoning` (ONE `what_changed`/`why`/`goal` object for everything staged since the last commit) and `feedback` (5 strings: `graph_problems`, `edge_problems`, `tools_used`, `dropped_and_why`, `devsmind_better`; each must be answered, `"none"` is fine only after you checked whether this task cost an extra call, a guess or a wrong turn). A brand-NEW node also needs a `description` (1-3 sentences of purpose, in words a teammate would search by): pass it on the `edit_node` call that created it, or call `add_description`.
4. Before writing `"none"` in `feedback`, actually check; one specific sentence with evidence (`file:line`) beats a reflexive "none". Never invent an issue. It is the only channel that improves DevsMind; `add_feedback` sends the same 5 categories on demand.
5. Don't print node/history data as text instead of calling the tools; that records nothing.
6. `commit_changes` is NOT git: it writes only to DevsMind's local graph. Never `git add`/`git commit`/`git push` on your own initiative because it succeeded or a task feels done; that stays the developer's decision, only when asked.

### Other Rules

1. **Index natively** with `index_start`/`index_checkpoint`/`index_continue`/`index_complete`, no external scripts, and don't pause mid-index for confirmation.
2. **Drift:** `snapshot_outdated:true` from `get_node_code` means the graph disagrees with disk; an `edit_node` on that node resyncs it, otherwise run `devsmind reindex`. `source:"cached"` means the symbol wasn't found: verify, then `rename_node` or `deprecate_node`.
3. **Before multi-day work** call `workflow_list`; if one matches, offer to continue it (`workflow_bind` then `workflow_get_context`). Binding is local to your session. Once bound, `commit_changes` logs steps itself; use `workflow_add_step` only for a decision or research finding that changed no code (docs via `doc_paths`, `doc_uploads` or `doc_content`). `workflow_sync` attaches earlier work, previewing until `confirm:true`.
4. **Maintenance:** `analyze_graph` is a zero-token health check (`fix:true` for safe fixes). The graph-feedback loop is `read_graph_feedback`, re-verify, fix (`record_alias`/`link_nodes`/`merge_nodes`/`split_node`/`create_missing_node`), then `mark_graph_feedback_processed`, even for reports that don't apply, or the queue never drains. `get_visualizer_url` opens the graph view.

Every tool's own description lists its parameters and limits.
