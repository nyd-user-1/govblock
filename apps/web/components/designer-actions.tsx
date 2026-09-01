import Link from "next/link"

import { Separator } from "@govblock/ui/components/ny4/separator"
import { Button } from "@govblock/ui/components/nova/button"

// The header's designer actions — shown only while a designer page is mounted
// (the layout's group-has on [data-slot=designer]). Ported from livingston-v3.
export function DesignerActions() {
  return (
    <div className="hidden items-center gap-2 group-has-data-[slot=designer]/layout:flex">
      <Separator orientation="vertical" />
      <Button variant="outline" className="h-[31px] gap-1 rounded-lg" nativeButton={false} render={<a href="https://v0.dev" target="_blank" rel="noreferrer" />}>
        <span>Open in</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 147 70" className="size-5" aria-label="v0">
          <path d="M56 50.203V14h14v46.156C70 65.593 65.593 70 60.156 70c-2.596 0-5.158-1-7-2.843L0 14h19.797L56 50.203ZM147 56h-14V23.953L100.953 56H133v14H96.687C85.814 70 77 61.186 77 50.312V14h14v32.156L123.156 14H91V0h36.312C138.186 0 147 8.814 147 19.688V56Z" />
        </svg>
      </Button>
      <Button className="h-[31px] rounded-lg" nativeButton={false} render={<Link href="/create#get-code" />}>
        Get Code
      </Button>
    </div>
  )
}
