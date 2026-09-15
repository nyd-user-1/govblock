// What the worker box's scripts share: Aurora over the Data API, and files in
// and out of the clips bucket. Credentials come
// from the environment or from apps/web/.env.local beside the checkout; the
// box's instance role signs the Data API calls.

import { randomBytes } from "node:crypto"
import { appendFileSync, createReadStream, createWriteStream, existsSync, readFileSync, statSync } from "node:fs"
import { pipeline } from "node:stream/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ExecuteStatementCommand, RDSDataClient } from "@aws-sdk/client-rds-data"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ENV_FILE = join(ROOT, "apps/web/.env.local")
const fileEnv = existsSync(ENV_FILE)
  ? Object.fromEntries(
      readFileSync(ENV_FILE, "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
    )
  : {}
export const env = (key) => process.env[key] ?? fileEnv[key]

export const newId = (prefix) => `${prefix}_${randomBytes(8).toString("hex")}`

/** Named args: --meeting 119395 --desk house-ag --publish → { meeting: "119395", desk: "house-ag", publish: true }. */
export function args(argv = process.argv.slice(2)) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) out[key] = true
    else out[key] = argv[++i]
  }
  return out
}

/** A line to stdout and, when a log is named, to the log. */
export function logger(file) {
  return (...parts) => {
    const line = `${new Date().toISOString()}  ${parts.join(" ")}`
    console.log(line)
    if (file) appendFileSync(file, line + "\n")
  }
}

/* ---- Aurora ---- */

const rds = new RDSDataClient({ region: env("AWS_REGION") || "us-east-1" })
const field = (v) => (v === null || v === undefined ? { isNull: true } : typeof v === "number" ? (Number.isInteger(v) ? { longValue: v } : { doubleValue: v }) : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) })
const decode = (f) => (f?.isNull ? null : (f?.stringValue ?? f?.longValue ?? f?.doubleValue ?? f?.booleanValue ?? null))

export async function q(sql, params = []) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await rds.send(
        new ExecuteStatementCommand({
          resourceArn: env("POLICY_CLUSTER_ARN"),
          secretArn: env("POLICY_SECRET_ARN"),
          database: env("POLICY_DATABASE") || "policy",
          sql: sql.replace(/\$(\d+)/g, (_, i) => `:p${Number(i) - 1}`),
          parameters: params.map((v, i) => ({ name: `p${i}`, value: field(v) })),
          includeResultMetadata: true,
          continueAfterTimeout: true,
        })
      )
      const cols = r.columnMetadata ?? []
      return (r.records ?? []).map((rec) => Object.fromEntries(rec.map((f, i) => [cols[i]?.name ?? `c${i}`, decode(f)])))
    } catch (error) {
      // Aurora wakes from zero ACU with DatabaseResumingException for ~20 s.
      if (!/Resuming|resuming after being auto-paused|Throttl/i.test(String(error?.name) + String(error?.message)) || attempt > 20) throw error
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
}

/* ---- the clips bucket ---- */

// Clips live in the private S3 bucket (apps/web/lib/clips/storage.ts), written
// here under the box's instance role.

export const CLIPS_BUCKET = env("CLIPS_BUCKET") || "govblock-clips-638175140432"
const s3 = new S3Client({ region: env("AWS_REGION") || "us-east-1" })

/** A local file into the bucket under `key`. */
export async function putFile(file, key, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: CLIPS_BUCKET, Key: key, Body: createReadStream(file), ContentLength: statSync(file).size, ContentType: contentType }))
  return key
}

/** An object in the bucket, to a local file. */
export async function getFile(key, file) {
  const res = await s3.send(new GetObjectCommand({ Bucket: CLIPS_BUCKET, Key: key }))
  await pipeline(res.Body, createWriteStream(file))
  return file
}
