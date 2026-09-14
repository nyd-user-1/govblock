# Window 4: the library and My Files — report

Report to the lead. Newest milestone first.

## Milestone 1 — My Files: the name and the route, settled (2026-09-14)

Settled first so window 5 can build the rename on it. Window 5 makes the
change; this window leaves those files alone so the two do not collide.

### The name

**My Files**, everywhere a reader sees the folder:

| Where | Today | Becomes |
|---|---|---|
| The data root's folder list, `ROOT_FOLDERS` in `lib/create/path.ts` | "Your forks" | "My Files" |
| The path bar crumb, `components/create/designer.tsx` (`case "forks"`) | "Your forks" | "My Files" |
| The folder's column heads, `components/create/folder-view.tsx` (`case "forks"`) | "Forked from", "Forked" | "Copied from", "Created" (a Duplicate to edit is a copy; window 5's true fork can show "Forked from" on its own rows) |
| Page titles and any `aria-label` naming the folder | "Forks" | "My Files" |

"Duplicate to edit" keeps its name: it is the act, and My Files is where it
lands.

### The route

- The path segment is **`my-files`**:
  `/workspace/data/<state>/<chamber>/<year>/my-files`, and `at=my-files` in
  the `/create` query form.
- `forks` stays a parsed alias of the same folder
  (`lib/workspace/path.ts` `parseWorkspacePath`, `lib/create/path.ts`
  `locate`), so links already out resolve. `buildWorkspacePath` writes
  `my-files`.
- `lib/entitlements.ts` treats `my-files` as it treats `forks` today
  (entity `account`).

### What keeps its name

- The node kind stays `forks` in code (`Node`, `useFolder`, `columnsFor`),
  and the tables stay `Forks` and `Commits`, as the brief says. Nothing a
  reader sees carries either.
- `/api/policy/forks` and `/api/policy/commits` are unchanged.

### The seam for the true fork

My Files lists rows by `record.kind`. Duplicate to edit rows are
`record.kind === "fork"` today. Window 5's true fork of a published statute
lands as its own `record.kind` in the same listing, keyed by the Work's
address (`/us-ny/code/agm/s3`) rather than a `bill_id`, so a fork of a
statute needs no bill row.

### Files touched

- `apps/web/docs/xml/window-4.md`
