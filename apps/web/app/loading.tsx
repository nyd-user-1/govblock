import { FlagLoader } from "@/components/flag-loader"

// Between one page and the next (Brendan, 2026-09-21): the flags, the site's
// one loader, for any page that has to wait on its server work — a waiting
// page and a waiting list look the same. It holds back 300ms before it shows,
// so a page that arrives quickly never flashes it; a prerendered page never
// waits at all.
export default function Loading() {
  return (
    <div className="flex min-h-[60svh] flex-1 animate-in items-center justify-center duration-200 fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
      <FlagLoader />
    </div>
  )
}
