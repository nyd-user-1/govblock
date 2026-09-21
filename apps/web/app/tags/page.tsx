import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { LETTERS, letterId, letterOf, TagsExplorer, type TagRow } from "@/components/tags/tags-explorer"
import { TAGS } from "@/lib/data/tags"
import { NEWS_TAGS, popularTags, recentTags, recommendedTags, trendingTags, type NewsTag } from "@/lib/gdelt/tags"

// The tags index (Brendan, 2026-09-09; on GDELT since 2026-09-18). It began on
// the record's own filing — the policy areas and legislative subjects, which
// keep their own pages — and now stands on what the news is about: every theme
// GDELT's knowledge graph gave the legislative coverage of the window, laid out
// as daily.dev lays out its tags. scripts/gdelt/tags.mjs writes the file.
// GovBlock's own subject tags stand in the A-to-Z beside them, one entry where
// the words agree.


const title = "Tags"
const description = "Browse the tags millions of policy makers follow. Search, jump to any letter, and follow the ones that matter to you."

export const metadata = { title, description }

const row = (t: NewsTag): TagRow => ({ slug: t.slug, name: t.name, total: t.total })

export default function TagsPage() {
  const tags = [...new Map([...TAGS.map((t) => [t.slug, { slug: t.slug, name: t.name, total: 0 }] as const), ...NEWS_TAGS.map((t) => [t.slug, row(t)] as const)]).values()].sort((a, b) => a.slug.localeCompare(b.slug))
  // The rail is the page's index (Brendan, 2026-09-20): the letters that have
  // a section, in the order the sections stand in.
  const present = new Set(tags.map((t) => letterOf(t.name)))
  const toc = LETTERS.filter((l) => present.has(l)).map((l) => ({ title: l, url: `#${letterId(l)}`, depth: 2 }))
  return (
    <DocsPage title={title} description={description} slug="/tags" previous={{ name: "News", url: "/news" }} next={{ name: "Sources", url: "/sources" }} rail={<DocsTableOfContents toc={toc} />}>
      <TagsExplorer tags={tags} trending={trendingTags(20).map(row)} popular={popularTags(20).map(row)} recent={recentTags(20).map(row)} recommended={recommendedTags(5).map(row)} />
    </DocsPage>
  )
}
