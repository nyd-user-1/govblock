import { Avatar, AvatarFallback } from "@govblock/ui/components/avatar"

import { cn } from "@/lib/utils"

// A connection wearing its own colours. Slack's quadricolour hash, Discord's
// blurple — a grayscale mark is a service nobody recognises at a glance, and
// recognising it at a glance is the entire job of a logo.
//
// Full colour ALWAYS, connected or not, and no ring: Brendan's ruling, and it
// is right. The status chip beside the mark already says what state the
// connection is in, in words; dimming the glyph says it a second time in a way
// that reads as "broken image" rather than as "not connected". The ring came
// from the Avatar primitive's own `after:` border, which is drawn for round
// photo avatars and looks like a hairline artefact around a square logo, so it
// is switched off here rather than worked around.
//
// `data-not-typeset` is the fix, and it took five attempts because the first
// four looked for the bug inside the Avatar primitive and it was never there.
// Every call site of this mark sits inside a DocsPage, whose children are
// wrapped in `.typeset`, and typeset styles bare images for article flow:
// `margin-block-start: var(--typeset-flow)` — 12.5px — plus `height: auto` and
// a border radius. A 12.5px top margin on a flex item centred in a 24px box is
// exactly the 6.25px drop that was measured, on all four marks, for two nights.
//
// What the earlier attempts got wrong, written down because the class of error
// is the lesson: clipping hid the logo; pinning both children left it low;
// moving it into AvatarFallback still measured eight pixels down; and taking it
// out of flow with `absolute inset-0` — which shipped claiming victory — moved
// nothing, because an absolutely positioned flex container still honours its
// child's margin. Four fixes to the box, none to the cause. The page also
// carried `not-prose`, Tailwind typography's opt-out, which matches nothing in
// this codebase: it read as an opt-out and was doing nothing at all. Those
// tokens are deleted now — the accepted rendering is the spec, so nothing was
// swapped for a real `not-typeset`; a leak gets one when a screenshot shows it.
//
// Measured after, on the deploy: image centre equals avatar centre, 0px drift.
//
// The absolute fallback stays — it makes the box deterministic and costs
// nothing — but it is not what fixed this.

export function ConnectionMark({
  name,
  logo,
  tint,
  className,
  live = true,
}: {
  name: string
  logo: string
  tint: string
  className?: string
  /**
   * Kept in the signature because callers pass it and it is true information,
   * but it no longer changes the mark — see above.
   */
  live?: boolean
}) {
  return (
    <Avatar
      data-not-typeset=""
      className={cn("relative size-6 shrink-0 rounded-md bg-white after:hidden", className)}
    >
      <AvatarFallback
        className="absolute inset-0 flex items-center justify-center rounded-md bg-white p-0.5 text-[10px] font-semibold"
        style={{ color: tint }}
      >
        <img src={logo} alt={name} className="block max-h-full max-w-full object-contain" />
      </AvatarFallback>
    </Avatar>
  )
}
