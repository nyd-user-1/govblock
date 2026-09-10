import { share, type Tally } from "@/lib/consensus/data"

// One statement's split, as a bar rather than a ring.
//
// Polis draws this as a donut with a single percentage in the middle, and a
// reader cannot tell which slice the number refers to or compare two arcs
// against a third (Brendan, 2026-09-10, on their Louisville report). Three
// shares of one whole, read left to right, need no decoding: agree, then
// pass, then disagree, always in that order, always to the same width.
//
// The palette is a diverging pair — one hue each side of a neutral middle —
// and it is teal and amber rather than green and red on purpose. Green/red
// reads as approval and fails for the commonest colour blindness; blue/red in
// a conversation about primaries reads as a party. Both steps were checked
// with the dataviz validator against the light and dark surfaces: ΔE 15.6
// under protanopia, 23.0 under normal vision, contrast over 3:1 on both.

const AGREE = "var(--consensus-agree)"
const DISAGREE = "var(--consensus-disagree)"

export function SplitBar({
  votes,
  label,
  compact = false,
}: {
  votes: Tally
  /** Named when the bar is one group's row inside a statement. */
  label?: string
  compact?: boolean
}) {
  const s = share(votes)
  const pct = (v: number) => `${Math.round(v)}%`
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
          {label}
        </span>
      )}
      <div
        className={`flex ${compact ? "h-2" : "h-3"} min-w-0 flex-1 gap-0.5 overflow-hidden`}
        role="img"
        aria-label={`${pct(s.agree)} agree, ${pct(s.pass)} pass, ${pct(s.disagree)} disagree, of ${votes.seen} who saw it`}
      >
        {/* 4px rounded ends on the outer segments, square where they meet the
            middle, so the bar reads as one measure and not three chips. */}
        <span
          className="rounded-l-[4px]"
          style={{ width: `${s.agree}%`, background: AGREE }}
        />
        <span className="bg-muted" style={{ width: `${s.pass}%` }} />
        <span
          className="rounded-r-[4px]"
          style={{ width: `${s.disagree}%`, background: DISAGREE }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">{pct(s.agree)}</span>
        {" agree · "}
        {pct(s.disagree)}
      </span>
    </div>
  )
}

/** Identity is never colour alone, so the legend names the three shares. */
export function SplitLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {[
        ["Agree", AGREE],
        ["Pass", "var(--muted)"],
        ["Disagree", DISAGREE],
      ].map(([name, colour]) => (
        <span key={name} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px] ring-1 ring-border"
            style={{ background: colour }}
            aria-hidden
          />
          {name}
        </span>
      ))}
    </div>
  )
}
