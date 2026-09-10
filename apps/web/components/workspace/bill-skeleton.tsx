import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

// What stands in while a bill is being read (Brendan, 2026-09-10). Not a
// spinner and not the word "Opening" — the shape of the document that is
// coming, so the page does not move when it lands: the number, the short
// title, the version line, the long official title, then sections of a
// heading and its paragraphs, one of them a quoted amendment.

const LINES = [
  [92, 88, 64],
  [96, 90, 84, 47],
  [88, 72],
] as const

export function BillSkeleton() {
  return (
    <div
      data-slot="bill-skeleton"
      aria-hidden
      className="size-full overflow-hidden px-16 pt-4 pb-72 sm:px-[max(64px,calc(50%-350px))]"
    >
      <Skeleton className="mt-[1.6em] h-10 w-56" />
      <Skeleton className="mt-6 h-4 w-3/5" />
      <Skeleton className="mt-3 h-4 w-72" />

      <div className="mt-6 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[94%]" />
        <Skeleton className="h-4 w-[61%]" />
      </div>

      {LINES.map((widths, section) => (
        <div key={section}>
          <Skeleton className="mt-10 h-6 w-2/3" />
          <div className="mt-4 space-y-2">
            {widths.map((width, line) => (
              <Skeleton key={line} className="h-4" style={{ width: `${width}%` }} />
            ))}
          </div>
          {section === 1 && (
            // An amendment quotes the law it changes, and the quote is indented
            // behind a rule. Two of a bill's blocks in three tend to be one.
            <div className="mt-6 space-y-2 border-l-2 pl-6">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[83%]" />
              <Skeleton className="h-4 w-[55%]" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
