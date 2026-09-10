import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isJurisdiction, stateName } from "@/lib/filters"
import { fmtLongDate } from "@/lib/format"
import { getStory } from "@/lib/policy/news"
import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"

// One story, on the docs page (Brendan, 2026-09-09: "for the articles
// themselves use the model of the ui.shadcn.com/docs page"): the headline as
// the title, the outlet's summary as the line under it, then the byline, the
// picture, and as much of the body as the outlet's API handed over — a
// paragraph or two from most, the whole piece from some. The last line is
// always the way to the outlet, since the story is theirs.

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

const paragraphs = (text: string | null) =>
  (text ?? "")
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const story = await getStory(Number(id))
  return story
    ? { title: story.title, description: story.description ?? undefined }
    : { title: "News" }
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ state: string; id: string }>
}) {
  const { state, id } = await params
  const code = state.toUpperCase()
  if (!isJurisdiction(code)) notFound()
  const story = await getStory(Number(id))
  if (!story || story.state !== code) notFound()

  const source = story.source_name ?? "the source"
  const body = paragraphs(story.content)
  const desk = `/news/${state.toLowerCase()}`
  return (
    <DocsPage
      title={story.title}
      description={story.description ?? ""}
      slug={`${desk}/${story.id}`}
      previous={{ name: stateName(code), url: desk }}
      next={{ name: "News", url: "/news" }}
      rail={<CalendarCard compact />}
    >
      <p className="text-sm text-muted-foreground">
        {source}
        {story.author ? ` · ${story.author}` : ""}
        {story.published_at ? ` · ${fmtLongDate(story.published_at)}` : ""}
      </p>
      {story.image_url && (
        // Plain <img> on purpose: the pictures come from hundreds of newsrooms.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.image_url}
          alt=""
          className="w-full rounded-lg border object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      {body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {!body.length && !story.description && (
        <p className="text-muted-foreground">
          The outlet's API handed over the headline alone.
        </p>
      )}
      <p>
        <a href={story.url} target="_blank" rel="noreferrer">
          Read the full story at {source}
        </a>
      </p>
    </DocsPage>
  )
}
