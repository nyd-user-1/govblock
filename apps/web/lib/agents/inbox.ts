import { AGENTS, type AgentDefinition } from "@/lib/agents/registry"
import { emptyRun, type RunState } from "@/lib/agents/run-client"

// The Agentic Inbox's store, which is this browser's localStorage and nothing
// else.
//
// That is a deliberate choice, not an oversight: govblock is public and has no
// accounts, so a server-side inbox would be one shared inbox — every visitor
// reading every other visitor's tasks and paying for them. Per-browser is the
// only honest place to keep them until there is an identity to key them to, and
// the surface says so rather than letting anyone assume otherwise. §4 prices
// what close-the-tab delivery would take.
//
// The model is mail, because that is the thing it is pretending to be and half
// measures read as a broken version of the real one. A task is a thread: the
// message you send is in Sent the moment you send it, and the report arrives as
// an unread reply on the same thread. Stars, drafts, and a trash you can undo
// are all local state on that thread.

export type Folder = "inbox" | "sent" | "drafts" | "starred" | "trash"

export type Address = {
  /** An agent's slug, or a person's handle. */
  agent: string
  name: string
  email: string
  monogram: string
  speciality: string
  kind: "agent" | "person"
}

function monogramOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function addressOf(definition: AgentDefinition): Address {
  return {
    agent: definition.slug,
    name: definition.name,
    email: `${definition.slug.replace(/-/g, "")}@govblock`,
    monogram: monogramOf(definition.name),
    speciality: definition.speciality,
    kind: "agent",
  }
}

// The people on the platform. Seeded rather than discovered, because there is
// no identity system yet and pretending otherwise would be worse than saying
// so: writing to a person records them on the thread and in Sent, and the
// message reaches them when notifications exist. That is the whole mechanic
// and it is stated once, on the surface, where someone is about to rely on it.
const PEOPLE: { handle: string; name: string; role: string }[] = [
  { handle: "brendan", name: "Brendan Stanton", role: "Admin — the first account on govblock." },
  { handle: "peter", name: "Peter Parker", role: "Reader — receives what you send him." },
  { handle: "tony", name: "Tony Stark", role: "Reader — receives what you send him." },
]

export const PEOPLE_ADDRESSES: Address[] = PEOPLE.map((person) => ({
  agent: person.handle,
  name: person.name,
  email: `${person.handle}@govblock`,
  monogram: monogramOf(person.name),
  speciality: person.role,
  kind: "person",
}))

export const ADDRESSES: Address[] = [...AGENTS.map(addressOf), ...PEOPLE_ADDRESSES]

export function isPerson(handle: string) {
  return PEOPLE_ADDRESSES.some((address) => address.agent === handle)
}

export function findAddress(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return ADDRESSES.find(
    (a) => a.email.toLowerCase() === q || a.agent === q || a.name.toLowerCase() === q
  )
}

export function matchAddresses(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return ADDRESSES
  return ADDRESSES.filter(
    (a) =>
      a.email.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.speciality.toLowerCase().includes(q)
  )
}

export type Message = {
  id: string
  /** "you" is the reader; an agent replies by its slug. */
  from: "you" | string
  at: number
  body: string
  unread?: boolean
  /** Present on an agent's reply: the run that produced it. */
  run?: RunState
}

export type ThreadStatus = "draft" | "running" | "delivered" | "failed"

export type Thread = {
  id: string
  /** The first recipient. Kept because most of the surface asks "who is this
   *  thread with", and for one recipient — the common case — that is the
   *  answer. `to` is the truth when there are several. */
  agent: string
  agentName: string
  /** Agent slugs. Every one of them runs the task and replies on the thread. */
  to: string[]
  cc: string[]
  /** Blind: the same run, whose recipient line the thread does not show. */
  bcc: string[]
  subject: string
  createdAt: number
  updatedAt: number
  status: ThreadStatus
  starred?: boolean
  trashed?: boolean
  /** Where the report was delivered, if a connection took it. */
  deliveredTo?: string
  messages: Message[]
}

// A new key rather than a migration: the old store held tasks, not threads, and
// it lived for a few hours in one browser.
const KEY = "govblock:inbox:threads"

export function loadThreads(): Thread[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const threads = JSON.parse(raw) as Thread[]
    return Array.isArray(threads) ? threads : []
  } catch {
    return []
  }
}

