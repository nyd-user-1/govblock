import { RecordAvatar, RecordSeal } from "@/components/policy/record-item"

// Which emblem an agency wears in the forms list, and what its initials stand
// for.
//
// Both maps are keyed `gov:agency`, not `agency`, because the initials collide:
// `US:DHS` is the Department of Homeland Security and `NYC:DHS` is the
// Department of Homeless Services, and `US:DOL` and `NYS:DOL` are two different
// Departments of Labor.
//
// The seal map is deliberately short. `public/seals/` holds the federal
// departments lane U harvested from Wikimedia Commons for the nominations list,
// and an agency gets one **only where the agency is that organization**. A
// bureau does not wear its parent's seal here: the Internal Revenue Service is
// not the Department of the Treasury, and putting Treasury's seal on an IRS form
// would be telling the reader something we did not check. Those agencies fall
// back to the jurisdiction's own seal, which is true — the form is a federal
// form, or a New York one — and the row names the agency in words beside it.
//
// `FORMS_SEAL_GAPS` below is that fallback list, and it is what the report
// carries. Harvesting the bureau and New York State seals from Commons is a
// commit of its own; until it lands, this says what we have rather than guessing.

const SEALS: Record<string, string> = {
  "US:DOL": "/seals/department-of-labor.png",
  "US:HUD": "/seals/department-of-housing-and-urban-development.png",
  "US:ED": "/seals/department-of-education.png",
  "US:VA": "/seals/department-of-veterans-affairs.png",
  "US:SSA": "/seals/social-security-administration.png",
  "US:OPM": "/seals/office-of-personnel-management.png",
  "US:GSA": "/seals/general-services-administration.png",
  "US:SBA": "/seals/small-business-administration.png",
}

/** The agencies with no emblem of their own on file, and why. */
export const FORMS_SEAL_GAPS = [
  "US:IRS",
  "US:CMS",
  "US:USCIS",
  "US:USDA-FNS",
  "US:Grants.gov",
  "NYS:DTF",
  "NYS:DOH",
  "NYS:DOL",
  "NYS:HCR",
  "NYS:OCFS",
  "NYS:OASAS",
  "NYS:OTDA",
  "NYS:DMV",
  "NYS:HESC",
  "NYS:OMH",
  "NYC:HRA",
  "NYC:HPD",
  "NYC:DHS",
] as const

const NAMES: Record<string, string> = {
  "US:DOL": "Department of Labor",
  "US:HUD": "Department of Housing and Urban Development",
  "US:USDA-FNS": "USDA Food and Nutrition Service",
  "US:CMS": "Centers for Medicare & Medicaid Services",
  "US:GSA": "General Services Administration",
  "US:SBA": "Small Business Administration",
  "US:IRS": "Internal Revenue Service",
  "US:VA": "Department of Veterans Affairs",
  "US:SSA": "Social Security Administration",
  "US:USCIS": "Citizenship and Immigration Services",
  "US:OPM": "Office of Personnel Management",
  "US:ED": "Department of Education",
  "US:Grants.gov": "Grants.gov",
  "NYS:DTF": "Department of Taxation and Finance",
  "NYS:DOH": "Department of Health",
  "NYS:DOL": "Department of Labor",
  "NYS:HCR": "Homes and Community Renewal",
  "NYS:OCFS": "Office of Children and Family Services",
  "NYS:OASAS": "Office of Addiction Services and Supports",
  "NYS:OTDA": "Office of Temporary and Disability Assistance",
  "NYS:DMV": "Department of Motor Vehicles",
  "NYS:HESC": "Higher Education Services Corporation",
  "NYS:OMH": "Office of Mental Health",
  "NYC:HRA": "Human Resources Administration",
  "NYC:HPD": "Housing Preservation and Development",
  "NYC:DHS": "Department of Homeless Services",
}

/** The jurisdiction whose seal stands in: `NYS` and `NYC` are both New York. */
const stateOf = (gov: string) => (gov === "US" ? "US" : "NY")

/** What the initials stand for, or the initials when we have not written it down. */
export function agencyName(gov: string, agency: string) {
  return NAMES[`${gov}:${agency}`] ?? agency
}

export function FormSeal({ gov, agency, size = 36 }: { gov: string; agency: string; size?: number }) {
  const file = SEALS[`${gov}:${agency}`]
  if (file) return <RecordAvatar src={file} alt={agencyName(gov, agency)} size={size} />
  return <RecordSeal state={stateOf(gov)} size={size} />
}
