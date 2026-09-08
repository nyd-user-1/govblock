import { Announcement } from "@/components/announcement"
import { CardsDemo } from "@/components/cards"
import { HomeSearch } from "@/components/home/home-search"
import { PageActions, PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/page-header"

// Ported from livingston-v3 app/(app)/(root)/page.tsx.
const title = "The Foundation for Civic Engagement"

export default function IndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader className="md:**:[.container]:pb-8 lg:**:[.container]:pb-12">
        <Announcement />
        <PageHeaderHeading className="max-w-4xl">{title}</PageHeaderHeading>
        <PageHeaderDescription>
          One view over all 50 states and Congress.
          <br />
          Open Source. Open Code. Open Data.
        </PageHeaderDescription>
        <PageActions>
          <div className="mx-auto w-full max-w-xl">
            <HomeSearch />
          </div>
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
