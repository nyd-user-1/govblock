import { siteConfig } from "@/lib/config"
import { Icons } from "@/components/icons"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"

// Ported from livingston-v3 components/open-in-v0-button.tsx. v0 uses the
// default style; the registry item is served from public/r/styles.
const V0_STYLE = "new-york-v4"

export function OpenInV0Button({ name, className, ...props }: React.ComponentProps<typeof Button> & { name: string }) {
  return (
    <Button size="sm" asChild className={cn("h-[1.8rem] gap-1", className)} {...props}>
      <a href={`https://v0.dev/chat/api/open?url=${siteConfig.url}/r/styles/${V0_STYLE}/${name}.json`} target="_blank">
        Open in <Icons.v0 className="size-5" />
      </a>
    </Button>
  )
}
