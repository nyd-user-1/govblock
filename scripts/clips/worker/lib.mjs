// What the worker box's scripts share: Aurora over the Data API, a file sent
// to Stream by tus, and the wait for Stream to have it ready. Credentials come
// from the environment or from apps/web/.env.local beside the checkout; the
// box's instance role signs the Data API calls.

import { randomBytes } from "node:crypto"
import { existsSync, openSync, readSync, closeSync, readFileSync, statSync, appendFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ExecuteStatementCommand, RDSDataClient } from "@aws-sdk/client-rds-data"

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

/* ---- Stream ---- */

const API = "https://api.cloudflare.com/client/v4"
const account = () => env("CLOUDFLARE_ACCOUNT_ID")
const token = () => env("CLOUDFLARE_STREAM_TOKEN") || env("CLOUDFLARE_API_TOKEN")

async function cf(path, init = {}) {
  const res = await fetch(`${API}/accounts/${account()}${path}`, { ...init, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) } })
  const body = await res.json()
  if (!body.success) throw new Error(body.errors?.[0] ? `${body.errors[0].code}: ${body.errors[0].message}` : `${res.status}`)
  return body.result
}

const b64 = (s) => Buffer.from(String(s), "utf8").toString("base64")

/** A local file to Stream by tus, 50 MiB a request; returns the video's uid. */
export async function uploadFile(file, { name, creator, requireSignedURLs = false, onProgress } = {}) {
  const size = statSync(file).size
  const metadata = [`name ${b64(name.slice(0, 120))}`, ...(requireSignedURLs ? ["requiresignedurls"] : [])].join(",")
  const create = await fetch(`${API}/accounts/${account()}/stream?direct_user=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(size), "Upload-Metadata": metadata, ...(creator ? { "Upload-Creator": creator } : {}) },
  })
  const location = create.headers.get("location")
  if (!create.ok || !location) {
    const body = await create.json().catch(() => null)
    throw new Error(body?.errors?.[0] ? `${body.errors[0].code}: ${body.errors[0].message}` : `tus create ${create.status}`)
  }
  const uid = create.headers.get("stream-media-id") ?? /\/([a-f0-9]{32})(?:\?|$)/.exec(location)?.[1]
  const CHUNK = 200 * 262_144
  const fd = openSync(file, "r")
  try {
    let offset = 0
    while (offset < size) {
      const length = Math.min(CHUNK, size - offset)
      const buf = Buffer.alloc(length)
      readSync(fd, buf, 0, length, offset)
      const res = await fetch(location, { method: "PATCH", headers: { "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: buf })
      if (!res.ok) throw new Error(`tus PATCH at ${offset} answered ${res.status}`)
      offset = Number(res.headers.get("upload-offset")) || offset + length
      onProgress?.(offset / size)
    }
  } finally {
    closeSync(fd)
  }
  return uid
}

/** Waits for Stream to finish the video and its MP4; returns its duration and size. */
export async function whenReady(uid, { timeoutMs = 30 * 60_000 } = {}) {
  const started = Date.now()
  let downloadAsked = false
  for (;;) {
    const v = await cf(`/stream/${uid}`)
    if (v.status?.state === "error") throw new Error(`Stream could not process ${uid}: ${v.status?.errorReasonText ?? "error"}`)
    if (v.readyToStream) {
      const d = await cf(`/stream/${uid}/downloads`, { method: downloadAsked ? "GET" : "POST" })
      downloadAsked = true
      if (d?.default?.status === "ready") return { duration: v.duration, width: v.input?.width ?? null, height: v.input?.height ?? null }
    }
    if (Date.now() - started > timeoutMs) throw new Error(`Stream did not finish ${uid} in time`)
    await new Promise((r) => setTimeout(r, 5000))
  }
}
