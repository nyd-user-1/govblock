import { Button } from "@govblock/ui/components/ny4/button"

// The search trigger from livingston-v3 components/command-menu.tsx. The
// dialog behind it is not ported yet — this is the face only.
export function CommandMenu() {
  return (
    <Button
      variant="outline"
      className="relative h-8 w-full justify-start rounded-lg border-none bg-muted pl-3 text-foreground shadow-none transition-colors hover:bg-muted/50 md:w-48 lg:w-40 xl:w-64 dark:bg-card"
    >
      <span className="hidden xl:inline-flex">Search documentation...</span>
      <span className="inline-flex xl:hidden">Search...</span>
    </Button>
  )
}
