import { q } from "@/lib/policy/db"
import { sessionYear, stateOfJurisdiction } from "@/lib/typeset/expression-document"
import { typesetHref } from "@/lib/typeset/views"

const LEGISCAN_TYPE: Record<string, string> = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }

/** A bill Work's own page in Typeset, the XML view, from its row in "Bills"; null when the bill is not there. */
export async function billHrefOfWork(work: string): Promise<string | null> {
  const [, jurisdiction, , session, type, number] = work.split("/")
  const year = sessionYear(jurisdiction, session ?? null)
  if (!year || !type || !number) return null
  const state = stateOfJurisdiction(jurisdiction)
  const letters = state === "US" ? (LEGISCAN_TYPE[type] ?? type.toUpperCase()) : type.toUpperCase()
  const special = /s/.test(session ?? "")
  const rows = await q<{ bill_id: number }>(
    `select bill_id from "Bills" where state = $1 and session_id = $2 and bill_number ~* $3
      order by (coalesce(session_title, '') ~* 'special|extraordinary') = $4 desc limit 1`,
    [state, year, `^${letters}\\s*0*${number.replace(/[^A-Za-z0-9-]/g, "")}$`, special]
  ).catch(() => [])
  return rows[0] ? typesetHref(rows[0].bill_id, "xml") : null
}
