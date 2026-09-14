# Brief: email-only sign-in and sign-up, 2026-09-13

For an Opus session in its own window. The auth-scope session (Fable) owns
the pages this plugs into and is watching this seat; report to it by name
with `SendMessage` (`ListAgents` shows the live names) at each checkpoint
below. Brendan reviews on `localhost:3001` in his own browser.

## What exists today

- Auth.js with `session: { strategy: "jwt" }` and **no database**: the
  session is a signed cookie. Providers: Google (production) and a dev
  Credentials provider that signs any email in with any password
  (`lib/auth/config.ts`, `devSignIn`). Nothing stores an account; nothing
  stores a password; there is no user table.
- The user id is minted once in the `jwt` callback by
  `userIdForSubject(account.providerAccountId)` from `lib/auth/contract.ts`
  (`u-` prefix, `USER_ID_PATTERN`). The session exposes `session.user.id` and
  `session.user.home`.
- `reader_profiles` on Aurora (`lib/profile.ts`, `getProfile`,
  `upsertProfile`, `/api/profile`) is keyed by that user id and holds the
  welcome form's answers. It has zero rows.
- An older `profiles` table (9 rows, uuid `user_id`, emails in
  `display_name`) and `user_favorites`, `user_member_favorites`,
  `user_bill_reviews`, `chat_sessions` are a previous app's. **Do not read,
  write, alter or migrate them.** Their future is a separate decision.
- Resend is installed (`resend` in package.json) and already used once, in
  `app/api/forms/send/route.ts`, from `RESEND_API_KEY` and
  `RESEND_FROM_EMAIL`. Both are set on the dev box.
- The database is Aurora Serverless v2 over the Data API: `lib/policy/db.ts`
  exports `q` and `one`. There is no local Postgres. DDL runs on the box with
  `aws rds-data execute-statement` (see "Working on the box").

## What to build

Email-only. No passwords, ever. A reader types an address and receives a
magic link. Opening the link signs them in and lands them where they belong:
a new reader on `/auth#section-4` (the welcome step), a returning reader on
`/home`. Nothing to type, one tap on a phone.

Sign-up and sign-in are the same mechanism. An address seen for the first
time becomes a reader when its first link is opened. The two differ only in
where the link lands.

### 1. Tables (new, ours)

```sql
create table readers (
  id            text primary key,          -- the Auth.js user id, u-…, USER_ID_PATTERN
  email         text not null unique,      -- lower-cased, trimmed
  created_at    timestamptz not null default now(),
  last_sign_in  timestamptz
);
create table sign_in_links (
  token_hash    text primary key,          -- sha256 of the token + AUTH_SECRET
  email         text not null,
  expires_at    timestamptz not null,      -- 15 minutes
  used_at       timestamptz,               -- one use
  created_at    timestamptz not null default now()
);
create index sign_in_links_email on sign_in_links (email, created_at desc);
```

`readers.id` for an email reader is `userIdForSubject(<uuid>)` minted at
creation. When a Google reader signs in, look the Google email up in
`readers`; if found, the token's `uid` is that reader's id; if not, create
the reader with the Google-derived id as today. One person, one id, however
they arrive.

### 2. Server side

- `lib/auth/email-link.ts` (server-only):
  - `LANDING = { newReader: "/auth#section-4", returning: "/home" }`,
    exported, one place, so the pages' owner can move them.
  - `requestLink(email, origin)`: validate, rate-limit (no more than one
    link per address per 60 s, no more than five per hour), mint a 32-byte
    random token, store its hash, and send `${origin}/api/auth/link?token=…`
    through Resend. Subject "Sign in to GovBlock", the link alone, nothing
    else worth reading. `origin` comes from the request's own headers
    (`host` and `x-forwarded-proto`), **not** from `AUTH_URL`, which on the
    dev box names port 3000 while Brendan reaches it on 3001. Returns
    `{ ok: true }` or a typed reason: `invalid`, `too-soon`, `send-failed`.
    In development, always also log the full link to the server console.
  - `consumeLink(token)`: find the unexpired, unused row by hash, mark it
    used, upsert `readers`, set `last_sign_in`. Returns `{ id, email,
    newReader }` or a typed reason: `expired`, `used`, `unknown`.
