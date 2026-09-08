# The Filer: /chat fills NYS forms into their PDF fields

You are Fable 5.1 in the **govblock** monorepo (`/Users/brendanstanton/Code/govblock`, app `apps/web`, Next.js App Router on AWS Amplify, pnpm workspace; the app package is named `web`; the UI kit is `packages/ui` as `@govblock/ui`). You are building alone and autonomously. Build the whole thing, verify it the way §3 says, commit in chunks, do not push, then report. This is serious work for real applicants: a value in the wrong box on a benefits application costs someone their benefits. Nothing ships unverified.

This brief supersedes `apps/web/docs/prompts/chat-and-form-fill.md`. Every pointer below was checked against the repos on 2026-09-08; where the old brief was wrong, this one says so. Read only what this brief names, and read those files in full.

## 0. The deliverable

A user opens `/chat` on govblock, says "help me apply for SNAP" or "apply for child care assistance", and the **Filer** (a new registered agent) walks them through the form one section at a time. Each section arrives as an **in-chat widget** (text, money, date, SSN, select, radio, multi-select, yes/no, attest). A **review** widget shows every answer, editable, before anything is filled. The browser then writes the answers **into the PDF's own form fields** with pdf-lib and shows a **delivery card**: download, email via Resend, and save to the Agentic Inbox as a delivered thread with the PDF attached.

Success is a filled PDF whose fields hold the answers, openable and editable in Preview or Acrobat. An appendix page of answers is not success. The thing that makes it feel like magic is the **profile** (§1.4, §2.2): the person answers once, both forms fill from it, and the second form asks only what the first did not. Both forms are required, end to end:

| Form | What it is | Fillable layer (verified with pdf-lib on 2026-09-08) |
|---|---|---|
| **LDSS-2921** | NYS Application for Certain Benefits and Services: SNAP, Public Assistance, Medicaid, child care, emergency | The state's PDF has **0 widgets**. `~/Code/livingston/.research/2921-fillable.pdf` is the same 28 pages with a generated AcroForm: **1,599 text fields + 176 checkboxes**, positional names like `p01_r531_c030` (page 1, y 531, x 30). That file is the base. |
| **OCFS-6025** | NYS Child Care Assistance application (CCAP) | Real AcroForm: **314 text fields + 115 checkboxes**, semantic names (`full_name`, `aliases`, `address_street`, …). `~/Code/livingston/public/forms/OCFS-6025.pdf` (same file in `~/Code/childcare/public/`). |

The app-shell right panel and `/chat` share one chat component. The Filer appears on `/agents` through the registry.

## 1. What exists, and what is actually missing

### 1.1 govblock (read in full before writing anything)

`lib/agents/loop.ts`, `lib/agents/run-client.ts`, `app/api/agents/chat/route.ts`, `lib/agents/registry.ts` (the `AgentDefinition` type and the Clerk entry, lines 1–150), `lib/agents/run-tools.ts`, `lib/agents/tools.ts` lines 1–60 and 800–863, `lib/agents/inbox.ts`, `components/policy/assist-chat.tsx`, `components/assist-panel.tsx`, `app/agents/agent-chat.tsx`, `app/agents/transcript.tsx`, `app/docs/layout.tsx`, `app/docs/bills/page.tsx`, `registry/blocks/sidebar-09/page.tsx` lines 180–260, `lib/agents/report-pdf.ts` lines 1–110, `lib/policy/forms-queries.ts` lines 1–125.

