import Link from "next/link"

import { CardFrame, ComponentActions } from "@/components/card-frame"
import { OpenInV0Cta } from "@/components/open-in-v0-cta"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// The right rail of every public page, as Brendan set it in the browser on
// 2026-09-04: the Build with GovBlocks callout, then two blocks as they
// would sit in /create — Member Block and Committee Block — each with the
// ⋮ block menu and the two chambers of Congress. Static on purpose: "the
// blocks do not need to be wired to anything live right now."

const CHAMBERS = [
  { name: "House", n: "449" },
  { name: "Senate", n: "104" },
]

function Block({ id, title, description, href }: { id: string; title: string; description: string; href: (chamber: string) => string }) {
  return (
    <CardFrame id={id} className="shrink-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {CHAMBERS.map((c) => (
            <Item key={c.name} variant="outline" size="sm" render={<Link href={href(c.name)} />}>
              <ItemMedia>
                <ChamberSeal state="US" chamber={c.name} size={28} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{c.name}</ItemTitle>
              </ItemContent>
              <span className="text-sm font-semibold tabular-nums">{c.n}</span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </CardFrame>
  )
}

export function MemberBlock() {
  return <Block id="member-block" title="Member Block" description="Bills organized by Member" href={(c) => `/docs/bills?state=US&chamber=${c}`} />
}

export function CommitteeBlock() {
  return <Block id="committee-block" title="Committee Block" description="Bills organized by committee" href={(c) => `/docs/bills?state=US&chamber=${c}`} />
}

/** The whole rail: the two blocks, then the callout (Brendan, 2026-09-04: "put the callout at the bottom"). */
export function PublicRail() {
  return (
    <>
      <MemberBlock />
      <CommitteeBlock />
      <OpenInV0Cta />
    </>
  )
}
