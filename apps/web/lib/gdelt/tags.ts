import TAGS_FILE from "@/lib/data/gdelt-tags.json"
import { TAG_BY_SLUG } from "@/lib/data/tags"

// Tags out of GDELT's knowledge graph (Brendan, 2026-09-18), as
// scripts/gdelt/tags.mjs counted them over a window of legislative coverage:
// every theme code the stories carried, in words, with its count day by day.
// The stories under each tag are a separate file, read by the tag's own page.

export type NewsTag = { slug: string; name: string; codes: string[]; total: number; days: number[] }
export type TagStory = { day: string; title: string; url: string; source: string; image: string | null; tone: number }

type File = { readAt: string; days: string[]; every: number; articles: number; perDay: number[]; tags: NewsTag[] }

export const tagsFile = TAGS_FILE as unknown as File
export const NEWS_TAGS = tagsFile.tags
export const NEWS_TAG_BY_SLUG = new Map(NEWS_TAGS.map((t) => [t.slug, t]))

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0)

/** Busiest over the whole window. */
export const popularTags = (n: number) => [...NEWS_TAGS].sort((a, b) => b.total - a.total).slice(0, n)

/**
 * Rising: the last three days' daily rate against the seven before, smoothed
 * so a tag that went from one story to four does not outrank one that went
 * from forty to a hundred and sixty.
 */
export function trendingTags(n: number) {
  return NEWS_TAGS.map((t) => {
    const recent = sum(t.days.slice(-3))
    const before = sum(t.days.slice(0, -3)) / Math.max(1, t.days.length - 3)
    return { tag: t, recent, score: (recent / 3 + 4) / (before + 4) }
  })
    .filter((row) => row.recent >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((row) => row.tag)
}

/** New to the window: the latest first day on which a tag carried a story, busiest first among ties. */
export function recentTags(n: number) {
  return NEWS_TAGS.map((t) => ({ tag: t, first: t.days.findIndex((v) => v > 0) }))
    .filter((row) => row.first > 0)
    .sort((a, b) => b.first - a.first || b.tag.total - a.tag.total)
    .slice(0, n)
    .map((row) => row.tag)
}

/** GovBlock's own tags that the news also carries, the busiest first. */
export const recommendedTags = (n: number) =>
  NEWS_TAGS.filter((t) => TAG_BY_SLUG.has(t.slug))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)

/** The day a tag first appeared in the window, as an ISO date. */
export const firstSeen = (t: NewsTag) => tagsFile.days[t.days.findIndex((v) => v > 0)] ?? tagsFile.days[0]!

export async function tagStories(slug: string): Promise<TagStory[]> {
  const stories = (await import("@/lib/data/gdelt-tag-stories.json")).default as unknown as Record<string, TagStory[]>
  return stories[slug] ?? []
}
