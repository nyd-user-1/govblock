// Bill text version codes, as GovInfo names them (govinfo.gov/help/bills).
// A printing's stage rides on its address (`@2026-06-25_enr`) and in the
// footer; this is what each code means, in GovInfo's own words, for the
// dialog behind a code and the glossary's table (Brendan, 2026-09-15).

export type VersionCodeEntry = { code: string; name: string; description: string }

export const VERSION_CODES: VersionCodeEntry[] = [
  { code: "ih", name: "Introduced (House)", description: "A bill or resolution as formally presented by a member of Congress to a clerk when the House is in session." },
  { code: "is", name: "Introduced (Senate)", description: "A bill or resolution as formally presented by a member of Congress to a clerk when the Senate is in session." },
  { code: "rh", name: "Reported in House", description: "A bill as reported by the committee to which it was referred, including changes made in committee." },
  { code: "rs", name: "Reported in Senate", description: "A bill as reported by the committee to which it was referred, including changes made in committee." },
  { code: "eh", name: "Engrossed (House)", description: "Engrossed as agreed to or passed by the House: the official copy of the bill as passed, certified by the Clerk of the House." },
  { code: "es", name: "Engrossed (Senate)", description: "Engrossed as agreed to or passed by the Senate: the official copy of the bill as passed, certified by the Secretary of the Senate." },
  { code: "eah", name: "Engrossed Amendment (House)", description: "Engrossed amendment as agreed to by the House: the official copy of a bill as passed, including text amended by floor action." },
  { code: "eas", name: "Engrossed Amendment (Senate)", description: "Engrossed amendment as agreed to by the Senate: the official copy of an amendment as passed, including text amended by floor action." },
  { code: "eph", name: "Engrossed and Deemed Passed by House", description: "The official copy of the bill or joint resolution as passed and certified by the Clerk of the House." },
  { code: "enr", name: "Enrolled", description: "Enrolled as agreed to or passed by both House and Senate: the final official copy which both chambers have passed in identical form." },
  { code: "renr", name: "Re-enrolled", description: "A bill that has been re-enrolled." },
  { code: "reah", name: "Re-engrossed Amendment (House)", description: "A re-engrossed amendment in the House." },
  { code: "res", name: "Re-engrossed Amendment (Senate)", description: "A re-engrossed amendment in the Senate." },
  { code: "pcs", name: "Placed on Calendar (Senate)", description: "A bill as placed on one of the two Senate calendars. It is eligible for floor consideration." },
  { code: "pch", name: "Placed on Calendar (House)", description: "A bill as placed on one of the five House calendars. It is eligible for floor consideration." },
  { code: "rfs", name: "Referred in Senate", description: "Referred to a Senate committee after being received from the House." },
  { code: "rfh", name: "Referred in House", description: "Referred to a House committee after being received from the Senate." },
  { code: "rds", name: "Received in Senate", description: "A bill as passed or agreed to in the House which has been received in the Senate." },
  { code: "rdh", name: "Received in House", description: "A bill as passed or agreed to in the Senate which has been received in the House." },
  { code: "ats", name: "Agreed to (Senate)", description: "A simple or concurrent resolution as agreed to in the Senate." },
  { code: "ath", name: "Agreed to (House)", description: "A simple or concurrent resolution as agreed to in the House." },
  { code: "cps", name: "Considered and Passed (Senate)", description: "A bill or joint resolution as considered and passed by the Senate." },
  { code: "cph", name: "Considered and Passed (House)", description: "A bill or joint resolution as considered and passed by the House." },
  { code: "rts", name: "Referred to Committee (Senate)", description: "A bill or resolution as referred or re-referred to a Senate committee or committees." },
  { code: "rth", name: "Referred to Committee (House)", description: "A bill or resolution as referred or re-referred to a House committee or committees." },
  { code: "ras", name: "Referred with Amendments (Senate)", description: "Referred with amendments to the Senate." },
  { code: "rah", name: "Referred with Amendments (House)", description: "Referred with amendments to the House." },
  { code: "rcs", name: "Reference Change (Senate)", description: "A bill as re-referred to a different or additional Senate committee." },
  { code: "rch", name: "Reference Change (House)", description: "A bill as re-referred to a different or additional House committee." },
  { code: "ris", name: "Referral Instructions (Senate)", description: "A bill as referred or re-referred to a Senate committee with instructions." },
  { code: "rih", name: "Referral Instructions (House)", description: "A bill as referred or re-referred to a House committee with instructions." },
  { code: "rhuc", name: "Returned to House by Unanimous Consent", description: "A bill that was returned to the House by unanimous consent within the Senate." },
  { code: "cds", name: "Committee Discharged (Senate)", description: "A bill when the Senate committee has been discharged from its consideration." },
  { code: "cdh", name: "Committee Discharged (House)", description: "A bill when the House committee has been discharged from its consideration." },
  { code: "hds", name: "Held at Desk (Senate)", description: "Ordered held at the Senate desk after being received from the House." },
  { code: "hdh", name: "Held at Desk (House)", description: "Ordered held at the House desk after being received from the Senate." },
  { code: "ips", name: "Indefinitely Postponed (Senate)", description: "A bill when consideration was suspended with no date specified for continuing it." },
  { code: "iph", name: "Indefinitely Postponed (House)", description: "A bill when consideration was suspended with no date specified for continuing it." },
  { code: "lts", name: "Laid on Table (Senate)", description: "Laid on the table in the Senate, which disposes of it immediately, finally and adversely." },
  { code: "lth", name: "Laid on Table (House)", description: "A bill laid on the table, which disposes of it immediately, finally and adversely, by motion." },
  { code: "fps", name: "Failed Passage (Senate)", description: "A bill or resolution that failed to pass the Senate." },
  { code: "fph", name: "Failed Passage (House)", description: "A bill or resolution that failed to pass the House." },
  { code: "fah", name: "Failed Amendment (House)", description: "An amendment that failed in the House." },
  { code: "ops", name: "Ordered to be Printed (Senate)", description: "A version ordered to be printed by the Senate." },
  { code: "oph", name: "Ordered to be Printed (House)", description: "A version ordered to be printed by the House." },
  { code: "pwah", name: "Ordered to be Printed with House Amendment", description: "Shows Senate amendments to a House bill: not the portions struck, only the Senate amendment in italics." },
  { code: "pp", name: "Public Print", description: "Any bill from the House or Senate may be issued as a public print, of which more copies are printed." },
  { code: "pap", name: "Printed as Passed", description: "A public print of a bill as passed. Appropriation bills generally receive a PP designation." },
  { code: "pav", name: "Previous Action Vitiated", description: "A bill when an action previously taken on it was undone or invalidated." },
  { code: "as", name: "Amendment (Senate)", description: "A Senate amendment ordered to be printed." },
  { code: "ash", name: "Additional Sponsors (House)", description: "House sponsors or cosponsors added or withdrawn." },
  { code: "sas", name: "Additional Sponsors (Senate)", description: "Additional sponsors added." },
  { code: "sc", name: "Sponsor Change", description: "A version used to change sponsors." },
]

