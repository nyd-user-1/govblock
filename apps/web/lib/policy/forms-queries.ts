import { createHash, createHmac } from "node:crypto"

import { RDSDataClient } from "@aws-sdk/client-rds-data"

import { q } from "@/lib/policy/db"

// The Forms surface reads the `"Forms"` table the 2026-08-30 harvest left
// behind: 392,182 catalogued PDFs, 369,735 of them fetched and living in S3.
//
// This file is the whole read side. It is separate from `db-queries.ts` on
// purpose — that file is the legislative record, and lane D owns it — and it is
// server-only: it signs S3 URLs.

/* ------------------------------------------------------------------ the cut */

// A row we have actually downloaded. `catalogued` rows have a URL and nothing
// else; `failed` rows have an error. Neither can be shown.
const FETCHED = `f.status in ('fetched-live','fetched-archive')`

// The filename, and the filename without its extension. The harvest wrote
// `form_number` on 3.2% of rows and the filename on all of them, and a
// government form is usually named after itself — `it201_2016.pdf`,
// `2921-DD.pdf`, `wh347.pdf` — so the stem is the better form number, and the
// only one 96.8% of the corpus has.
const FILE = `regexp_replace(f.s3_key, '^.*/', '')`
const STEM = `regexp_replace(${FILE}, '\\.[Pp][Dd][Ff]$', '')`

// A stem shaped like a form number: letters, then digits, optionally a suffix.
const NUMBERED = `${FILE} ~* '^[a-z][a-z0-9]{0,9}[-_ ]?[0-9]{1,6}([-_][0-9a-z]{1,6})?\\.pdf$'`

const FIELDS = `jsonb_array_length(coalesce(f.fillable_fields, '[]'::jsonb))`

/**
 * Forms, as distinct from documents — measured on 2026-09-02 and reported in
 * `prompts/2026-09-02-forms-surface.md`.
 *
 * A row is a form when it names its own number, or when we opened it and found
 * fields to fill in, or when we opened it and its filename is a form number.
 *
 * The third clause is gated on `inspected_at` for a reason worth keeping: the
 * stem alone admits 58,853 rows, 8,356 of them US DOL, and DOL's are not forms
 * — `TEN_21-21.pdf` is a Training and Employment Notice, `op_01-81.pdf` an
 * opinion letter, `cba_8628.pdf` a collective bargaining agreement. DOL is also
 * the one large family the harvest never opened. Requiring that we opened the
 * PDF costs nothing where inspection happened (every agency but DOL and
 * USDA-FNS is inspected in full) and removes the entire false-positive family.
 *
 * 48,684 rows pass. The other 321,051 are reachable under `all`, which is the
 * "All documents" toggle, and are never called forms.
 */
const FORM_CUT = `(
  (f.form_number is not null and f.form_number <> '')
  or ${FIELDS} > 0
  or (f.inspected_at is not null and ${NUMBERED})
)`

/** The 195,530 rows we hold but have never opened, and so cannot triage. */
export const UNINSPECTED_AGENCIES = ["DOL", "USDA-FNS"] as const

/**
 * The order the list reads in: strongest evidence that a thing is a form,
 * first. Written after looking at the first deploy, which sorted by agency and
 * number alone and therefore opened on `01-chapter1-ncci-medicaid-policy-manual`
 * under Congress and eleven identical `brc-1062-*` rows under New York — the
 * least form-like rows in the corpus, on the first screen of a page about forms.
 *
 * Three fields or more is the line. One stray field is what a PDF picks up by
 * accident; three is somebody building something to be filled in. After that a
 * row that says what it is beats one that does not, and a published number
 * beats a filename. Agency and number break the tie, so the order stays
 * legible rather than looking shuffled.
 *
 * This ranks rows; it never hides them. Everything the cut admits is still in
 * the list, and the count above it is still Aurora's.
 */
const EVIDENCE = `
  (${FIELDS} >= 3) desc,
  (f.title is not null and f.title <> '') desc,
  (f.form_number is not null and f.form_number <> '') desc`

/* ------------------------------------------------------------------- scope */

/**
 * Which `gov` values a jurisdiction sees. `null` means the site is scoped to a
 * state we have harvested nothing for — the caller says so rather than showing
 * New York's forms under Ohio's name.
 */
export function formsScope(state: string): string[] | null {
  const code = (state || "").toUpperCase()
  if (code === "US") return ["US"]
  if (code === "NY") return ["NYS", "NYC"]
  return null
}

/* -------------------------------------------------------------------- rows */

export type FormRow = {
  id: number
  gov: string
  agency: string
  /** `form_number` when the harvest found one, else the filename stem. */
  number: string
  /** True when `number` came from the column rather than the filename. */
  numbered: boolean
  title: string | null
  /** The filename, extension and all. It is what tells `doh-4328_yi.pdf` from
   *  `doh-4328_ko.pdf` when both carry the title "DOH-4328". */
  file: string
  pages: number | null
  bytes: number | null
  fields: number
  /** The Wayback capture, `YYYY-MM-DD`. The only date on the row that carries
   *  information: `fetched_at` is the harvest weekend on every row. */
  archived: string | null
  inspected: boolean
}

