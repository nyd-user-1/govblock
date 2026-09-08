import { siteConfig } from "@/lib/config"
import { AccountAffordance } from "@/components/account-affordance"
import { CommandMenu } from "@/components/command-menu"
import { MainNav } from "@/components/main-nav"
import { ModeSwitcher } from "@/components/mode-switcher"
import { StateSwitcher } from "@/components/state-switcher"
import { Separator } from "@govblock/ui/components/ny4/separator"

// Ported from livingston-v3 components/site-header.tsx (desktop; the mobile
// nav and the designer actions are not ported yet).
export function SiteHeader() {
  return (
    <header data-slot="site-header" className="sticky top-0 z-50 w-full bg-background group-has-[[data-slot=view]]/layout:hidden">
      <div className="container-wrapper px-6 3xl:fixed:px-0">
        <div className="flex h-(--header-height) items-center **:data-[slot=separator]:h-4! 3xl:fixed:container">
          <nav className="hidden items-center gap-0 lg:flex">
            <MainNav items={siteConfig.navItems} className="flex" />
          </nav>
          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            {/* The jurisdiction switcher sits where the search box used to
                (Brendan, 2026-09-08). The hero carries the search now, and a
                second box beside it was the same question asked twice; the
                flag is the one control the header still owes a reader. */}
            <StateSwitcher compact className="hidden md:flex" />
            {/* No box, but ⌘K is the site's shortcut and still opens here. */}
            <CommandMenu trigger={false} />
            <Separator orientation="vertical" className="ml-2 hidden lg:block" />
            <ModeSwitcher />
            <div className="flex items-center gap-2 group-has-data-[slot=designer]/layout:hidden">
              <Separator orientation="vertical" />
              {/* The right side ends on the account: the primary Sign In,
                  or the avatar once signed in. The New button went with it
                  (Brendan, 2026-09-07). A client component on purpose; see
                  the file. */}
              <AccountAffordance />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
