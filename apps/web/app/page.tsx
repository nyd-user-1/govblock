import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"

import { siteConfig } from "@/lib/config"
import { Announcement } from "@/components/announcement"
import { CardsDemo } from "@/components/cards"
import { PageActions, PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/page-header"
import { Button } from "@govblock/ui/components/nova/button"

// Ported from livingston-v3 app/(app)/(root)/page.tsx.
const title = "The Foundation for Civic Engagement"

export default function IndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader className="md:**:[.container]:pb-8 lg:**:[.container]:pb-12">
        <Announcement />
        <PageHeaderHeading className="max-w-4xl">{title}</PageHeaderHeading>
        <PageHeaderDescription>{siteConfig.description}</PageHeaderDescription>
        <PageActions>
          <Button render={<Link href="/create" />} nativeButton={false} className="h-[31px] rounded-lg">
            Build Your Own <IconArrowRight data-icon="inline-end" />
          </Button>
        </PageActions>
      </PageHeader>
      <div className="container-wrapper flex-1 p-0">
        <div className="container overflow-hidden md:px-0 lg:max-w-none">
          <section className="hidden md:block">
            <CardsDemo />
          </section>
        </div>
      </div>
    </div>
  )
}
