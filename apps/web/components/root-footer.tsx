import Link from "next/link"

import { AGENT_PAGES, hasItems, siteConfig } from "@/lib/config"
import { LogoMark } from "@/components/logo-mark"
import { FooterAccount } from "@/components/root-footer-account"

// The site's footer (Brendan, 2026-09-21, on shadcn/studio's): the site map as
// blocks of links three across — the header's own menus, item for item, so a
// page the nav gains the footer gains — beside a card with the account, the
// subscribe field and the places the project lives; then the mark, and the
// terms the code and the data are under. The root page wears it first.
//
// Not components/site-footer.tsx: that is the layout's one-line credit, drawn
// on /unite and /lab/unite-2 alone, and it stays what it was.

type Block = { heading: string; links: { href: string; label: string }[] }

const menu = (label: string): Block => {
  const entry = siteConfig.navItems.find((item) => item.label === label)
  return { heading: label, links: entry && hasItems(entry) ? entry.items.map((i) => ({ href: i.href, label: i.label })) : [] }
}

const BLOCKS: Block[] = [
  menu("ArXiv"),
  menu("News"),
  menu("Workspace"),
  menu("Docs"),
  { heading: "Agents", links: [{ href: "/agents", label: "Index" }, ...AGENT_PAGES.filter((p) => p.href.startsWith("/agents/")).map((p) => ({ href: p.href, label: p.label }))] },
  {
    heading: "Account",
    links: [
      { href: "/home", label: "Home" },
      { href: "/bookmarks", label: "Bookmarks" },
      { href: "/favorites", label: "Favorites" },
      { href: "/pricing", label: "Pricing" },
      { href: "/sign-in", label: "Sign In" },
    ],
  },
]

const FOOT: { href: string; label: string }[] = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/sources", label: "Sources" },
]

export function RootFooter() {
  return (
    // mt-16 (Brendan, 2026-09-22): the jurisdictions' table ended on the footer's rule with nothing between them.
    <footer data-not-typeset="true" className="mt-16 border-t bg-background text-[15px]">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-10">
        <nav aria-label="Site map" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
          {BLOCKS.filter((b) => b.links.length).map((block) => (
            <div key={block.heading} className="min-w-0">
              <p className="mb-4 font-medium text-foreground">{block.heading}</p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {block.links.map((link) => (
                  <li key={link.href} className="m-0 p-0">
                    <Link href={link.href} className="text-muted-foreground no-underline transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <FooterAccount github={siteConfig.links.github} twitter={siteConfig.links.twitter} />
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold text-foreground no-underline">
            <LogoMark className="size-8 shrink-0" aria-hidden />
            GovBlock
          </Link>
          <ul className="m-0 ml-auto flex list-none flex-wrap items-center gap-x-6 gap-y-2 p-0 font-medium">
            {FOOT.map((link) => (
              <li key={link.href} className="m-0 p-0">
                <Link href={link.href} className="text-foreground no-underline hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-7xl px-6 py-6 text-center text-sm text-muted-foreground lg:px-10">
          ©{new Date().getFullYear()} GovBlock. Open code under AGPL-3.0, open data under CC BY 4.0.
        </p>
      </div>
    </footer>
  )
}
