"use client"

import * as React from "react"

import type { LinkedInAccount, Post, PostImage } from "@/lib/linkedin/types"

// /posts' data: the admin's LinkedIn posts and the connection, from
// /api/linkedin, shared by the month, the cards, the table and the dialog.

const REFRESH = 60_000

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`)
  return body as T
}

export type PostChanges = Partial<Pick<Post, "title" | "body" | "target" | "publishAt" | "images">> & { status?: "draft" | "scheduled" }

export function usePosts() {
  const [posts, setPosts] = React.useState<Post[] | null>(null)
  const [account, setAccount] = React.useState<LinkedInAccount | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const refresh = React.useCallback(() => {
    call<Post[]>("/api/linkedin/posts")
      .then(setPosts)
      .catch((error: Error) => setNotice(error.message))
  }, [])

  // The publisher runs on the server, so a scheduled post turns posted (or
  // failed) with nothing done here: look again now and then.
  React.useEffect(() => {
    refresh()
    call<LinkedInAccount>("/api/linkedin/account").then(setAccount).catch(() => {})
    const timer = setInterval(refresh, REFRESH)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  // The callback lands back here with how it went.
  React.useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get("linkedin")
    if (!outcome) return
    if (outcome !== "connected") setNotice(`LinkedIn: ${outcome}`)
    url.searchParams.delete("linkedin")
    window.history.replaceState(null, "", url)
  }, [])

  const put = React.useCallback((post: Post) => setPosts((current) => [...(current ?? []).filter((p) => p.id !== post.id), post]), [])

  /** Saves a new post or changes an existing one; resolves with the server's copy. */
  const save = React.useCallback(
    async (id: string | null, changes: PostChanges): Promise<Post | null> => {
      try {
        const post = id
          ? await call<Post>(`/api/linkedin/posts/${id}`, { method: "PATCH", body: JSON.stringify(changes) })
          : await call<Post>("/api/linkedin/posts", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), ...changes }) })
        // A new post is a draft on the server; scheduling it is a second step.
        const final = !id && changes.status === "scheduled" ? await call<Post>(`/api/linkedin/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ status: "scheduled" }) }) : post
        put(final)
        return final
      } catch (error) {
        setNotice((error as Error).message)
        refresh()
        return null
      }
    },
    [put, refresh]
  )

  const remove = React.useCallback(
    async (id: string) => {
      setPosts((current) => (current ?? []).filter((p) => p.id !== id))
      await call(`/api/linkedin/posts/${id}`, { method: "DELETE" }).catch((error: Error) => setNotice(error.message))
    },
    []
  )

  const postNow = React.useCallback(
    async (id: string) => {
      setPosts((current) => (current ?? []).map((p) => (p.id === id ? { ...p, status: "publishing" } : p)))
      await call("/api/linkedin/publish", { method: "POST", body: JSON.stringify({ id }) }).catch((error: Error) => setNotice(error.message))
      refresh()
    },
    [refresh]
  )

  /** Stores an image for a post; it is attached when the post is saved. */
  const uploadImage = React.useCallback(async (file: File): Promise<PostImage> => {
    const form = new FormData()
    form.append("file", file)
    const response = await fetch("/api/linkedin/images", { method: "POST", body: form })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((body as { error?: string }).error ?? `Upload failed (${response.status})`)
    return body as PostImage
  }, [])

  return { posts, account, notice, setNotice, save, remove, postNow, uploadImage }
}

export type Posts = ReturnType<typeof usePosts>
