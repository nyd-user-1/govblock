import { q } from "@/lib/policy/db"
import { sessionYear, stateOfJurisdiction } from "@/lib/typeset/expression-document"

const LEGISCAN_TYPE: Record<string, string> = { hr: "HB", s: "SB", hjres: "HJR", sjres: "SJR", hconres: "HCR", sconres: "SCR", hres: "HR", sres: "SR" }

/** The row in "Bills" a bill Work names, by its session, type and number; null when the bill is not there. What Typeset's address route opens a bill by (2026-09-15). */
export async function billIdOfWork(work: string): Promise<number | null> {
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
  return rows[0] ? Number(rows[0].bill_id) : null
}