- A second Credentials provider in `lib/auth/config.ts`, id `"email-link"`,
  whose `authorize` takes `{ token }`, calls `consumeLink`, and returns
  `{ id, email }`. The `jwt` callback already mints from
  `account.providerAccountId`; make sure the id that reaches the token is
  the `readers.id`, not a fresh one.
- `app/api/auth/link/route.ts` (GET): reads `token`, calls
  `signIn("email-link", { token, redirect: false })`, then redirects to
  `LANDING.newReader` or `LANDING.returning`. A bad or spent token redirects
  to `/auth?error=LinkExpired`; add that code to the `ERRORS` map in
  `app/auth/page.tsx` — the one line in that file this seat may touch.
- One server action in `app/actions/sign-in.ts`: `sendLink(form: FormData)`
  → `requestLink(email, origin)`. No redirects from the action; it returns
  the result so the page can say "check your email".
- The dev Credentials provider stays for now; Brendan will say when it goes.

### 3. Not this seat's

The pages. `app/sign-in`, `app/sign-up`, `app/auth`, `components/sign-*`,
`components/welcome-steps.tsx`, `components/rails-frame.tsx`,
`components/rail-toggle.tsx`, `components/site-header.tsx`,
`components/motto.tsx`, `components/flag-*`, `app/layout.tsx`,
`lib/policy/*`, `lib/entitlements*`. The auth-scope session is editing them
and will wire the actions in once they exist. Do not open them.

## Working on the box

- The dev server runs on the EC2 box `govblock-dev`; the Mac reaches it at
  `localhost:3001`. **Do not start, stop or restart the box or the dev
  server.** The auth-scope session is in charge of it.
- Edit on the Mac. Sync only your files: from `apps/web`,
  `rsync -a --relative <paths> govblock-dev-direct:~/govblock/apps/web/`.
  Before the first sync, `ssh govblock-dev-direct "cd ~/govblock/apps/web &&
  git status --short <paths>"` and expect nothing back.
- DDL: on the box, `R=$(grep ^POLICY_CLUSTER_ARN= .env.local | cut -d= -f2-)`,
  `S=$(grep ^POLICY_SECRET_ARN= .env.local | cut -d= -f2-)`, then
  `aws rds-data execute-statement --region us-east-1 --resource-arn "$R"
  --secret-arn "$S" --database policy --sql "…"`.
- Type-check only the files you touched, with a `ts.createProgram` script
  rooted at those files under `node --max-old-space-size=2048`. Never run
  whole-project `tsc` or any `eslint`; a hook blocks both.
- No local production build. Nothing headless; curl the route for a status
  and read `sudo journalctl -u govblock-dev --since "2 min ago"` on the box
  for `⨯`. Brendan looks at the page himself.
- Prove it with curl against `localhost:3001`: request a link for a test
  address, read the link from the box's journal, open it with curl following
  no redirects, and show the `Location` it answers with and the session
  cookie's `/api/auth/session` answer carrying the reader's id. Then a
  second round with the same address, landing on `/home`. Then the same
  link a third time, landing on `/auth?error=LinkExpired`.
- Nothing gets committed. Brendan commits.

## Checkpoints

Message the auth-scope session when:

1. the tables exist on Aurora (show the DDL that ran);
2. the two functions and the provider are in and type-check;
3. the route and the action are in and the curl proof above is done — with
   the exact import path and signature of `sendLink`, the shape of every
   result it can return, and the two `LANDING` paths.

Then stop and wait. Brendan and the auth-scope session will QA it together.

## Standing rules

One shell command at a time. No subagents, no background work. Do only what
this brief asks. If something here turns out to be wrong, say so in the
checkpoint message rather than working around it.
