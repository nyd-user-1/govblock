"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { fmtDate } from "@/lib/format"
import type { NewsStory } from "@/lib/policy/news"
import { matchesQuery } from "@/lib/search-match"
import { SearchDirectory } from "@/components/directory-search"
import { FlagChip } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"

// One jurisdiction's desk, on the committees list (Brendan, 2026-09-09: "a
// page with New York news in the model of the /docs/committee page"): the
// search field, then the stories as cards two across under the day they ran
// — the story's own picture where it has one, the flag where it does not,
// the headline, and the outlet beneath. Each opens the story's page here.

const dayOf = (value: string | null) => (value ? value.slice(0, 10) : "")

function Thumb({ story }: { story: NewsStory }) {
  const [broken, setBroken] = React.useState(false)
  if (!story.image_url || broken)
    return <FlagChip state={story.state} width={28} />
  // Plain <img> on purpose: the pictures come from hundreds of newsrooms.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={story.image_url}
      alt=""
      aria-hidden
      className="m-0 size-7 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}

export function StoriesDirectory({
  state,
  stories,
}: {
  state: string
  stories: NewsStory[]
}) {
  const [query, setQuery] = React.useState("")

  const groups = React.useMemo(() => {
    const q = query.trim()
    const rows = q
      ? stories.filter((s) =>
          matchesQuery(q, s.title, s.description ?? "", s.source_name ?? "")
        )
      : stories
    const byDay = new Map<string, NewsStory[]>()
    for (const story of rows) {
      const day = dayOf(story.published_at)
      const bucket = byDay.get(day) ?? []
      bucket.push(story)
      byDay.set(day, bucket)
    }
    return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [stories, query])

  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        placeholder={`Search ${stateName(state)} headlines…`}
      />
      <div className="my-8 flex flex-col gap-10">
        {groups.map(([day, rows]) => (
          <section key={day || "undated"}>
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              {day ? fmtDate(day) : "Undated"}
            </h3>
            <ProjectGrid>
              {rows.map((story) => (
                <ProjectCard
                  key={story.id}
                  href={`/news/${state.toLowerCase()}/${story.id}`}
                  title={story.title}
                  media={<Thumb story={story} />}
                  meta={story.source_name ?? "Source"}
                  feedHref={`/news/${state.toLowerCase()}/feed.xml`}
                />
              ))}
            </ProjectGrid>
          </section>
        ))}
        {!groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {stories.length
              ? `No headlines matching “${query}”.`
              : `Nothing from the press on ${stateName(state)} yet.`}
          </p>
        )}
      </div>
    </>
  )
}
