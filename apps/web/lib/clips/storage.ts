import "server-only"

import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Where a clip's video and poster are kept (Brendan, 2026-09-14): a private
// S3 bucket, not Cloudflare Stream. The browser sends the bytes straight to
// the bucket on a signed address the server hands out, and the feed plays a
// clip from a signed address minted each time the feed is read, so an address
// lapses and the clip does not. Signed by the server's role: the Amplify
// compute role on the site, the instance role on a box.

export const CLIPS_BUCKET = process.env.CLIPS_BUCKET || "govblock-clips-638175140432"

let client: S3Client | null = null
const s3 = () => (client ??= new S3Client({ region: process.env.AWS_REGION || "us-east-1" }))

/** A one-time address the browser PUTs the file to, good for an hour. The Content-Type sent must match. */
export function uploadUrl(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: CLIPS_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 3600 })
}

/** An address to play or show the object, good for an hour. */
export function playUrl(key: string) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: CLIPS_BUCKET, Key: key }), { expiresIn: 3600 })
}

/** The object's size and type, or null when nothing was sent. */
export async function stat(key: string) {
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: CLIPS_BUCKET, Key: key }))
    return { bytes: Number(head.ContentLength ?? 0), type: head.ContentType ?? null }
  } catch {
    return null
  }
}

export async function removeObjects(keys: (string | null | undefined)[]) {
  const objects = keys.filter((k): k is string => !!k).map((Key) => ({ Key }))
  if (!objects.length) return
  await s3().send(new DeleteObjectsCommand({ Bucket: CLIPS_BUCKET, Delete: { Objects: objects, Quiet: true } }))
}

/** A file name's extension from its content type, for the key. */
export const extensionOf = (contentType: string) => (/mp4/.test(contentType) ? "mp4" : /quicktime/.test(contentType) ? "mov" : /webm/.test(contentType) ? "webm" : /jpeg|jpg/.test(contentType) ? "jpg" : "bin")
