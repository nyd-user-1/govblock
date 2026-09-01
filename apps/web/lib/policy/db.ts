import { neon } from "@neondatabase/serverless"
import { RDSDataClient, ExecuteStatementCommand, type Field } from "@aws-sdk/client-rds-data"

// The policy database, read only.
//
// Production is Aurora Serverless v2 (PostgreSQL 17) reached over the RDS Data
// API: an HTTPS call signed with the hosting role, so the site needs no VPC
// attachment, no NAT gateway and no connection pool. `sql` is a tagged template
// with the same shape the Neon driver had, so every reader below is unchanged.
//
// POLICY_DATABASE_URL still wins when it is set, which keeps a laptop pointed at
// any plain Postgres. Absent both, `sql` is null and the pages fall back to their
// committed snapshots, so a build without secrets still renders.

export type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>

const url = process.env.POLICY_DATABASE_URL
const resourceArn = process.env.POLICY_CLUSTER_ARN
const secretArn = process.env.POLICY_SECRET_ARN
const database = process.env.POLICY_DATABASE ?? "policy"

// A Postgres array literal: the call sites write `${ids}::bigint[]`, so the cast
// sits in the SQL already and the parameter only has to arrive as `{1,2,3}`.
function arrayLiteral(values: unknown[]) {
  return `{${values
    .map((v) => {
      if (v === null || v === undefined) return "NULL"
      // Numbers go bare; everything else is quoted, including the string "NULL",
      // which unquoted would become a SQL null. Postgres accepts quoted elements
      // for any element type, so the ::bigint[] casts at the call sites still hold.
      if (typeof v === "number" || typeof v === "bigint") return String(v)
      return `"${String(v).replace(/(["\\])/g, "\\$1")}"`
    })
    .join(",")}}`
}

function parameter(name: string, value: unknown) {
  if (value === null || value === undefined) return { name, value: { isNull: true } }
  if (Array.isArray(value)) return { name, value: { stringValue: arrayLiteral(value) } }
  switch (typeof value) {
    case "number":
      return Number.isInteger(value)
        ? { name, value: { longValue: value } }
        : { name, value: { doubleValue: value } }
    case "boolean":
      return { name, value: { booleanValue: value } }
    case "bigint":
      return { name, value: { longValue: Number(value) } }
    default:
      return { name, value: { stringValue: String(value) } }
  }
}

// One Data API field -> one JS value. `formatRecordsAs: "JSON"` would be shorter
// but hands jsonb back as an unparsed string and drops column metadata, so the
// newsroom's sections would arrive as text. Decoding against the metadata keeps
// the driver swap invisible to every reader.
function decode(field: Field, typeName: string | undefined): unknown {
  const f = field as unknown as Record<string, unknown>
  if (f.isNull) return null
  if (f.arrayValue) {
    const inner = Object.values(f.arrayValue as Record<string, unknown>)[0]
    return Array.isArray(inner) ? inner : []
  }
  const value = (f.stringValue ?? f.longValue ?? f.doubleValue ?? f.booleanValue ?? null) as unknown
  if ((typeName === "json" || typeName === "jsonb") && typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function dataApiTag(client: RDSDataClient): SqlTag {
  return async (strings, ...values) => {
    const parameters = values.map((value, i) => parameter(`p${i}`, value))
    const statement = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `:p${i}` : ""), "")
    const response = await client.send(
      new ExecuteStatementCommand({
        resourceArn,
        secretArn,
        database,
        sql: statement,
        parameters,
        includeResultMetadata: true,
      })
    )
    const columns = response.columnMetadata ?? []
    return (response.records ?? []).map((record) => {
      const row: Record<string, unknown> = {}
      record.forEach((field, i) => {
        const column = columns[i]
        row[column?.name ?? `column${i}`] = decode(field, column?.typeName)
      })
      return row
    })
  }
}

// $1 -> :p0, but only where it is really a placeholder. A scanner rather than a
// regex because '$1' inside a string literal is data, "$1" is an identifier, and
// $$ ... $$ is a quoted body — Postgres treats all three as text, and so must we.
// $10 has to survive as one number, not :p0 followed by a stray 0.
export function toNamedParameters(text: string) {
  let out = ""
  let i = 0
  let highest = -1
  while (i < text.length) {
    const c = text[i]
    const rest = text.slice(i)
    if (c === "'" || c === '"') {
      // A quote doubled inside its own literal escapes it: 'it''s'.
      const quote = c
      let j = i + 1
      while (j < text.length) {
        if (text[j] === "\\") j += 2
        else if (text[j] === quote) {
          if (text[j + 1] === quote) j += 2
          else break
        } else j += 1
      }
      out += text.slice(i, j + 1)
      i = j + 1
      continue
    }
    const dollarTag = /^\$[A-Za-z_]*\$/.exec(rest)
    if (dollarTag) {
      const tag = dollarTag[0]
      const close = text.indexOf(tag, i + tag.length)
      const end = close === -1 ? text.length : close + tag.length
      out += text.slice(i, end)
      i = end
      continue
    }
    if (rest.startsWith("--")) {
      const nl = text.indexOf("\n", i)
      const end = nl === -1 ? text.length : nl
      out += text.slice(i, end)
      i = end
      continue
    }
    if (rest.startsWith("/*")) {
      const close = text.indexOf("*/", i + 2)
      const end = close === -1 ? text.length : close + 2
      out += text.slice(i, end)
      i = end
      continue
    }
    const placeholder = /^\$(\d+)/.exec(rest)
    if (placeholder) {
      const index = Number(placeholder[1]) - 1
      highest = Math.max(highest, index)
      out += `:p${index}`
      i += placeholder[0].length
      continue
    }
    out += c
    i += 1
  }
  return { text: out, highest }
}

function build(): SqlTag | null {
  if (url) return neon(url) as unknown as SqlTag
  if (resourceArn && secretArn) {
    return dataApiTag(new RDSDataClient({ region: process.env.AWS_REGION ?? "us-east-1" }))
  }
  return null
}

export const sql = build()

// The positional interface livingston-v3's queries are written against —
// `q("select ... where state = $1", [state])` — so ~46 KB of working SQL ports
// without being rewritten. Over the Data API the placeholders are renamed; over
// a plain Postgres URL the driver already speaks $n.
const client = resourceArn && secretArn && !url ? new RDSDataClient({ region: process.env.AWS_REGION ?? "us-east-1" }) : null

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  if (url) {
    const neonClient = neon(url) as unknown as { query: (t: string, p: unknown[]) => Promise<unknown> }
    return (await neonClient.query(text, params)) as T[]
  }
  if (!client) throw new Error("no policy database configured")

  const statement = toNamedParameters(text)
  const response = await client.send(
    new ExecuteStatementCommand({
      resourceArn,
      secretArn,
      database,
      sql: statement.text,
      parameters: params.map((value, i) => parameter(`p${i}`, value)),
      includeResultMetadata: true,
    })
  )
  const columns = response.columnMetadata ?? []
  return (response.records ?? []).map((record) => {
    const row: Record<string, unknown> = {}
    record.forEach((field, i) => {
      const column = columns[i]
      row[column?.name ?? `column${i}`] = decode(field, column?.typeName)
    })
    return row as T
  })
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params)
  return rows[0] ?? null
}

export const n = (value: unknown) => Number(value ?? 0)

export function hasDatabase() {
  return !!sql
}

/** Which backend answered, for the health route and the footer's source badge. */
export function databaseKind(): "aurora-data-api" | "postgres-url" | "none" {
  if (url) return "postgres-url"
  if (resourceArn && secretArn) return "aurora-data-api"
  return "none"
}
