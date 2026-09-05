import CODES from "@/lib/data/congress/committee-codes.json"
import { committeeKey } from "@/lib/policy/congress"
import type { MemberCommittee } from "@/lib/policy/db-queries"
import { fmtNumber } from "@/lib/format"
import { ChamberSeal } from "@/components/policy/imagery"
import { PreviewFrame } from "@/components/preview-frame"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { H3 } from "@/components/typeset"

// A member's committees on the card /docs/committees uses — seal, name, bill
// count — in that page's two-column grid. Brendan, 2026-09-05: "use the
// ProjectCard with seal and bill count."

const chamberOf = (c: MemberCommittee) => (c.chamber === "senate" ? "Senate" : c.chamber === "joint" ? "Joint" : "House")

/** "House Committee on Agriculture" → "Agriculture"; a subcommittee keeps its own name. */
const shortName = (c: MemberCommittee) => c.name.replace(/^(House|Senate|Joint) Committee on (the )?/, "")

/** This session's bills before the committee, matched by the same key the committees page uses. */
function billsBefore(c: MemberCommittee, counts: Map<string, number>) {
  const byCode = (CODES as { byCode: Record<string, { chamber: string; name: string }> }).byCode[c.system_code]
  const keys = [byCode ? committeeKey(byCode.chamber, byCode.name) : null, committeeKey(chamberOf(c), c.name)].filter(Boolean) as string[]
  for (const key of keys) {
    const n = counts.get(key)
    if (n != null) return n
  }
  return null
}

export function MemberCommittees({
  committees,
  counts,
  who,
  menu,
}: {
  committees: MemberCommittee[]
  /** Bills per committee this session, keyed by `committeeKey(chamber, name)`. */
  counts: { committee_name: string; chamber: string; bills: number }[]
  who: string
  /** The Sessions menu, at the block's top right as on every other block. */
  menu?: React.ReactNode
}) {
  if (!committees.length) return null
  const byKey = new Map(counts.map((c) => [committeeKey(c.chamber, c.committee_name), c.bills]))
  const full = committees.filter((c) => !c.parent_system_code)
  const subs = committees.filter((c) => c.parent_system_code)
  const led = committees.filter((c) => c.title)
  return (
    <>
      <H3>Committees</H3>
      <p>
        {who} sits on <code>{full.length}</code> {full.length === 1 ? "committee" : "committees"}
        {subs.length ? <> and <code>{subs.length}</code> {subs.length === 1 ? "subcommittee" : "subcommittees"}</> : null}
        {led.length ? (
          <>
            , and is {led[0].title?.replace(/^Chairman$|^Chairwoman$/, "Chair")} of <code>{shortName(led[0])}</code>
          </>
        ) : null}
        .
      </p>
      <PreviewFrame>
        {menu && <div className="flex items-center pb-4">{menu}</div>}
        <ProjectGrid>
          {committees.map((c) => {
            const bills = billsBefore(c, byKey)
            const role = c.title?.replace(/^Chairman$|^Chairwoman$/, "Chair") ?? "Member"
            return (
              <ProjectCard
                key={c.system_code}
                href={`/docs/committees/${c.system_code}`}
                title={shortName(c)}
                media={<ChamberSeal state="US" chamber={chamberOf(c)} size={28} />}
                meta={bills != null ? `${fmtNumber(bills)} Bills` : role}
              />
            )
          })}
        </ProjectGrid>
      </PreviewFrame>
    </>
  )
}
