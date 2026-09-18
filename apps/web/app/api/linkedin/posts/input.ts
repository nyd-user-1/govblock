import { POST_MAX, type PostTarget } from "@/lib/linkedin/types"
import type { PostInput } from "@/lib/linkedin/store"

const TARGETS: PostTarget[] = ["profile", "company", "both"]

/** The fields a request may set, checked; an error string when one is wrong. */
export function readInput(body: Record<string, unknown>): PostInput | string {
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
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "scheduled") return "status must be draft or scheduled"
    input.status = body.status
  }
  return input
}
