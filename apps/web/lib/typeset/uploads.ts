import "server-only"

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

// Where the Typeset editor keeps what a reader drops into a document
// (2026-09-09): one private S3 bucket, created for this, under the site's
// own AWS credentials. Nothing in it is public; the app streams a file back
// through /api/typeset/file/<key>, which is the URL the document carries.
// The template used UploadThing, which wants an account; this wants a bucket.

export const BUCKET =
  process.env.TYPESET_UPLOADS_BUCKET ?? "govblock-uploads-638175140432"
const REGION = process.env.AWS_REGION ?? "us-east-1"

/** 25 MB: a scan of a bill or a short clip; not a film. */
export const MAX_BYTES = 25 * 1024 * 1024

/**
 * What a document may carry, by extension, and the type it is stored and
 * served as. Nothing that a browser would run: no HTML, no SVG, no scripts.
 */
export const ALLOWED_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
}

/** Shown in the page rather than downloaded: the kinds a browser renders safely. */
export const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf", "video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/wav"])

/** The type a file is stored as: from its extension, and only when the client's declared type agrees or is blank. */
export function typeOf(name: string, declared: string): string | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  const type = ext ? ALLOWED_TYPES[ext] : undefined
  if (!type) return null
  const said = declared.split(";")[0].trim().toLowerCase()
  if (said && said !== type && !(said === "image/jpg" && type === "image/jpeg")) return null
  return type
}

let client: S3Client | null = null
export function s3() {
  if (!client) client = new S3Client({ region: REGION })
  return client
}

const safe = (name: string) =>
  name
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file"

/** A key under a month, so the bucket's listing reads as a calendar. */
export function keyFor(name: string) {
  const d = new Date()
  const stamp = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  return `typeset/${stamp}/${crypto.randomUUID()}-${safe(name)}`
}

export async function putUpload(key: string, body: Uint8Array, type: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: type || "application/octet-stream",
    })
  )
}

export async function getUpload(key: string) {
  return s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
}

/** The URL a document keeps for a key: ours, not the bucket's. */
export const fileUrl = (key: string) =>
  `/api/typeset/file/${key.split("/").map(encodeURIComponent).join("/")}`
