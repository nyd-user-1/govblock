// What the /posts calendar and the /api/linkedin routes say to each other.

export type PostTarget = "profile" | "company" | "both"
export type PostStatus = "draft" | "scheduled" | "publishing" | "posted" | "failed"

export const POST_TARGETS: { value: PostTarget; label: string }[] = [
  { value: "profile", label: "Profile" },
  { value: "company", label: "Company page" },
  { value: "both", label: "Profile + page" },
]

// LinkedIn's own ceiling on a post's commentary.
export const POST_MAX = 3000

// Images: the kinds LinkedIn takes, a size that uploads well inside a
// request, and a post's worth (LinkedIn allows up to twenty).
export const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" }
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024
export const IMAGES_MAX = 9

export interface PostImage {
  /** The object in the uploads bucket, under linkedin/. */
  key: string
  name: string
  type: string
}

export const imageUrl = (image: PostImage) => `/api/linkedin/images/${image.key.replace(/^linkedin\//, "")}`

export interface Post {
  id: string
  title: string
  body: string
  target: PostTarget
  /** Absolute, ISO 8601 in UTC. */
  publishAt: string
  status: PostStatus
  error: string | null
  images: PostImage[]
  /** The feed URLs of what went out. */
  urls: string[]
}

export interface LinkedInAccount {
  connected: boolean
  /** The app has its client ID and secret. */
  configured: boolean
  name?: string | null
  picture?: string | null
  expiresAt?: string
  /** The member can post to a company page: the organization scopes were granted and they administer one. */
  company?: boolean
}

export const feedUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`
