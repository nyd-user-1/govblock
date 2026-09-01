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
      const s = String(v)
      return /^[A-Za-z0-9_.+-]+$/.test(s) ? s : `"${s.replace(/(["\\])/g, "\\$1")}"`
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

function build(): SqlTag | null {
  if (url) return neon(url) as unknown as SqlTag
  if (resourceArn && secretArn) {
    return dataApiTag(new RDSDataClient({ region: process.env.AWS_REGION ?? "us-east-1" }))
  }
  return null
}

export const sql = build()

export function hasDatabase() {
  return !!sql
}

/** Which backend answered, for the health route and the footer's source badge. */
export function databaseKind(): "aurora-data-api" | "postgres-url" | "none" {
  if (url) return "postgres-url"
  if (resourceArn && secretArn) return "aurora-data-api"
  return "none"
}