- **Runtime.** The Bedrock Converse loop, one round per POST to `/api/agents/chat`, ndjson events `open | text | tool | tool_result | continue | state | done | error`. `runAgent` in `run-client.ts` carries `state.messages` (the full Converse `Message[]`) back every round. Tools run server-side in the round through `runTool`. Results are capped at 8,000 chars and **compacted to 700 chars after two rounds** (`VERBATIM_ROUNDS`): the model cannot be the ledger of answers. The browser is.
- **`ai` v7 and `@ai-sdk/react` are in `apps/web/package.json`** but used only by `app/(typeset)/lib/fixtures/docs.ts`. Do not build on them. One runtime.
- **The chat UI is plumbing only.** `components/policy/assist-chat.tsx` and `app/agents/agent-chat.tsx` are a bare `Textarea` plus a `Button` over `runAgent`, with `Prose` and `RunSteps` from `transcript.tsx`. The livingston-v3 chat UI (§1.2) has **not** been ported. Keep the `runAgent` plumbing, replace the render tree.
- **The right panel** (`assist-panel.tsx`, fixed 423px drawer mounted in `app/layout.tsx`) renders `AssistChat`. Rebuilding `AssistChat` upgrades the panel; keep that true.
- **Not installed anywhere in the workspace:** `pdf-lib`, `resend`, `motion`, `@shadcn/react`, `@aws-sdk/client-textract`. `jspdf` is (used by `report-pdf.ts`). From the repo root: `pnpm add pdf-lib resend motion @shadcn/react --filter web` and `pnpm add -D unpdf --filter web` (text layer for the draft-spec script). `@base-ui/react` 1.7 and `class-variance-authority` are already in both `web` and `@govblock/ui`. Do not add Textract; nothing here needs OCR.
- **The Agentic Inbox is localStorage-backed** (`inbox.ts`, fifty threads in a few megabytes). `Attached = { name; meta?; href; build?: "report-pdf" }`; with `build` set, the file is rebuilt in the browser on click (sidebar-09 line 230, `report-pdf.ts`). **Never store PDF bytes in a thread.** Store form id and the values used on the message and rebuild.
- **The Forms table** carries `fillable_fields` jsonb, `url`, `file`, `pages`, `bytes`; `/docs/forms/[id]` is the form page. The two PDFs for this build ship in `public/forms/`, not from the table.
- **Model tiers** `reasoning | grounded | routing` (`lib/agents/models.ts`); `maxRounds` per agent (`registry.ts` line 29).
- **Secrets.** `apps/web/.env.local` (gitignored) now has `RESEND_API_KEY` and `RESEND_FROM_EMAIL=GovBlock <onboarding@resend.dev>`, copied from livingston on 2026-09-08. Email is live, not gated. AWS is the default credential chain; nothing to add.

### 1.2 The chat UI to port, from livingston-v3 (`~/Code/livingston-v3`, a fork of the shadcn/ui monorepo; `apps/v4` is the site)

Read in full:

- `apps/v4/components/cards/chat.tsx` (273 lines): the chat card. The **composer** is `InputGroup` + `InputGroupInput` + `InputGroupAddon align="inline-end"` + `InputGroupButton` with `ArrowUpIcon`, in a `CardFooter`; messages are `w-max max-w-[75%] rounded-lg px-3 py-2 text-sm`, user turns `ml-auto bg-primary text-primary-foreground`; header is an `Avatar` with name and a line under it. This composer is "the chat input container" Brendan means; `/chat` and the panel both use it. govblock's `@govblock/ui/components/nova/input-group.tsx`, `avatar.tsx`, `card.tsx`, `dialog.tsx` exist; build from the rendered demo, not the snippet.
- `apps/v4/styles/base-rhea/ui/message.tsx` (92), `bubble.tsx` (128), `message-scroller.tsx` (130): the message, bubble and scroller primitives (Base UI `merge-props`/`use-render`, CVA). Port them into `packages/ui/src/components/nova/` as `message.tsx`, `bubble.tsx`, `message-scroller.tsx`, on govblock's tokens. They import `@shadcn/react/message-scroller` for the headless scroller (`MessageScroller.Provider/Root/Viewport/Content/Item/Button`, `useMessageScroller`), which is the npm package you are adding (0.3.1 exports `./message-scroller`); do not port `packages/react/src/message-scroller/*`.
- `apps/v4/components/message-animated.tsx` (186) and `apps/v4/lib/message-animations.ts` (137): the animated message (`motion/react`, reduced-motion aware, `BrainIcon` for reasoning). Port to `components/chat/message-animated.tsx` and `lib/chat/message-animations.ts`.
- `apps/v4/components/message-parts.tsx` (645): a generic renderer for AI SDK `UIMessage.parts`, used nowhere in the app. Port its **contract** only: a `tools: Record<toolName, Component>` map that renders a tool call as a widget and returns the answer as the tool result (§2.4).
- `apps/v4/components/policy/assist-chat.tsx` is the same bare textarea govblock has. Nothing to take from it.

The new `AssistChat` (`components/chat/assist-chat.tsx`; keep the old path exporting it so `assist-panel.tsx` needs a one-line import change at most): the scroller as the viewport, `MessageAnimated` per turn, `RunSteps` folded under the assistant turn as today, the tool-widget map for `ask`/`review`/`fill_form`, the InputGroup composer pinned at the bottom, starters as outline buttons when empty. The panel gets the compact variant (stacked fields, no two-column grids at 423px).

### 1.3 The form builds to port

