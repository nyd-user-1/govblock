import PRESS from "@/lib/data/gdelt-press.json"
import { H3 } from "@/components/typeset"
import { GdeltCards, type GdeltCard } from "@/components/gdelt/cards"
import { ShowMore } from "@/components/gdelt/sections"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// A legislator's press (Brendan, 2026-09-16): the stories GDELT's files name
// them in, read nightly by scripts/gdelt/daily.mjs and stored with the site —
// nothing is fetched when the page loads. Cards when every story has a
// picture, the record list when any story has none.

type Story = { day: string; title: string; url: string; source: string; image: string | null; tone: number }

const press = PRESS as unknown as Record<string, Story[]>

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const when = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`

export function MemberPress({ peopleId }: { peopleId: number }) {
  const stories = press[String(peopleId)] ?? []
  if (!stories.length) return null
  const pictured = stories.every((s) => s.image)

  const cards: GdeltCard[] = stories.map((s) => ({
    key: s.url,
    href: s.url,
    title: s.title || s.source,
    meta: `${s.source} · ${when(s.day)}`,
    media: <img src={s.image!} alt="" loading="lazy" referrerPolicy="no-referrer" className="m-0 size-full object-cover" />,
  }))

  return (
    <>
      <H3 id="press">In the press</H3>
      <div className="not-typeset mt-4 flex flex-col gap-4">
        {pictured ? (
          <GdeltCards cards={cards} initial={4} noun="stories" />
        ) : (
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={5} noun="stories" className="flex flex-col divide-y divide-border">
              {stories.map((s) => (
                <RecordItem key={s.url} href={s.url} external title={s.source} meta={[when(s.day)]} description={s.title || s.url} stacked />
              ))}
            </ShowMore>
          </RecordList>
        )}
      </div>
    </>
  )
}