export const VERSION_BY_CODE = new Map(VERSION_CODES.map((v) => [v.code, v]))

/** "Enrolled" for `enr`; a code GovInfo does not list comes back as typed. */
export const versionName = (code: string | null | undefined) => (code ? (VERSION_BY_CODE.get(code.toLowerCase())?.name ?? code) : "")

export const GLOSSARY_VERSIONS = "/glossary#bill-text-versions"

const normal = (s: string) => s.toLowerCase().replace(/[()]/g, "").replace(/\bin\b/g, "").replace(/\s+/g, " ").trim()
const BY_NAME = new Map(VERSION_CODES.map((v) => [normal(v.name), v.code]))

/** GovInfo's code for a printing named the way GovInfo names it ("Engrossed Amendment House" → eah); null when the name is not one of theirs. */
export const versionCodeOfName = (name: string | null | undefined) => (name ? (BY_NAME.get(normal(name)) ?? null) : null)

/** The pipeline's stage slug for a state printing's name ("Comm Sub" → comm-sub), the twin of scripts/xml/lib/address.mjs. */
export const stageSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "text"

/** A printing's expression id in the store, `date_stage`, from its date and name; federal printings carry GovInfo's code. */
export function printingExpression(work: string | null, date: string | null | undefined, name: string | null | undefined): string | null {
  if (!work || !date) return null
  const federal = work.startsWith("/us/")
  const stage = federal ? versionCodeOfName(name) : name ? stageSlug(name) : null
  return stage ? `${date.slice(0, 10)}_${stage}` : date.slice(0, 10)
}
