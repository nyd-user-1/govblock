import Link from "next/link"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"

// The rail's callout, as Brendan set it in the browser on 2026-09-04: not
// the template's Vercel pitch but the platform's own — "Build with
// GovBlocks" — a Data Block, a Design Block, and Sign In. The export keeps
// its old name because ten pages mount it.

export function OpenInV0Cta({ className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("group relative flex flex-col gap-2 rounded-2xl bg-surface p-6 text-sm text-surface-foreground", className)}>
      <div className="text-base leading-tight font-semibold text-balance">Build with GovBlocks</div>
      <Link href="/create" className="flex flex-col rounded-md p-2 text-left no-underline hover:bg-muted">
        <span className="font-medium">Data Block</span>
        <span className="text-xs text-muted-foreground">Portable data by state, session, committee and member</span>
      </Link>
      <Link href="/create?mode=design" className="flex flex-col rounded-md p-2 text-left no-underline hover:bg-muted">
        <span className="font-medium">Design Block</span>
        <span className="text-xs text-muted-foreground">Portable, reusable design components for building</span>
      </Link>
      <Button variant="outline" size="sm" className="mt-2 w-fit" nativeButton={false} render={<Link href="/auth?next=/create" />}>
        Sign In
      </Button>
    </div>
  )
}

export { OpenInV0Cta as BuildWithGovBlocks }
