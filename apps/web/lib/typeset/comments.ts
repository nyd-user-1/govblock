// Comments that save (sql/026_comments.sql, 2026-09-15): the shapes and the
// calls both views share. Plate's discussion plugin and the XML reader read a
// document's comments when the view opens and write each change as it
// happens, through /api/typeset/comments. A reader sees only their own.

export type SavedComment = {
  id: number
  threadId: string
  block: string
  quote: string | null
  body: string
  /** Plate's rich value of the comment, where it has one. */
  rich: unknown | null
  resolved: boolean
  createdAt: string
  editedAt: string | null
}

export type NewComment = {
  threadId: string
  document: string
  billId?: number | null
  block: string
  quote?: string | null
  body: string
  rich?: unknown | null
}

export const COMMENTS_URL = "/api/typeset/comments"

/** Thrown when the reader is signed out: the caller opens the sign-in door. */
export class SignInRequired extends Error {}

async function send<T>(method: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const url = query ? `${COMMENTS_URL}?${new URLSearchParams(query)}` : COMMENTS_URL
  const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
  if (response.status === 401) throw new SignInRequired("Sign in to keep comments.")
  if (!response.ok) throw new Error(`comments: ${response.status}`)
  return (await response.json()) as T
}

export const loadComments = (document: string) => send<{ comments: SavedComment[]; signedIn: boolean }>("GET", undefined, { document })
export const addComment = (comment: NewComment) => send<{ comment: SavedComment }>("POST", comment)
export const editComment = (id: number, body: string, rich?: unknown) => send<{ comment: SavedComment }>("PATCH", { id, body, rich: rich ?? null })
export const resolveThread = (threadId: string) => send<{ ok: true }>("PATCH", { threadId, resolved: true })
export const deleteComment = (id: number) => send<{ ok: true }>("DELETE", undefined, { id: String(id) })
export const deleteThread = (threadId: string) => send<{ ok: true }>("DELETE", undefined, { thread: threadId })
