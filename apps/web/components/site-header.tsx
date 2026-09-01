import Link from "next/link"
import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { siteConfig } from "@/lib/config"
import { CommandMenu } from "@/components/command-menu"
import { MainNav } from "@/components/main-nav"
import { ModeSwitcher } from "@/components/mode-switcher"
import { StateSwitcher } from "@/components/state-switcher"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { Button } from "@govblock/ui/components/nova/button"

// Ported from livingston-v3 components/site-header.tsx (desktop; the mobile
// nav and the designer actions are not ported yet).
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="container-wrapper px-6 3xl:fixed:px-0">
        <div className="flex h-(--header-height) items-center **:data-[slot=separator]:h-4! 3xl:fixed:container">
          <MainNav items={siteConfig.navItems} className="hidden lg:flex" />
          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            <StateSwitcher className="hidden md:flex" />
            <div className="hidden w-full flex-1 md:flex md:w-auto md:flex-none">
              <CommandMenu />
            </div>
            <Separator orientation="vertical" className="ml-2 hidden lg:block" />
            <ModeSwitcher />
            <div className="flex items-center gap-2">
              <Separator orientation="vertical" />
              <Button render={<Link href="/create" />} nativeButton={false} size="sm" className="h-[31px] rounded-lg">
                <HugeiconsIcon icon={PlusSignIcon} />
                New
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
