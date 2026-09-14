import { Playfair_Display } from "next/font/google"

import { cn } from "@govblock/ui/lib/utils"

// The motto under the flag (Brendan, 2026-09-13): Playfair Display, chosen
// over Crimson Pro, at weight 550 — between medium and semi-bold — so the
// Latin reads as set on an old-world press. Est. 2026 beneath it, in mono.
const playfair = Playfair_Display({ subsets: ["latin"], weight: "variable", display: "swap" })

export const MOTTO = "E pluribus unum, et ex uno plura."

export function Motto({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 pt-10", className)}>
      <p className={cn(playfair.className, "text-center text-3xl leading-tight tracking-[0.01em] text-foreground [font-weight:550]")}>{MOTTO}</p>
      <span className="font-mono text-[11px] text-muted-foreground/70">Est. 2026</span>
    </div>
  )
}
