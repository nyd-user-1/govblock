"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { ModeSwitcher } from "@/components/mode-switcher"
import ParticleMark from "@/components/flag-particles"
import { ParticleScroll } from "@/components/canvasui/ParticleScroll"
import { Survey } from "@/components/consensus/survey"
import { SlideLink, useSlideArrival } from "@/components/unite-slide-link"
import { openPrimaries } from "@/lib/consensus/open-primaries"

// /unite-2 (Brendan, 2026-09-11): the landing page for the GovBlock ecosystem,
// forked from components/unite.tsx so /unite keeps its shape. The hero is the
// same flag in the same padded field. The second screen is the conversation
// itself: We the People's framing with Unite America leading and GovBlocks as
// the technology partner, then the open-primaries survey. Below that, what
// GovBlocks brings, one section per surface, and the premise the whole page
// stands on. The footer line slides right, over red, back to /unite.
//
// The scroller is the one from /unite: <ParticleScroll> fixed over the
// viewport with everything scrolling inside it, so the sand effect covers the
// hero and the copy alike where the HTML-in-Canvas API is on, and the page is
// plain HTML in one scroller where it is not.

// A section with `href` and `still` shows the tool in action: a framed
// capture of the live page (public/unite/*.jpg, 1280×800 at 1.5×, cropped to
// 16:9 from the top so the dev toolbar at the foot never shows), and the title
// is the way into the tool itself. Stills, not embeds, on purpose (Brendan,
// 2026-09-11): the page is snapshotted into a canvas by the particle scroller,
// which a WebGL map or a camera feed would not survive.
function Section({
  id,
  title,
  href,
  still,
  children,
}: {
  id: string
  title: string
  href?: string
  still?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">
        {href ? (
          <Link href={href} className="underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {children}
      {href && still && <Still href={href} title={title} still={still} />}
    </section>
  )
}

function Still({ href, title, still }: { href: string; title: string; still: string }) {
  return (
    <Link
      href={href}
      aria-label={`Open ${title}`}
      className="mt-2 block overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/30"
    >
      <img src={still} alt="" loading="lazy" className="aspect-video w-full object-cover object-top" />
    </Link>
  )
}

function Item({
  title,
  href,
  still,
  children,
}: {
  title: string
  href?: string
  still?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="font-medium">
        {href ? (
          <Link href={href} className="underline-offset-4 hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
      <p className="text-muted-foreground">{children}</p>
      {href && still && <Still href={href} title={title} still={still} />}
    </div>
  )
}

export function Unite2() {
  const router = useRouter()
  useSlideArrival()
  // Warm the other route so the slide back is not left waiting on it.
  useEffect(() => router.prefetch("/unite"), [router])

  return (
    <div data-slot="unite" className="relative flex min-h-svh flex-col">
      <div className="fixed top-0 right-0 z-50 flex h-(--header-height) items-center px-6">
        <ModeSwitcher />
      </div>
      <ParticleScroll className="inset-0 z-30" style={{ position: "fixed" }}>
        <div className="min-h-full bg-background text-foreground">
          <section className="flex h-svh flex-col items-center p-4 sm:p-12 lg:p-24 xl:p-50">
            <div className="relative min-h-56 w-full flex-1">
              <ParticleMark fit={1} className="absolute inset-0" />
            </div>
          </section>

          {/* Screen two: the conversation. */}
          <section className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-24 text-[1.05rem] leading-7 sm:text-base">
            <div className="flex flex-col gap-5">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                A conversation between Americans in every congressional
                district.
              </h1>
              <p className="text-muted-foreground">
                A pilot for a new kind of national conversation, Unite America
                leveraged AI to elevate the voices of Americans from across the
                country and explore what one-person, one-vote means to them
                today.
              </p>
              <p className="text-muted-foreground">
                Over 2,400 Americans, a nationally representative sample
                hailing from all 435 congressional districts, participated in
                the conversation. Unlike traditional means of understanding
                public sentiment, which require choosing between the breadth
                of polls or the depth of focus groups, this pilot explored how
                AI might make both possible at the same time.
              </p>
              <p className="text-muted-foreground">
                During the conversation, AI helped to draw out the nuance and
                richness in participants&apos; views and past life experiences.
                AI then helped bring structure to the resulting data, allowing
                participants to better understand and respond to the thoughts
                of their fellow Americans. Finally, AI generated a set of
                statements likely to have broad support on the basis of the
                entire prior conversation. Participants were then given an
                opportunity to weigh in on those statements.
              </p>
              <p className="text-muted-foreground">
                One clear takeaway is that the process gave people an
                opportunity to be heard in ways they may not have before. The
                percentage of participants who said they &ldquo;feel voting is
                important&rdquo; jumped from 40% to 68% after the experience.
                89% of participants felt that a process like this could help
                more American voices be heard. And ultimately, 94% of
                participants indicated they felt encouraged by the
                conversation.
              </p>
              <p className="text-muted-foreground">
                The first conversation is open primaries. The statements are
                other people&apos;s. Agree, disagree or pass, and the engine
                chooses what you see next.
              </p>
            </div>
            <Survey conversation={openPrimaries} />
          </section>

          {/* What GovBlocks brings. */}
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 py-24 text-[1.05rem] leading-7 sm:text-base">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                The Foundation for Civic Engagement
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                GovBlocks is open infrastructure for the record of American
                government.
              </h2>
              <p className="text-muted-foreground">
                The record is public infrastructure. Every surface below is
                built on the same one, and every one of them is open.
              </p>
            </div>

            <Section id="arxiv" title="National arXiv" href="/bills" still="/unite/arxiv.jpg">
              <p className="text-muted-foreground">
                One view over 52 jurisdictions, nearly 20 years deep, at the
                site root. Bills with every version and a redline between
                printings, committees with dockets and hearing video, members
                with votes and campaign finance, roll calls from both chambers,
                lobbying filings keyed to bills, laws for every jurisdiction
                including the whole US Code, nominations, committee reports,
                the Congressional Record, amendments, hearings, meetings,
                departments, policy areas and legislative subjects, 48,684
                government forms with PDFs, and one search across all of it.
              </p>
            </Section>

            <Section id="inbox" title="Agentic Inbox" href="/workspace/inbox" still="/unite/inbox.jpg">
              <p className="text-muted-foreground">
                Send the work, not the prompt. Hand a task to an agent the way
                you would email a colleague, close the tab and go about your
                day. The report comes back as a reply on the same thread, with
                the PDF attached if you asked for one. No more staring at a
                screen while a bot types.
              </p>
              <p className="text-muted-foreground">
                Seven agents answer the mail, named for the offices of a
                legislature. Clerk reads a bill. Parliamentarian knows who
                represents and where a bill sits. Treasurer follows the money
                and names the gaps. Whip watches a topic and posts digests.
                Librarian writes a sourced report. Reporter writes the
                week&apos;s briefing. Filer fills two New York benefits
                applications into the PDF&apos;s own fields. All of them answer
                from rows they read, never from memory. Clerk also answers
                email on its own thread through a Cloudflare worker.
              </p>
              <p className="text-muted-foreground">
                A watch does the same job on a schedule. Name a bill, a
                committee or a subject, say how you want to hear about it, and
                the memo arrives when something moves, or every Monday if you
                would rather read the week at once.
              </p>
              <p className="text-muted-foreground">
                Whatever comes back lands where the team already works: a
                report in your own Drive as a Google Doc you can edit, a
                hearing on your own calendar with the link back, a digest in
                your Slack channel or Discord server. Each connection is a
                grant to your own account, and nobody else on the site can see
                or use it.
              </p>
            </Section>

            <Section id="workspace" title="Workspace">
              <p className="text-muted-foreground">
                The family of apps built on the record.
              </p>
              <div className="flex flex-col gap-6 pt-2">
                <Item title="GitLaw" href="/workspace/data/ny/senate/2025/bill/2015571" still="/unite/gitlaw.jpg">
                  GitHub for legislation and the law. Every bill in every state
                  and Congress, every session, twenty years back, down to the
                  line. A bill is a file. Its printings are its commits, and the
                  change between two of them reads as a diff. Search a bill, a
                  session or the whole country. Evaluate legislation the way a
                  developer evaluates code: the same clauses recur across bills
                  and across states, and the repository makes the pattern
                  visible.
                </Item>
                <Item title="Union Calendar" href="/calendar" still="/unite/calendar.jpg">
                  Hearings and sessions across all 50 states and Congress, by
                  day, week and month.
                </Item>
                <Item title="Blocks" href="/workspace/blocks" still="/unite/blocks.jpg">
                  Distributed government transparency and legislative
                  intelligence. A block is a live surface over the record, a
                  committee&apos;s docket, a member&apos;s votes, a
                  session&apos;s bills, and the blocks are distributed with the
                  data. Install one into your own site and it reads the record
                  from there.
                </Item>
                <Item title="Dashboards" href="/workspace/dashboard" still="/unite/dashboards.jpg">
                  A committee, a member, a roll call or a session at a glance,
                  each at its own address.
                </Item>
                <Item title="Data Sets" href="/workspace/data" still="/unite/datasets.jpg">
                  The whole record as files, per jurisdiction, and the API the
                  pages themselves read.
                </Item>
                <Item title="Typeset" href="/workspace/typeset" still="/unite/typeset.jpg">
                  A bill set as a document, in two editors: read it, mark it
                  up, and draft from it.
                </Item>
                <Item title="Diff Blocks" href="/bills/2015571/compare" still="/unite/diff.jpg">
                  A bill&apos;s printings as one redline. What was struck, what
                  was added, and the version that did it, side by side or in
                  one scroll.
                </Item>
                <Item title="Forms">
                  Benefits applications filled from a profile you keep, then
                  downloaded, emailed or delivered to the inbox.
                </Item>
                <Item title="Presets">
                  The view you build is a six-character code. Save it, paste
                  it, share it as a link, or take the code.
                </Item>
              </div>
            </Section>

            <Section id="map" title="Map" href="/map" still="/unite/map.jpg">
              <p className="text-muted-foreground">
                Every district in every chamber, coloured by what the Census
                counts there. Drop a point and see who represents it.
              </p>
            </Section>

            <Section id="consensus" title="Consensus" href="/consensus" still="/unite/consensus.jpg">
              <p className="text-muted-foreground">
                Opinion gathered at scale. People vote on each other&apos;s
                statements, agree, disagree or pass, and the groups emerge
                from the votes rather than from who spoke loudest. The report
                shows where agreement can be found, where a split emerges, and
                the statements underneath. The conversation above runs on it.
              </p>
            </Section>

            <Section id="desk" title="Desk" href="/desk" still="/unite/desk.jpg">
              <p className="text-muted-foreground">
                What each legislature did, newest first, on a desk per state,
                with the press on it.
              </p>
            </Section>

            <Section id="briefing" title="Briefing" href="/briefing" still="/unite/briefing.jpg">
              <p className="text-muted-foreground">
                The Reporter reads the week on a desk and writes it up, a
                source on every line.
              </p>
            </Section>

            <Section id="clips" title="Clips" href="/clips" still="/unite/clips.jpg">
              <p className="text-muted-foreground">
                Short vertical video from the record, and your own, recorded in
                the browser.
              </p>
            </Section>

            <Section id="premise" title="Why">
              <p className="text-muted-foreground">
                America feels fractured because it no longer holds to one
                question, one answer. Every screen now carries its own answer to
                everything, and consensus reads as a dead idea.
              </p>
              <p className="text-muted-foreground">
                The evidence says otherwise. We the People&apos;s first
                conversation put 2,400 Americans in one conversation, and 26 statements
                cleared 80 percent agreement. Conversations from Seattle to Taiwan
                cluster the same way. Agreement is the prevailing state of
                affairs. The fringe, and the myriad screens that amplify it,
                make people believe otherwise.
              </p>
              <p>
                Give every American the same complete record of their
                government, built so it can be read, cited and voted on, and
                use that shared ground to find where people already agree.
              </p>
              <p className="text-muted-foreground">
                <Link href="/" className="underline underline-offset-4">
                  Open the record
                </Link>
                .
              </p>
            </Section>
          </div>

          <footer className="container-wrapper px-4 xl:px-6">
            <div className="flex h-(--footer-height) items-center justify-between">
              <div className="w-full px-1 text-center text-xs leading-loose sm:text-sm">
                What&apos;s wrong with{" "}
                <SlideLink
                  href="/unite"
                  direction="back"
                  className="inline"
                  linkClassName="font-medium underline underline-offset-4"
                >
                  America Today?
                </SlideLink>
                .
              </div>
            </div>
          </footer>
        </div>
      </ParticleScroll>
    </div>
  )
}
