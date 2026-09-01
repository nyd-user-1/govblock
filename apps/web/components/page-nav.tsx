import { cn } from "@govblock/ui/lib/utils"

// Ported verbatim from livingston-v3 components/page-nav.tsx.
export function PageNav({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("container-wrapper scroll-mt-24", className)} {...props}>
      <div className="container flex items-center justify-between gap-4 py-4">{children}</div>
    </div>
  )
}
