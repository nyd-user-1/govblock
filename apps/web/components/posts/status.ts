import type { PostStatus } from "@/lib/linkedin/types"

// A post's status as the rail, the month, the cards and the table draw it:
// blue while it is a draft (Brendan, 2026-09-17: blue, not orange).
export const STATUS: Record<PostStatus, { label: string; dot: string; chip: string }> = {
  draft: { label: "Draft", dot: "bg-blue-500", chip: "bg-blue-500/12 text-blue-700 dark:text-blue-300" },
  scheduled: { label: "Scheduled", dot: "bg-violet-500", chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  publishing: { label: "Publishing", dot: "bg-violet-500", chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  posted: { label: "Posted", dot: "bg-emerald-500", chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  failed: { label: "Failed", dot: "bg-red-500", chip: "bg-red-500/12 text-red-700 dark:text-red-300" },
}

/** The rail's list: publishing shows under Scheduled. */
export const STATUS_FILTERS: { key: "draft" | "scheduled" | "posted" | "failed"; label: string; dot: string }[] = [
  { key: "draft", label: "Drafts", dot: STATUS.draft.dot },
  { key: "scheduled", label: "Scheduled", dot: STATUS.scheduled.dot },
  { key: "posted", label: "Posted", dot: STATUS.posted.dot },
  { key: "failed", label: "Failed", dot: STATUS.failed.dot },
]