export type FormDetail = FormRow & {
  url: string
  s3_key: string
  sha256: string | null
  status: string
  /** Field names, as the inspector read them out of the PDF. */
  fieldNames: string[]
}

export type FormsFacet = { value: string; count: number }

export type FormsResult = {
  count: number
  rows: FormRow[]
  facets: { gov: FormsFacet[]; agency: FormsFacet[] }
  /** Rows under this scope that pass the cut, whatever the current filters. */
  forms: number
  /** Every fetched row under this scope, forms and documents together. */
  documents: number
}

const SELECT = `
  f.id,
  f.gov,
  f.agency,
  coalesce(nullif(f.form_number, ''), ${STEM}) as number,
  (f.form_number is not null and f.form_number <> '') as numbered,
  nullif(f.title, '') as title,
  ${FILE} as file,
  f.pages,
  f.bytes,
  ${FIELDS} as fields,
  to_char(to_timestamp(nullif(f.wayback_ts, ''), 'YYYYMMDDHH24MISS'), 'YYYY-MM-DD') as archived,
  (f.inspected_at is not null) as inspected
`

function row(record: Record<string, unknown>): FormRow {
  return {
    id: Number(record.id),
    gov: String(record.gov ?? ""),
    agency: String(record.agency ?? ""),
    number: String(record.number ?? ""),
    numbered: record.numbered === true || record.numbered === "true",
    title: (record.title as string | null) ?? null,
    file: String(record.file ?? ""),
    pages: record.pages === null || record.pages === undefined ? null : Number(record.pages),
    bytes: record.bytes === null || record.bytes === undefined ? null : Number(record.bytes),
    fields: Number(record.fields ?? 0),
    archived: (record.archived as string | null) ?? null,
    inspected: record.inspected === true || record.inspected === "true",
  }
}

export type FormsQuery = {
  state: string
  agency?: string | null
  q?: string | null
  /** Only rows with at least one fillable field. */
  fillable?: boolean
  /** Drop the forms cut: every fetched PDF, documents included. */
  all?: boolean
  page?: number
  limit?: number
}

export async function getForms(input: FormsQuery): Promise<FormsResult | null> {
  const govs = formsScope(input.state)
  if (!govs) return null

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const page = Math.max(input.page ?? 1, 1)
  const offset = (page - 1) * limit
  const term = (input.q ?? "").trim()
  const agency = (input.agency ?? "").trim()

  // Every predicate is built the same way for the three statements below, so a
  // filter can never apply to the rows and not to the count beside them.
  const cut = input.all ? "true" : FORM_CUT
  const params: unknown[] = [govs]
  const where: string[] = [FETCHED, `f.gov = any($1::text[])`, cut]

  if (term) {
    // `like` on three columns rather than one: the number is in `form_number`
    // for 3.2% of rows and in the filename for the rest, and a reader typing
    // "IT-201" means both. The partial index answers the scope and the filter
    // runs over what it hands back — 10 ms on the 38,727 New York rows.
    params.push(`%${term.toUpperCase()}%`, `%${term.toLowerCase()}%`)
    where.push(`(upper(f.form_number) like $${params.length - 1}
             or lower(f.title) like $${params.length}
             or lower(f.s3_key) like $${params.length})`)
  }
  if (input.fillable) where.push(`${FIELDS} > 0`)

  const scoped = where.join("\n    and ")
  // The agency facet is computed without the agency filter, so choosing one
  // does not empty the card you chose it from.
  const filtered = agency ? `${scoped}\n    and f.agency = $${params.length + 1}` : scoped
  const rowParams = agency ? [...params, agency] : params

  const [rows, counted, facets, totals] = await Promise.all([
    q<Record<string, unknown>>(
      `select ${SELECT}
       from "Forms" f
       where ${filtered}
       order by ${term ? `(upper(f.form_number) = $${rowParams.length + 1}) desc, (lower(${STEM}) = $${rowParams.length + 2}) desc,` : ""}
                ${EVIDENCE}, f.agency asc, number asc, f.id asc
       limit ${limit} offset ${offset}`,
      term ? [...rowParams, term.toUpperCase(), term.toLowerCase()] : rowParams
    ),
    q<Record<string, unknown>>(`select count(*)::int as n from "Forms" f where ${filtered}`, rowParams),
    q<Record<string, unknown>>(
      `select f.gov, f.agency, count(*)::int as n from "Forms" f where ${scoped} group by 1, 2`,
      params
    ),
    // What the scope holds, before any filter — the two numbers the page's
    // sentence and its toggle are allowed to say out loud.
    q<Record<string, unknown>>(
      `select count(*) filter (where ${FORM_CUT})::int as forms, count(*)::int as documents
       from "Forms" f where ${FETCHED} and f.gov = any($1::text[])`,
      [govs]
    ),
  ])

  const byGov = new Map<string, number>()
  const byAgency = new Map<string, number>()
  for (const record of facets) {
    const n = Number(record.n ?? 0)
    const g = String(record.gov ?? "")
    const a = String(record.agency ?? "")
    byGov.set(g, (byGov.get(g) ?? 0) + n)
    byAgency.set(a, (byAgency.get(a) ?? 0) + n)
  }
  const facet = (map: Map<string, number>): FormsFacet[] =>
    [...map].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))

  return {
    count: Number(counted[0]?.n ?? 0),
    rows: rows.map(row),
    facets: { gov: facet(byGov), agency: facet(byAgency) },
    forms: Number(totals[0]?.forms ?? 0),
    documents: Number(totals[0]?.documents ?? 0),
  }
}