export function saveThreads(threads: Thread[]) {
  try {
    // Thirty threads is a long history for one browser and keeps the store well
    // inside localStorage's few megabytes — a Researcher report with its run
    // attached is tens of kilobytes.
    window.localStorage.setItem(KEY, JSON.stringify(threads.slice(0, 30)))
  } catch {}
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newThread({
  to,
  cc = [],
  bcc = [],
  subject,
  body,
  status,
}: {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  status: ThreadStatus
}): Thread {
  const at = Date.now()
  const first = to[0] ?? ""
  return {
    id: id(),
    agent: first,
    agentName: nameOf(first),
    to,
    cc,
    bcc,
    subject: subject.trim() || "(no subject)",
    createdAt: at,
    updatedAt: at,
    status,
    messages: [{ id: id(), from: "you", at, body }],
  }
}

export function nameOf(slug: string) {
  return ADDRESSES.find((a) => a.agent === slug)?.name ?? slug
}

/** Only the agents on the lines actually run. People are recorded, not run. */
export function runners(thread: Thread) {
  return allRecipients(thread).filter((slug) => !isPerson(slug))
}

/** Everyone who ran it. Bcc is deliberately absent — that is what bcc means. */
export function shownRecipients(thread: Thread) {
  const lines = [...(thread.to ?? []), ...(thread.cc ?? [])]
  // Threads written before recipients were plural carry only `agent`.
  return (lines.length ? lines : [thread.agent]).filter(Boolean).map(nameOf)
}

/** Everyone who ran it, including the blind ones. */
export function allRecipients(thread: Thread) {
  const lines = [...(thread.to ?? []), ...(thread.cc ?? []), ...(thread.bcc ?? [])]
  return (lines.length ? lines : [thread.agent]).filter(Boolean)
}

/** One thread's whole bill: every recipient's run added up. */
export function threadCost(thread: Thread) {
  return thread.messages.reduce((total, message) => total + (message.run?.usd ?? 0), 0)
}

export function reply(
  thread: Thread,
  from: string,
  run: RunState,
  status: ThreadStatus
): Thread {
  const at = Date.now()
  const existing = thread.messages.find((message) => message.from === from)
  const next: Message = existing
    ? { ...existing, at, body: run.text, run, unread: existing.unread ?? true }
    : { id: id(), from, at, body: run.text, run, unread: true }

  const messages = existing
    ? thread.messages.map((message) => (message.from === from ? next : message))
    : [...thread.messages, next]

  return {
    ...thread,
    status,
    updatedAt: at,
    deliveredTo: deliveredTo(run) ?? thread.deliveredTo,
    messages,
  }
}

/**
 * What a thread's status is once several recipients have run.
 *
 * Running while any of them still is; failed only when every one of them
 * failed, because one agent tripping is not the thread failing.
 */
export function settle(thread: Thread): ThreadStatus {
  const replies = thread.messages.filter((message) => message.from !== "you")
  if (!replies.length) return thread.status
  if (replies.length < runners(thread).length) return "running"
  return replies.every((message) => message.run?.failed) ? "failed" : "delivered"
}

export function inFolder(thread: Thread, folder: Folder) {
  if (folder === "trash") return Boolean(thread.trashed)
  if (thread.trashed) return false
  switch (folder) {
    case "drafts":
      return thread.status === "draft"
    case "starred":
      return Boolean(thread.starred) && thread.status !== "draft"
    case "sent":
      return thread.status !== "draft"
    case "inbox":
      // A thread reaches the inbox when the agent has replied to it — the same
      // rule mail follows, and the reason a running task sits in Sent until it
      // has something to say.
      return thread.messages.some((message) => message.from !== "you")
  }
}

export function unreadIn(threads: Thread[], folder: Folder) {
  return threads.filter(
    (thread) =>
      inFolder(thread, folder) &&
      thread.messages.some((message) => message.from !== "you" && message.unread)
  ).length
}

export function isUnread(thread: Thread) {
  return thread.messages.some((message) => message.from !== "you" && message.unread)
}

export function matches(thread: Thread, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [thread.subject, thread.agentName, ...thread.messages.map((m) => m.body)]
    .join(" ")
    .toLowerCase()
  return hay.includes(q)
}

/** A preview reads as prose, not as the markdown it happens to be written in. */
function flatten(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** The line under a thread's subject in the list. */
export function teaser(thread: Thread) {
  if (thread.status === "running") return running(thread)
  const last = thread.messages.at(-1)
  if (!last) return ""
  if (thread.status === "failed") return flatten(last.body).slice(0, 160) || "Failed."
  return flatten(last.body).slice(0, 160)
}

/** What a running thread is doing right now, for the pulse. */
export function running(thread: Thread) {
  const live = thread.messages.filter((message) => message.from !== "you" && !message.run?.done)
  const run = (live.at(-1) ?? thread.messages.at(-1))?.run ?? emptyRun()
  const step = [...run.steps].reverse().find((s) => s.kind === "tool")
  if (step && step.kind === "tool") {
    if (step.summary === undefined) return `Reading — ${step.name}…`
    return `${step.name} → ${step.summary}`
  }
  return run.rounds ? `Round ${run.rounds}, thinking…` : "Starting…"
}

export function when(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/** Whether the run's own steps show it delivered, and where. */
export function deliveredTo(run: RunState) {
  const post = run.steps.find(
    (step) =>
      step.kind === "tool" &&
      (step.name.startsWith("post_to") || step.name === "deliver_report") &&
      step.ok
  )
  if (post && post.kind === "tool" && post.summary)
    return post.summary.replace(/^(posted|delivered) to /, "")
  return undefined
}
