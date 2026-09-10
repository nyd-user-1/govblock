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