export async function getForm(id: number): Promise<FormDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const rows = await q<Record<string, unknown>>(
    `select ${SELECT}, f.url, f.s3_key, f.sha256, f.status,
            coalesce(f.fillable_fields, '[]'::jsonb) as fillable_fields
     from "Forms" f where f.id = $1 and ${FETCHED}`,
    [id]
  )
  const record = rows[0]
  if (!record) return null
  // Over the Data API jsonb decodes to a value; over a plain Postgres URL the
  // driver has already parsed it. Either way only strings are field names.
  const raw = record.fillable_fields
  const parsed = typeof raw === "string" ? safeParse(raw) : raw
  const fieldNames = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  return {
    ...row(record),
    url: String(record.url ?? ""),
    s3_key: String(record.s3_key ?? ""),
    sha256: (record.sha256 as string | null) ?? null,
    status: String(record.status ?? ""),
    fieldNames,
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * A field name we can show a reader.
 *
 * On an encrypted or compressed PDF the inspector wrote the raw bytes rather
 * than the decoded name, so
 * `["ð4¶:C", "*Pku", "Z³§Ì", …]` is what NYS DMV's `mv-994` carries. Printing
 * that as a schema would be a lie about what we know, and §4 of the brief calls
 * this list the schema the Clerk agent interviews against. The form page counts
 * the unreadable ones and says how many rather than drawing them.
 */
export function readableField(name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed === "undefined") return false
  // Printable ASCII, and at least one letter or digit in it.
  if (!/^[\x20-\x7E]+$/.test(trimmed)) return false
  return /[A-Za-z0-9]/.test(trimmed)
}

/* --------------------------------------------------------- the PDF, from S3 */

const BUCKET = process.env.FORMS_BUCKET ?? "livingston-bill-pdfs-638175140432"
const REGION = process.env.AWS_REGION ?? "us-east-1"

type Credentials = { accessKeyId: string; secretAccessKey: string; sessionToken?: string }

// The credential chain, borrowed rather than installed.
//
// Presigning normally means `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`,
// and adding those to `apps/web/package.json` means a `pnpm-lock.yaml` change in
// a checkout three lanes are committing to this morning. SigV4 for a GET is
// forty lines of `node:crypto`, and `@aws-sdk/client-rds-data` — already a
// dependency, already how this app reaches Aurora — carries the resolved
// credential provider the compute role hands the runtime. So: no new dependency,
// no lockfile, same credentials the database reads use.
let resolveCredentials: (() => Promise<Credentials>) | null = null

function credentials(): Promise<Credentials> {
  if (!resolveCredentials) {
    const client = new RDSDataClient({ region: REGION })
    resolveCredentials = client.config.credentials as unknown as () => Promise<Credentials>
  }
  return resolveCredentials()
}

// RFC 3986. `encodeURIComponent` leaves ! ' ( ) * alone and S3 does not.
const escape = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// A key is a path: the slashes between its segments stay slashes.
const escapePath = (key: string) => key.split("/").map(escape).join("/")

const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest()

/**
 * A presigned S3 GET for one form's PDF, good for fifteen minutes.
 *
 * The bucket is private and stays private: nothing about it is made public,
 * and the URL is minted per request on the server. PDF bytes never pass through
 * the Data API or this app — the browser fetches them from S3 directly.
 *
 * The compute role needs exactly one statement:
 *   s3:GetObject on arn:aws:s3:::livingston-bill-pdfs-638175140432/forms/*
 */
export async function presignForm(key: string, expiresIn = 900): Promise<string | null> {
  if (!key) return null
  // The role is scoped to `forms/*`; anything else would 403 at S3 anyway, and
  // refusing here means a bad `s3_key` cannot be used to probe the bucket.
  if (!key.startsWith("forms/")) return null

  let credential: Credentials
  try {
    credential = await credentials()
  } catch {
    return null
  }
  if (!credential?.accessKeyId || !credential?.secretAccessKey) return null

  const host = `${BUCKET}.s3.${REGION}.amazonaws.com`
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${REGION}/s3/aws4_request`

  const query: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${credential.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ]
  // A role's credentials are temporary, so the token is part of the signature.
  if (credential.sessionToken) query.push(["X-Amz-Security-Token", credential.sessionToken])

  const canonicalQuery = query
    .map(([name, value]) => [escape(name), escape(value)] as [string, string])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&")

  const path = `/${escapePath(key)}`
  const canonicalRequest = ["GET", path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n")
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n")
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${credential.secretAccessKey}`, day), REGION), "s3"), "aws4_request")
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex")

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`
}