- `~/Code/livingston/src/lib/programs.ts` (948 lines): `ProgramForm` for `ldss-2921` and `ocfs-6025` with `sections[]` (section number, title, `pages`, `asks`, `consent`), and **`FORM_KEYS` (line 460 on, 109 keys)**: every answer key with `label`, `what`, `options` (`value|Label`), `multi`; repeated people use `children[0].individual.firstName` style keys, normalised with `[n]`. **This is the questionnaire.** Port as data; do not invent questions.
- `~/Code/livingston/src/lib/form-fields.ts` (188): `FieldKind`, `ChatField`, `optionParts`. The prose-block protocol (`parseFieldBlock`) is what a tool call replaces; the types and option parsing carry over.
- `~/Code/livingston/src/components/ChatFormFields.tsx` (431): the widgets per kind, SSN/date/money handling, `EXPAND_QUESTION`. Port onto govblock primitives.
- `~/Code/livingston/src/components/FormProgress.tsx`, `FormCard.tsx`, `FormDelivery.tsx`: progress, the form card, delivery (download; email to self; email to the county with a copy).
- `~/Code/livingston/src/lib/form-answers.ts`: answers per form and session in localStorage (`loadAnswers`, `saveAnswers`, `mergeAnswers`, `rememberActiveForm`). Port so a reload resumes.
- `~/Code/livingston/src/lib/fill-form.ts` (449): the previous LDSS-2921 fill. It draws a few boxes by coordinate and appends an answers appendix. **Do not port the appendix.** Take its `PROGRAM_BOX`, `URGENT_XY`, `LANG_XY` coordinates as ground truth for locating those checkboxes in the fillable, and its value formatting.
- `~/Code/livingston/.research/`: `2921-fillable.pdf` (the base), `2921-field-map.json` (`text[1599]`, `checkbox[176]`: each field's `name`, `page`, `x`, `y`, `w`, `h`, `guess` label, `from` direction; the guesses are ~70% right), `2921-layout.json` (every positioned string on every page: the printed labels), `2921-checkboxes.json` (176 boxes with the label to their right), `2921-cells.json`, `build-fillable.mjs` (how names were minted), `FINDINGS.md` §10 (page budget: pages 1–18 collect data, 19–25 are consent text, 27–28 voter registration; text cells per page `{3:103, 4:280, 7:136, 9:141, 13:167, 14:166, …}`), `WALK.md`. **There is no key→field map yet.** Building it is the core of this job (§2.3).
- `~/Code/livingston/api/send-application.ts`: the Resend route. `attachments: [{ filename, content: base64 }]`, modes `self` and county-with-copy. `~/Code/childcare/src/app/api/send-application/route.ts` is the Next-flavoured twin.
- `~/Code/childcare/src/app/application/page.tsx` lines 620–830: `PDFDocument.load` → `getForm()` → `getTextField(name).setText` / `getCheckBox(name).check()` per field in try/catch, `embedFont(StandardFonts.Helvetica)`, `save()`, download, email. **The field names in those lines are the OCFS-6025 map**; copy them verbatim into a typed map, then reconcile against `getForm().getFields()` of the PDF (429 fields) so every field the form has is either mapped to a key or listed as intentionally blank (office use).
- `~/Code/tariffs/src/app/api/parse-7501/route.ts` (80): the AcroForm → text layer → Textract ladder, for the source labelling only.

PDFs: copy `~/Code/livingston/.research/2921-fillable.pdf` to `apps/web/public/forms/LDSS-2921.pdf` and `~/Code/livingston/public/forms/OCFS-6025.pdf` to `apps/web/public/forms/OCFS-6025.pdf`.

### 1.4 What the form-filling world already knows (reviewed 2026-09-08; do not re-fetch)

Brendan watched Jobright fill Workday applications and wants that feeling here: the form fills itself, the person is asked only what nobody could know yet, and the second form is faster than the first. Seven projects were read for the mechanism. What transfers:

- **A profile, not a transcript** (Jobright; `berellevy/job_app_filler`). Jobright fills from a structured profile built once from a resume. job_app_filler stores every answer under a path `page / section / field type / field name` in extension storage and refills any form whose fields match that path on the next visit; per-site quirks live in per-site adapters. For govblock: one **applicant profile** in canonical keys (§2.2) that outlives the form and the session. LDSS-2921 and OCFS-6025 share name, DOB, SSN, address, phone, household members, income and citizenship; a person who finished one is mostly done with the other. Each form is an adapter from canonical keys to its own fields.
- **Ask only for the gap; review what was assumed** (`ajitsingh98/Auto-Job-Form-Filler-Agent`): an LLM proposes values from the profile, a human confirms them. Our `ask` widget shows prefilled fields as already-known values with Edit, and the `review` widget is the confirmation.
- **Fields as data, filling as a mapping** (`GSA/pdf-filler`, `pdffillerjs/pdffiller`). GSA's service is three endpoints: `/fields?pdf=` (field names and types as JSON), `POST /fill` (key-values in, filled PDF out), `/form?pdf=` (an HTML form generated from the fields); non-fillable PDFs take `x,y,page` placements. pdffiller's `mapForm2PDF(fields, convMap)` is the same idea: application keys → PDF field names through a conversion map, checkboxes `true → "Yes"`, `false → "Off"`, and `fillFormWithFlatten(…, false)` to keep the file editable. For govblock: a **FormSpec** per form (§2.3) that is data, one generic `fillForm(spec, values)`, and a script that drafts a spec from any PDF so the 20,000-form library starts from a draft map, not from zero.
- **Checkbox on-values are read, never assumed** (`WestHealth/pdf-form-filler`): the export value of a checkbox or radio kid is the key of its `/AP /N` dictionary, not the string "Yes"; the filler sets `/V` and `/AS` to that value and sets `NeedAppearances true` so every viewer regenerates appearances. In pdf-lib that is `checkBox.acroField.getOnValue()`, `radioGroup.select(exportValue)`, and `form.updateFieldAppearances(font)` plus `acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True)`.
- **Field geometry is code, not an Acrobat session** (`uplg/PDFFormsFiller`, archived, PHP: it overlays text at `llx, lly, urx, ury, page` coordinates found with an external tool). The CCAP map took Brendan three chat rounds and then hand-resizing fields in Acrobat. That never happens again: a spec carries `fixups` (widget rectangles moved or resized at fill time, `widget.setRectangle`), text fields auto-fit (a default-appearance font size of 0 makes pdf-lib compute the size that fits the box; if `setFontSize(0)` is refused, set `acroField.setDefaultAppearance("/Helv 0 Tf 0 g")`), and the rasterise-and-look loop (§3.2) is how a map is proven, so the mapping converges in one session with evidence rather than in three chats by feel.
- **Map by sight, not by geometry** (`wdhorton/formfill`, the one genuinely different mechanism found in a GitHub-wide search: it hands Claude a rendered page image as the "screenshot" and takes back coordinates, computer-use style, then writes the text itself). Nothing else in open source goes beyond fields-plus-map (`t-houssian/fillpdf`, `lindseystead/ai-pdf-autofiller`, `Engineersmind/pdf-autofillr`). For govblock the mapping step is done the same way, by the builder: `scripts/forms/annotate.mjs` (port of livingston's `.research/annotate.mjs` and `boxes.mjs`) renders every page of a base PDF with every field outlined and labelled with its name, and you **look at the render** to bind each canonical key to the field beside its printed label. Geometry (`2921-field-map.json`, `2921-layout.json`) proposes candidates; your eyes decide; the refill-and-look pass proves it. This is how a 1,775-field positional form gets a correct map in one session.
- **For the 20,000-row library, later, not now**: govblock runs on AWS, and Amazon Textract `AnalyzeDocument` with `FeatureTypes: ["FORMS"]` returns `KEY_VALUE_SET` blocks (a printed label and its blank value box, each with geometry) and `SELECTION_ELEMENT` blocks (checkboxes with geometry) from a page image, which is the synthesised-widget layer livingston built by hand for LDSS-2921, done by an API per page. `draft-spec.mjs` plus Textract is the path from a non-fillable PDF in the Forms table to a FormSpec. Record it in the report as the next step; do not build it in this brief.

### 1.5 The profile already has a home; use it

- **govblock `/workspace/dashboard/settings/profile`** (`components/admin/pages/settings.tsx`, `Profile()` at line 63, tabs `My profile / Plan / Billing / Notifications / Password / Security / API`; the field pattern is `Field({ label, children })` there and `Section`/`F` in `users-create.tsx`; the page shell is `dashboard-workspace.tsx` and `dashboard-menu.tsx`, ported from livingston-v3's `dashboard-01` block). Add an **Applicant** tab at `settings/applicant`: the canonical profile as sections in the form's own order (you, contact, household members, citizenship, income, housing, expenses), every field a canonical key from `lib/forms/keys.ts`, reading and writing the same `lib/forms/profile.ts` store the Filer uses. This is onboarding: a person who fills it once has both forms mostly done before opening `/chat`. The `ask` widget's "known" summary links to it.
- **childcare's `prefill_application` tool** (`~/Code/childcare/src/lib/chat-tools.ts` line 266 on, `src/hooks/useChat.ts` line 24 on, `src/app/application/page.tsx` lines 500–520): the model captures facts a person states in ordinary conversation ("I'm in Erie County, two kids, I work at Wegmans") into a typed draft, the client writes it to localStorage, and the application page prefills from it ("We've saved your answers to pre-fill the official application for you"). Port it as a client-side tool `remember` on the Filer: input `{ values: Record<CanonicalKey, string> }`, validated against `keys.ts`, merged into the profile with a one-line receipt in the transcript ("Kept: county, household size, employer"). Every fact a person volunteers is one fewer question.
- **The eligibility-first order** (childcare `/eligibility` → `/application`): screen first, then apply. LDSS-2921 Section 1 (programs) and the urgent-needs list already play that role; keep them first.

## 2. Architecture (decided; build this)

### 2.1 Client-side tools in the loop

Add `clientTools?: ToolName[]` to `AgentDefinition`. A client-side tool is one the model calls and **the browser answers**. In `runStep`, when a round's calls include any client tool:

1. Run the server-side calls in that round as today; collect their `toolResult` blocks.
2. Do **not** run the client tools. Yield `{ t: "ask", id, name, input }` for each.
3. Return `{ messages, done: false, waiting: [{ id, name }] }`, where `messages` ends with the assistant turn and then a user turn holding the server-side results (omitted if none). The route emits `{ t: "state", messages, done: false, waiting }`.

In `run-client.ts`, `waiting` stops the round loop; `RunState` gains `waiting`, `Step` gains `kind: "ask"` with `input` and later `answer`. When the user answers, the client appends `{ toolResult: { toolUseId, content: [{ text: JSON }], status: "success" } }` to the trailing user turn (creating it if absent) and resumes `runAgent` with `state.messages`. Every `toolUse` is paired in the very next message, as Converse requires; the server holds nothing.

The system prompt tells the model to call client tools one at a time and alone; the mixed case is handled anyway (step 1).

Regression check before committing this chunk: one Clerk question through `curl -N -X POST /api/agents/chat` still streams to `done`, and `/agents/bill-reader` still answers in the dev server.

### 2.2 The Filer's tools (`tools.ts`, `run-tools.ts`)

| Tool | Runs | Input | Returns |
|---|---|---|---|
| `form_schema` | server | `{ form: "ldss-2921" \| "ocfs-6025" }` | Sections in order: `{ id, title, pages, consent, keys: [{ key, label, kind, options?, multi?, required?, repeat? }] }`. Compact. |
| `ask` | **client** | `{ section, title, intro?, fields: ChatField[], repeat?: { key, label, min, max } }` | A receipt, not the values: `{ section, answered: key[], skipped: key[] }` |
| `review` | **client** | `{ form }` | `{ confirmed: true, sections: number, answered: number }` |
| `fill_form` | **client** | `{ form }` | `{ ok, filename, pages, bytes, filled: number, unmapped: key[] }`; the delivery card appears |
| `remember` | **client** | `{ values: Record<CanonicalKey, string> }` | `{ kept: key[], rejected: key[] }` (§1.5) |

The model sequences; it never receives an answer's value. Values go from the widget into the profile in the browser and from the profile into the PDF. An SSN never enters the Converse conversation, and compaction of tool results (§1.1) cannot lose anything.

`ChatField = { key, label, kind, hint?, placeholder?, options?: string[] ("value|Label"), multi?, required?, tone?: "caution" | "info", href? }`, kinds `text | textarea | number | money | date | tel | email | ssn | select | radio | checkbox | yesno | attest`. `repeat` renders a group per household member (`[n]` keys). `ask` validates against the form's keys; an unknown key is an error result, not a widget.

The **browser is the ledger, and the ledger is a profile**. `lib/forms/profile.ts` holds one applicant profile in **canonical keys** (`lib/forms/keys.ts`: livingston's 109 `FORM_KEYS` as the vocabulary, extended with the OCFS-6025 concepts that have no LDSS-2921 twin, every key documented with `label`, `what`, `kind`, `options`) in localStorage, plus per-form state `{ form, done: section[], overrides }` (port of `form-answers.ts`). Every `ask` result merges into the profile. `form_schema` returns, per key, whether the profile already has a value; the Filer skips a section whose keys are all known and says so in one line, and `ask` renders known keys prefilled and collapsed with Edit. `review` and `fill_form` read the profile, never the transcript. The model only sequences. Finishing OCFS-6025 after LDSS-2921 must ask for nothing the first form already collected; that is the demo.

Profile data includes SSN and DOB. It stays in this browser (localStorage, same as the inbox), never reaches the agent route, and the delivery card offers "Forget everything" that clears profile, per-form state and inbox drafts. Account-backed encrypted storage is the next step and goes in the report as a gap, not in this build.

### 2.3 Data, maps and fill (`lib/forms/`)

- `lib/forms/programs.ts`: `ProgramForm` (sections) for both forms, from livingston, vocabulary unchanged. `lib/forms/keys.ts`: the canonical keys (§2.2). `formById`, `labelFor`, `optionsFor`, `optionParts`.
- `lib/forms/spec.ts`: the **FormSpec** type, data only, one file per form under `lib/forms/specs/`:
  ```ts
  type FormSpec = {
    id: "ldss-2921" | "ocfs-6025"; code: string; name: string; agency: string; revision: string
    base: string                       // /forms/<CODE>.pdf
    fields: FieldInfo[]                // every field the base has: name, type (text|check|radio|choice), page, rect, onValue?, label? (printed text beside it)
    map: Record<CanonicalKey, Binding | Binding[]>
    // Binding = { field: string; when?: string /* option value that checks this box */; format?: "ssn"|"date"|"money"|"phone"|"upper"; row?: number /* repeat index */ }
    fixups?: Array<{ field: string; rect?: [x, y, w, h]; fontSize?: number; multiline?: boolean }>
    blank: string[]                    // fields deliberately left empty (office use), so "every field accounted for" is checkable
  }
  ```
  `fields` is generated, `map`/`fixups`/`blank` are authored. A spec is complete when every field in `fields` is in `map`, `blank`, or listed in the report.
- `scripts/forms/annotate.mjs`: renders every page of a base PDF with each field's box outlined and its name printed inside, one PNG per page in your scratchpad (§1.4, map by sight).
- `scripts/forms/draft-spec.mjs`: given a PDF, prints a draft spec: every field with name, type, page, rect and the on-value read from `/AP /N`, plus the nearest printed label to its left or above from the text layer (pdf-lib for fields; `unpdf` or `pdfjs-dist` for positioned text, as tariffs does; for LDSS-2921 the label guesses already exist in `2921-field-map.json` and `2921-layout.json`). This is GSA's `/fields` and pdffiller's `generateFDFTemplate`, done once per PDF, and it is how the Forms table's 20,000 rows get specs later. Use it to build both specs now.
- `lib/forms/specs/ocfs-6025.ts`: `map` from the childcare lines, reconciled against all 429 fields; `fixups` for every field Brendan had to resize by hand (find them by rasterising: any box whose value is clipped or overflowing). 
- `lib/forms/specs/ldss-2921.ts`: `map` for all 109 keys (repeat keys per row), a comment per binding naming the printed label. **Build it by sight, do not guess it.** Run `annotate.mjs` on the base first and keep the renders open. Method, per key:
  1. Find the section's page(s) from `programs.ts`.
  2. In `2921-layout.json` find the printed label string for the key on that page (the label text is in `FORM_KEYS[].label`/`what` and the form's own wording in `sections[].asks`).
  3. In `2921-field-map.json` pick the text cell whose box starts to the right of that label (same row, `from: "left"`) or directly below it (`from: "above"`), on the same page; for a checkbox, the entry in `2921-checkboxes.json` whose label matches the option, then the field of the same page/x/y. Section 1 programs, the urgent list and language are already pinned by `fill-form.ts`'s coordinates; match those to fields by page + nearest x/y.
  4. Write the entry with the label as the comment.
  Then **prove it visually** (§3). Yes/no pairs with the question to the left of the boxes are mislabelled in the JSON (FINDINGS §10); expect to correct those by eye.
- `lib/forms/fill.ts`: **one** generic `fillForm(spec, values) → { blob, filename, pages, bytes, filled, unmapped }`, browser-side, no per-form fill code. Load the base, apply `fixups`, walk `map`: text via `setText` with the binding's `format` (SSN `123-45-6789` or digits only as the form prints it, dates as the form prints them, money `1,234.00`); checkboxes via `check()` only when `when` matches, else `uncheck()`; radios via `select(onValue)`; on-values always read from the field, never assumed. Then `embedFont(Helvetica)`, default-appearance font size 0 on every text field so values auto-fit their boxes, `form.updateFieldAppearances(font)`, `NeedAppearances true`, `save()` **without flattening** so the file stays editable. `unmapped` lists keys with a value but no binding; it must be empty for both forms by the end, or each remaining key is named in the report with the printed label it belongs to.
- Filename `<CODE>-<LastName>-<YYYY-MM-DD>.pdf`, no spaces.

### 2.4 Widgets (`components/chat/`)

- `ask-widget.tsx`: one section per widget. Keys the profile already knows arrive prefilled and collapsed to a one-line summary with Edit above the open fields, so a returning applicant sees what is known and types only what is not. Fields by kind on `@govblock/ui/components/nova/{input,textarea,select,checkbox,radio-group,field,label,button}`. Required fields block submit with the field marked, not a toast. SSN masks and validates 9 digits; date is a real date input; money is numeric with a `$` prefix; yes/no is two buttons; attest is a checkbox with its `href` (a page link into the PDF) beside it; `repeat` adds and removes rows. Submitted, the widget collapses to a read-only summary (label: value per line, muted) with an Edit link that reopens and re-submits. Dropdowns: `w-max min-w-44` on the content, `whitespace-nowrap` on items.
- `review-widget.tsx`: every section, every answer, grouped, click-to-edit, "Looks right" submits. Childcare's review step in govblock's clothes.
- `delivery-card.tsx`: shown when `fill_form` returns. **Download** (blob URL), **Email** (to self, or a county address with a copy, via `POST /api/forms/send`; result inline), **Save to inbox**. Fields filled and page count on one line.
- `progress.tsx`: sections done / total, from `FormProgress.tsx`, above the composer while a form is active.
- The tool→widget map `{ ask: AskWidget, review: ReviewWidget, fill_form: DeliveryCard }[step.name]` lives in `assist-chat.tsx` where `Step.kind === "ask"` is rendered.

### 2.5 Delivery

- **Email**: `app/api/forms/send/route.ts`, Resend, from livingston's `api/send-application.ts`. Body `{ to, cc?, county?, code, filename, pdf: base64 }`; `from` is `RESEND_FROM_EMAIL`. Missing key → `503 { error: "Email is not configured" }` and the button disabled with that reason. The key is present, so verify for real (§3).
- **Inbox**: extend `Attached.build` to `"report-pdf" | "form-pdf"`, add `form?: { id, values }` to `Message`: a snapshot of the values used at fill time, so the rebuilt file is the one that was delivered even after the profile changes. "Save to inbox" creates a **delivered** thread from the Filer (`newThread` + `reply` in `inbox.ts`; subject `<Form name> for <Last name>`; body one plain paragraph: programs applied for, sections answered, fields filled) with the attachment. sidebar-09's build handler dispatches on `build`; `form-pdf` calls `fillForm` from `message.form`. Read lines 200–240 there first; other sessions edited the inbox files in the last day.

### 2.6 Surfaces

- **`/chat`**: `app/chat/layout.tsx` reproduces `app/docs/layout.tsx` (`container-wrapper`, `SidebarProvider`, `DocsSidebar`); `app/chat/page.tsx` uses the column from `docs/bills/page.tsx` (`data-slot="docs"`, top spacing, the h1 row) with `AssistChat` filling the column at the directory width, not `max-w-160`, and the composer pinned to the column's bottom. Title "Chat". Starters: "Apply for SNAP or Public Assistance (LDSS-2921)", "Apply for child care assistance (OCFS-6025)", plus two of the Clerk's. `?form=ldss-2921` pre-seeds the first message.
- **Right panel**: `AssistPanel` keeps rendering `AssistChat`, compact variant.
- **`/docs/forms/[id]`**: when the row's number is one of the two forms, a "Fill this form" button to `/chat?form=…`. Form numbers render as the copy chip bills use.

### 2.7 The agent (`registry.ts`)

`slug: "form-filler"`, `name: "Filer"`, `tier: "grounded"`, `maxRounds: 64`, `tools: ["form_schema", "ask", "review", "fill_form", "remember"]`, `clientTools: ["ask", "review", "fill_form", "remember"]`. System prompt in the product's third-person register (the Clerk's prompt is the model): it fills the two NYS forms and nothing else; `form_schema` once, then `ask` per section in the form's order, one at a time; consent sections get one plain sentence on what they say and are not asked; it never restates answers or keeps a tally (the ledger does); after the last section, `review`, then `fill_form`, then one sentence on where the file went. Off-form questions get a brief answer and a return to the section. No "I", no cheerleading.

## 3. Verification (each is required; paste the evidence in the report)

1. **Field readback, both forms.** A script in your scratchpad (`node --experimental-strip-types` on Node 22.16, else `npx tsx`) fills each base PDF from a full sample profile through `fillForm`, reloads the output with pdf-lib, and prints every mapped field name with the value read back, then the spec accounting: fields in the base, bound, blank, unaccounted (must be 0), and `unmapped` keys (must be empty).
2. **Visual proof, LDSS-2921 and OCFS-6025.** Rasterise the filled PDFs with `/opt/homebrew/bin/pdftoppm -r 80 -png` into your scratchpad and **look at every data page** (LDSS-2921 pages 2–18, OCFS-6025 pages 1–5) with the Read tool. Every value must sit inside its box beside the right printed label. Fix the map, refill, look again. Keep the annotated renders and the final filled PNGs and name them in the report; Brendan will open the PDFs himself.
3. **Loop regression**: the Clerk curl and `/agents/bill-reader` after the loop change.
4. **The Filer over HTTP**: `POST /api/agents/chat` with `agent: "form-filler"` and a first turn returns a `state` with `waiting` whose `input.fields` are the first section's keys.
5. **Dev server**: `cd apps/web && BRENDAN_OK_LOCAL_BUILD=1 NODE_OPTIONS=--max-old-space-size=2048 ../../node_modules/.bin/next dev`; `/chat`, `/agents/form-filler`, `/docs/forms` compile and answer 200; kill it. Stop at "compiles and answers"; Brendan reviews in his own browser.
6. **Email for real**: send both sample filled PDFs once to `brendan@nysgpt.com` through the route; report the Resend message ids.
7. **The second form is prefilled.** With the sample profile in localStorage from an LDSS-2921 run, start OCFS-6025 and count the keys `ask` still has to open. Report that number and the list; it should be only what CCAP asks that the common application does not (provider, schedule, care reason).

## 4. Constraints (all binding)

- **No whole-project typecheck or eslint**; a hook blocks them. Bounded check: `cp /private/tmp/claude-501/-Users-brendanstanton-Code-govblock/454a5265-5aa1-475a-905c-6538316650ac/scratchpad/check.mjs apps/web/.check.mjs`, then from `apps/web`: `node --max-old-space-size=2048 .check.mjs 'lib/forms/**/*.ts' 'lib/agents/*.ts' 'lib/chat/*.ts' 'components/chat/*.tsx' 'app/chat/**/*.tsx' 'app/api/forms/**/*.ts' '../../packages/ui/src/components/nova/{message,bubble,message-scroller}.tsx'`. Delete `.check.mjs` before committing.
- **No local production builds.** Dev server only, as in §3.5.
- Every round and route under Amplify's 30-second cut. Rounds here are small; the PDF work is in the browser; the email route sends one attachment.
- **Commit in logical chunks on `design/workspace`** (117 commits ahead of `main`, unpushed). **Do not push.** Commit by path: `report-1.html`, `report-2.html`, `labor-committee-dashboard.html` and other untracked root files are not yours; `.env.local` is ignored and stays that way. Other sessions touched `lib/agents/{loop,registry,inbox,featured,report-modes}.ts`, `assist-panel.tsx`, `app/api/agents/chat/route.ts` and the watches inbox in the last day: read their current state before editing, keep diffs minimal, never reformat.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: <this session's URL from your system reminder>
  ```
- Voice and design rules from Brendan's CLAUDE.md apply to every string and component: third person, never "I"/"we"/"Claude"; no label that restates what the layout shows; pointed-at design (shadcn rendered demos, nova/ny4 primitives, no one-offs); copy chips for identifiers only.
- Do only what this brief asks. No cleanup or rewording in neighbouring files. Note anything adjacent that is broken in the report instead.

## 4b. Lead handoff (added 2026-09-08 while you were working)

A lead session is running alongside you and cannot message your session directly. Before step 4's LDSS-2921 spec is called done, read `/private/tmp/claude-501/-Users-brendanstanton-Code-govblock/lead-handoff/HARD-PARTS.md` (the rows of Sections 6, 15, 17, 18 keyed to the form's own columns, with the canonical keys that are still missing for two earners, monthly hours, pay frequency, training and school rows) and fill the base from `sample-profile.json` there (175 values: two adults, three children, three income sources, two jobs with hours, a child in school, an adult in training). The acceptance rule is in that file. `textract/TEXTRACT.md` there is Textract run on the state's 0-widget PDF: it confirms your p8 grid geometry independently and lists 179 checkboxes the base lacks, with labels, in `textract/added-checkboxes.json`. Read `coverage/FINDINGS.md` there before touching `fill.ts` again: commit b6d221c fixed checkbox appearances (the state's boxes ship empty streams) and turned NeedAppearances off; do not revert either. Anything else the lead leaves in that directory is named in `README.md` there.

## 5. Order of work and commits

1. `deps + forms data`: pnpm add; the two PDFs; `lib/forms/programs.ts`, `lib/forms/keys.ts`, `lib/forms/profile.ts`. Typecheck. Commit.
2. `chat ui`: the nova `message`/`bubble`/`message-scroller` primitives, `message-animated`, the InputGroup composer, new `AssistChat` on the existing `runAgent`, panel still working. Dev-server check. Commit.
3. `loop: client-side tools`: `clientTools`, `waiting`, `Step.kind = "ask"`, route `state.waiting`. Clerk regression. Commit.
4. `specs + fill`: `spec.ts`, `draft-spec.mjs`, `annotate.mjs`, both specs with maps and fixups, generic `fillForm`, readback script, rasterised pages reviewed and corrected. Commit only when both specs account for every field and `unmapped` is empty or every remaining key is explained.
5. `widgets`: ask, review, delivery card, progress, the tool→widget map. Commit.
6. `delivery`: Resend route, inbox `form-pdf` build and `Message.form`, sidebar-09 dispatch, the real test email. Commit.
7. `Filer + /chat`: registry entry and prompt, `form_schema`, `remember`, `/chat` page and layout, `/docs/forms/[id]` button, starters, the HTTP check. Commit.
8. `applicant profile page`: the `settings/applicant` tab on the dashboard, reading and writing the same profile store; verify a value entered there appears prefilled in `ask`. Commit.

## 6. Report (your final message)

1. What shipped, as the user meets it, five sentences or fewer.
2. Reused vs rebuilt, one table: file → source → ported whole / ported contract / new.
3. Verification evidence: per form, fields in base / bound / blank / unaccounted, keys unmapped, fixups applied; the PNG paths reviewed; the Resend message ids; the Clerk regression result; the second-form prefill count.
4. Gaps, each with the smallest next step: any LDSS-2921 key still without a field and the label it belongs to; account-backed encrypted profile storage; running `draft-spec.mjs` over the Forms table's inspected rows; anything you could not verify.
5. Commit list with hashes.
