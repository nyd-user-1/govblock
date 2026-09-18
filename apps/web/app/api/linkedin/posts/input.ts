import { IMAGES_MAX, POST_MAX, type PostImage, type PostTarget } from "@/lib/linkedin/types"
import type { PostInput } from "@/lib/linkedin/store"

const TARGETS: PostTarget[] = ["profile", "company", "both"]

/** Where a reader's post images are kept; a post may name only these. */
export const imageFolder = (userId: string) => `linkedin/${userId.replace(/[^\w-]/g, "")}/`

/** The fields a request may set, checked; an error string when one is wrong. */
export function readInput(body: Record<string, unknown>, userId: string): PostInput | string {
  const input: PostInput = {}
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.length > 200) return "title must be text of at most 200 characters"
    input.title = body.title
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string" || body.body.length > POST_MAX) return `body must be text of at most ${POST_MAX} characters`
    input.body = body.body
  }
  if (body.target !== undefined) {
    if (!TARGETS.includes(body.target as PostTarget)) return "target must be profile, company or both"
    input.target = body.target as PostTarget
  }
  if (body.publishAt !== undefined) {
    if (typeof body.publishAt !== "string" || Number.isNaN(Date.parse(body.publishAt))) return "publishAt must be an ISO date-time"
    input.publishAt = new Date(body.publishAt).toISOString()
  }
  if (body.images !== undefined) {
    const images = body.images as PostImage[]
    const ok = Array.isArray(images) && images.length <= IMAGES_MAX && images.every((i) => i && typeof i.key === "string" && i.key.startsWith(imageFolder(userId)) && /^linkedin\/[\w-]+\/[\w-]+\.(png|jpg|gif)$/.test(i.key) && typeof i.name === "string" && typeof i.type === "string" && i.type.startsWith("image/"))
    if (!ok) return `images must be at most ${IMAGES_MAX} uploaded images`
    input.images = images.map(({ key, name, type }) => ({ key, name, type }))
  }
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "scheduled") return "status must be draft or scheduled"
    input.status = body.status
  }
  return input
}
