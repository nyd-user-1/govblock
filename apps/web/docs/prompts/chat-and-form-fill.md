# /chat + a form-filling agent (research-backed brief)

You are Fable 5.1 in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`), app `apps/web` (Next.js App Router, AWS Amplify). This brief hands you the research pointers gathered by an Opus session; do the deeper reading yourself from the files named, then build. Two deliverables, priority #1 first. They can be one window or two.

## Priority #1 — a /chat surface that fills a PDF for you

**The goal:** a dedicated `/chat` on govblock where a user, in conversation, fills out a government PDF by answering questions inline (select, multi-select, text, yes/no) with a review at the end, and gets the filled PDF back (download + email + into the Agentic Inbox). **Test case: the NYS public benefits form.** We hold thousands of form PDFs already (the Forms table; `/workspace` forms room; `app/api/policy/forms`).

### Where the pieces already exist (read these)

**Chat, from livingston-v3** (`~/Code/livingston-v3/apps/v4`):
- `components/policy/assist-chat.tsx` — the chat surface: input form, submit, message list. This is the chat input container to reuse.
- `components/message-parts.tsx` — the message part / **tool-part rendering framework**. This is the mechanism for in-chat input widgets: a tool call renders a custom UI (a select, a field) keyed by tool name; the user's answer returns as the tool result and the flow continues. This is how "the chat was restructured around introducing input elements the user answers in the flow."
- `components/message-animated.tsx`, `components/cards/chat.tsx`, `packages/react/src/message-scroller/*` (the scroller), `packages/helpers/src/{core,ai-sdk,tanstack-ai}/chat.ts`, `apps/v4/app/api/chat` (backend).
- **Reconciliation note:** v3 uses the Vercel AI SDK (`UIMessage`, `parts`). govblock's agents run a **Bedrock loop** in `apps/web/lib/agents/` (`loop.ts`, `run-client.ts`, `bedrock.ts`, `registry.ts`, `tools.ts`) — newline-delimited events, rounds driven client-side under Amplify's 30s cut. Decide: port v3's chat UI on top of govblock's existing loop (preferred — one agent runtime), or bring the AI SDK path. The in-chat widgets map cleanly onto govblock's tool events (a tool emits a question; the client renders a widget; the answer is the tool result).

**The questionnaire→PDF flow, from childcare** (`~/Code/childcare/src/app/application/page.tsx`, 2019 lines — the cleanest working example):
- A multi-step questionnaire (income yes/no grids, selects, text) with a review, that fills the official **OCFS-6025** AcroForm PDF with **pdf-lib**: `fetch('/OCFS-6025.pdf')` → `PDFDocument.load` → `form = pdfDoc.getForm()` → set text fields and checkboxes **by field name** → embed font → `save()` → **download and email** (Resend). Port this pattern; it is the reference for turning answers into a filled AcroForm and delivering it.

**PDF reading/filling tooling, from tariffs** (`~/Code/tariffs`):
- `src/app/api/parse-7501/route.ts` — the three-tier read: **AcroForm fields first (ground truth, pdf-lib getForm), then the text layer, then Amazon Textract OCR** for scanned/flattened PDFs with no fields. Use this ladder to turn an arbitrary form PDF into a field list.
- `scripts/upload-7501-template.mjs` — pdf-lib `getForm()`, enumerate/clear fields (prepare a fillable template).
- `scripts/lib/hard-7501.ts` — pdf-lib drawing text at coordinates, for PDFs that have **no** AcroForm (a coordinate map instead of named fields).

**Forms data, from livingston** (`~/Code/livingston/scripts/forms/forms-harvest.mjs`) and govblock's own Forms table / `/workspace` forms room / `api/policy/forms`.

### The architecture to build
1. **Ingest a form** → produce a field schema. AcroForm → pdf-lib field names + types (text / checkbox / dropdown). No AcroForm → Textract to detect labels/boxes, or a stored coordinate map. Cache the schema per form.
2. **Drive a questionnaire in chat.** The form-fill agent walks the schema and asks each field (grouped sensibly) as an **in-chat widget** — text, select, multi-select, yes/no — via the tool-part mechanism from `message-parts.tsx`. Validate as it goes.
3. **Review step** (childcare's pattern): show every answer, let the user edit, before filling.
4. **Fill + deliver.** pdf-lib fills the AcroForm (or draws by coordinates), then: download, **email via Resend** (add `RESEND_API_KEY` to `apps/web/.env.local`; wire the delivery), and drop the finished PDF into the **Agentic Inbox** as a delivered thread with the PDF attached (the inbox already renders `Message.attachments`, `registry/blocks/sidebar-09`, and report-mode added a client-side jsPDF path you can learn from).

### Surfaces
- New `/chat` page: put the livingston-v3 chat in the **main container of the /bills layout** (Brendan: "it will fit perfectly"). Look at `apps/web/app/bills` for the layout shell.
- **App-shell right panel:** update the existing right-side chat panel to use the **same chat input container** from livingston-v3, so the panel and the /chat page share one input.

## Priority #2 — the form-filling agent as an agent

Register a form-fill agent in `apps/web/lib/agents/registry.ts` (like the Clerk, `bill-reader`) whose sole job is filling forms: its tools are the schema-reader (AcroForm/text/Textract), the questionnaire driver, and the pdf-lib filler + delivery. Reuse the agent loop and the Agentic Inbox. AWS is already wired for the DB (RDS Data API); Textract is an AWS call — check `apps/web/.env.local` for AWS creds/region (present) and confirm Textract permissions before relying on it, else fall back to AcroForm + coordinate maps.

## Constraints
- **No whole-project typecheck or eslint** (a hook blocks it): verify changed files with the bounded `ts.createProgram` script at `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/454a5265-5aa1-475a-905c-6538316650ac/scratchpad/check.mjs` (copy into `apps/web` as `.check.mjs`, run under `node --max-old-space-size=2048`, delete after).
- **No local prod builds.** Start the dev server only to verify (`cd apps/web && BRENDAN_OK_LOCAL_BUILD=1 NODE_OPTIONS=--max-old-space-size=2048 ../../node_modules/.bin/next dev`), curl the route, then kill it.
- Keep each round/route under Amplify's ~30s cut; the loop already goes round by round.
- **Commit in logical chunks on `design/workspace`** (currently ~45 commits ahead, unpushed) with your session's attribution trailer + `Claude-Session:`. **Do not push.** Other sessions have edited inbox/agent/dashboard/search files today — read current state first, commit only your own paths.
- pdf-lib is already a dependency in the repo (`jspdf` too); check `apps/web/package.json` before adding.

## Deliver
A working `/chat` that fills the NYS public benefits form end to end through an in-chat questionnaire with a review, returns the filled PDF (download + email + inbox), and a registered form-fill agent behind it; the app-shell right panel sharing the same input. Summarize what shipped, what you reused vs rebuilt, and any gap (e.g. a form with no AcroForm needing a coordinate map or Textract).
