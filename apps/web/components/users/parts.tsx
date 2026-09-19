import { AwardIcon, ZapIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// The pieces /users and /users/[handle] share (Brendan, 2026-09-18): a
// reader's tile, reputation with its bolt, the medals for the top three, and
// the ring a level sits in.

const TONES = ["bg-rose-500", "bg-amber-500", "bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-fuchsia-600", "bg-teal-600", "bg-orange-600", "bg-indigo-600", "bg-lime-600"]

const tone = (handle: string) => TONES[[...handle].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length]

export function UserAvatar({ name, handle, size = 40, className }: { name: string; handle: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-xl font-semibold text-white select-none", tone(handle), className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  )
}

export const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

export function Reputation({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", className)}>
      <span className="flex size-3.5 items-center justify-center rounded-full bg-violet-600 text-white">
        <ZapIcon className="size-2.5 fill-current" />
      </span>
      {compact.format(value)}
    </span>
  )
}

const MEDALS = ["text-amber-400", "text-slate-300", "text-rose-400"]

/** Gold, silver and bronze for the first three; the same width, empty, below them. */
export function Medal({ rank }: { rank: number }) {
  return <span className="flex size-5 shrink-0 items-center justify-center">{rank < 3 && <AwardIcon className={cn("size-5", MEDALS[rank])} />}</span>
}

/** The level in a ring filled as far as the next one. */
export function LevelRing({ level, progress, size = 40 }: { level: number; progress: number; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} className="stroke-emerald-500" />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{level}</span>
    </span>
  )
}
