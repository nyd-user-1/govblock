import Link from "next/link"

import { fmtLongDate } from "@/lib/format"
import type { NewsBrief } from "@/lib/policy/news"

// One brief, rendered: the lede as a paragraph, the bullets as a list, and
// every [n] in the text turned into a link to the story it rests on. Exa's
// national brief and the Reporter's desk briefs share this, since both are a
// paragraph and cited bullets with the citations numbered from one.

function withCitations(
  text: string,
  citations: { title: string; url: string }[],
  keyPrefix: string
) {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[([\d,\s]+)\]$/)
    if (!m) return <span key={`${keyPrefix}-${i}`}>{part}</span>
    const numbers = m[1]
      .split(",")
      .map((n) => Number(n.trim()))
      .filter(Boolean)
    return (
      <span key={`${keyPrefix}-${i}`} className="whitespace-nowrap">
        {numbers.map((n, j) => {
          const c = citations[n - 1]
          if (!c) return <sup key={n}>{n}</sup>
          const external = /^https?:/.test(c.url)
          const cls =
            "ml-0.5 align-super text-[0.7em] font-medium text-muted-foreground no-underline hover:text-primary hover:underline"
          return external ? (
            <a
              key={n}
              href={c.url}
              target="_blank"
              rel="noreferrer"
              title={c.title}
              className={cls}
            >
              {n}
            </a>
          ) : (
            <Link key={n} href={c.url} title={c.title} className={cls}>
              {n}
            </Link>
          )
          void j
        })}
      </span>
    )
  })
}

export function Brief({
  brief,
  compact = false,
}: {
  brief: NewsBrief
  compact?: boolean
}) {
  const citations =
    brief.grounding.find((g) => g.field === "content")?.citations ??
    brief.grounding[0]?.citations ??
    []
  const lines = brief.content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const bullets = lines
    .filter((l) => /^[•\-*]\s/.test(l))
    .map((l) => l.replace(/^[•\-*]\s+/, ""))
  const prose = lines.filter((l) => !/^[•\-*]\s/.test(l))
  return (
    <div data-slot="brief" className={compact ? "text-sm" : undefined}>
      {prose.map((p, i) => (
        <p key={`p${i}`} className={compact ? "mt-0 mb-3" : undefined}>
          {withCitations(p, citations, `p${i}`)}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className={compact ? "my-0 flex flex-col gap-2 pl-5" : undefined}>
          {bullets.map((b, i) => (
            <li key={`b${i}`}>{withCitations(b, citations, `b${i}`)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The line under a brief's heading: who wrote it and when. */
export function BriefByline({ brief }: { brief: NewsBrief }) {
  const who =
    brief.author === "reporter"
      ? `The Reporter${brief.model ? ` · ${brief.model}` : ""}`
      : "Exa, from the statehouse press"
  return (
    <p className="text-sm text-muted-foreground">
      {who} · {fmtLongDate(brief.completed_at)}
    </p>
  )
}
