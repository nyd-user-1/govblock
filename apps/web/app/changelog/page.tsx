import { type Metadata } from "next"
import { format } from "date-fns"
import { BookOpenIcon, ChevronDownIcon } from "lucide-react"

import { CHANGELOG_REPOSITORY, getReleases } from "@/lib/changelog/releases"
import { SkyBg } from "@/components/changelog/sky-bg"
import { Icons } from "@/components/icons"
import { Prose } from "@/app/agents/transcript"
import { Button } from "@govblock/ui/components/nova/button"

const title = "Changelog"
const description = "What shipped in govblock, by the day it shipped."

export const metadata: Metadata = {
  title,
  description,
}

export const revalidate = 3600

// Ported from livingston-v3 app/(app)/changelog/page.tsx — markup and
// classNames unchanged. Two things are repurposed by content rather than
// redesigned: the releases come from this repository's git log instead of
// somebody else's GitHub, and the release notes render through the same
// markdown renderer the agents' transcripts use rather than pulling in a
// second one. The RSS button is gone because govblock has no feed to point it
// at, and a dead button is worse than one fewer.
export default async function ChangelogPage() {
  const releases = await getReleases()

  return (
    <div className="min-h-screen xl:grid xl:grid-cols-2">
      <section className="relative isolate overflow-hidden border-b border-border xl:sticky xl:top-(--header-height) xl:h-[calc(100svh-var(--header-height))] xl:border-b-0">
        <SkyBg />
        <div className="absolute top-1/2 -right-1/2 z-[-1] size-60 -translate-y-1/2 transform rounded-full bg-primary blur-[300px] sm:size-100" />

        <div className="mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center gap-8 px-4 py-16 sm:gap-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="flex w-full flex-col">
            <div className="mb-6 flex items-center gap-3">
              <Icons.logo className="size-6 shrink-0 text-foreground" />
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1 px-2 font-semibold"
              >
                Changelog
                <ChevronDownIcon className="text-muted-foreground" />
              </Button>
            </div>

            <h2 className="text-left text-4xl font-bold tracking-tight text-pretty text-foreground lg:text-5xl">
              Release Notes
            </h2>
            <div className="mt-6 max-w-lg text-left text-base text-balance text-muted-foreground sm:text-lg">
              {description}
            </div>

            <div className="-ms-2.5 mt-8 flex flex-wrap justify-start gap-1">
              <Button
                variant="ghost"
                render={
                  <a
                    href="/docs/bills"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <BookOpenIcon data-icon="inline-start" />
                Documentation
              </Button>
              <Button
                variant="ghost"
                render={
                  <a
                    href={`https://github.com/${CHANGELOG_REPOSITORY}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <Icons.gitHub data-icon="inline-start" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 xl:-ms-30 xl:flex-1 xl:px-0">
        <main className="relative py-16 sm:py-24 lg:py-32">
          {/* The indicator line the version dots ride. */}
          <div className="absolute inset-y-0 start-32 -ms-[8.5px] hidden h-full w-px overflow-hidden bg-border lg:block" />

          <div className="flex flex-col gap-y-8 sm:gap-y-12 lg:gap-y-16">
            {releases.length === 0 && (
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                No releases to show right now.
              </p>
            )}

            {releases.map((release) => {
              const date = format(new Date(release.date), "MMM d, yyyy")

              return (
                <article
                  key={release.tag}
                  className="relative flex items-start"
                >
                  <div className="sticky start-0 top-(--header-height) -mt-16 hidden w-32 min-w-0 items-center justify-end gap-3 pt-16 sm:-mt-24 sm:pt-24 lg:-mt-32 lg:flex lg:pt-32">
                    <time
                      dateTime={release.date}
                      className="truncate font-mono text-xs/9 text-foreground"
                    >
                      {date}
                    </time>
                    <div className="my-1 flex size-4 items-center justify-center rounded-full bg-background ring ring-border">
                      <div className="size-2 rounded-full bg-primary" />
                    </div>
                  </div>

                  <div className="mx-auto flex max-w-xl min-w-0 flex-col">
                    <div className="border-b border-border pb-4">
                      <div className="mb-2 flex items-center gap-3 lg:hidden">
                        <time
                          dateTime={release.date}
                          className="truncate font-mono text-xs/9 text-foreground"
                        >
                          {date}
                        </time>
                      </div>
                      <h2 className="relative text-3xl font-semibold text-pretty text-foreground">
                        {release.title}
                      </h2>
                    </div>

                    {release.markdown && (
                      <div className="py-6 text-sm whitespace-pre-wrap">
                        <Prose text={release.markdown} />
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </main>
      </section>
    </div>
  )
}
