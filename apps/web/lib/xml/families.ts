// Families of law (window 4, 2026-09-14; program decision 12): the libraries a
// reader browses by subject, as Python has libraries. A first mapping from the
// corpus's own labels, meant to be edited by hand:
//
// - `laws` is tested against a code's name as "Laws".law_name holds it
//   ("Agriculture & Markets", "Food and Agricultural", "815 ILCS 340/ Farm
//   Implement Buyer Protection Act."). A code that matches is in the family,
//   with every section under it.
// - `codes` names codes by address segment where the name says too little
//   (Iowa's codes are "Chapter 1", "Chapter 154A"): { "us-ia": ["c159"] }.
// - `usc` names US Code titles: "t7" is Title 7, Agriculture.
// - `policyAreas` are Congress's policy areas (congress_bill_subjects), which
//   bring federal bills in.
//
// Families overlap (Criminal Procedure is criminal law and courts); inside
// one family a section appears once. A code no rule names is in no family and
// is still browsed under its state's code.

export type Family = {
  slug: string
  name: string
  laws?: RegExp
  /** Tested after `laws`: a match here takes the code back out. */
  except?: RegExp
  codes?: Record<string, string[]>
  usc?: string[]
  policyAreas?: string[]
}

export const FAMILIES: readonly Family[] = [
  {
    slug: "agricultural-law",
    name: "Agricultural Law",
    laws: /agricultur|\bfarm|horticultur|livestock|pesticide|\bseeds?\b|dairy|\bgrain|\bagriculture & markets|food and agricultur/i,
    usc: ["t7"],
    policyAreas: ["Agriculture and Food"],
  },
  {
    slug: "animal-law",
    name: "Animal Law",
    laws: /\banimal|livestock|veterinar|\bdogs?\b|fish and game|game and fish|wildlife/i,
    policyAreas: ["Animals"],
  },
  {
    slug: "housing-law",
    name: "Housing Law",
    laws: /housing|landlord|tenant|\brent\b|\brental|mortgage|homestead|condominium|mobile home|manufactured home|real property|eviction/i,
    policyAreas: ["Housing and Community Development"],
  },
  {
    slug: "health-law",
    name: "Health Law",
    laws: /health|hospital|\bmedic|pharmac|nursing|mental hygiene|\bdrugs?\b|controlled substance/i,
    usc: ["t21", "t24", "t42"],
    policyAreas: ["Health"],
  },
  {
    slug: "education-law",
    name: "Education Law",
    laws: /education|school|universit|college|librar/i,
    usc: ["t20"],
    policyAreas: ["Education"],
  },
  {
    slug: "criminal-law",
    name: "Criminal Law",
    laws: /penal|criminal|\bcrimes?\b|correction|prison|law enforcement|firearm|weapon/i,
    usc: ["t18", "t18a", "t34"],
    policyAreas: ["Crime and Law Enforcement"],
  },
  {
    slug: "courts-and-procedure",
    name: "Courts and Procedure",
    laws: /\bcourts?\b|civil procedure|civil practice|criminal procedure|evidence|judiciar|judicial|\bprocedure\b|arbitration/i,
    usc: ["t9", "t28", "t28a"],
    policyAreas: ["Law"],
  },
  {
    slug: "tax-law",
    name: "Tax Law",
    laws: /\btax|revenue/i,
    usc: ["t26"],
    policyAreas: ["Taxation"],
  },
  {
    slug: "labor-law",
    name: "Labor and Employment Law",
    laws: /\blabou?r\b|employ|workers'? compensation|unemployment|\bwages?\b|civil service|retirement|pension/i,
    usc: ["t29"],
    policyAreas: ["Labor and Employment"],
  },
  {
    slug: "environmental-law",
    name: "Environmental Law",
    laws: /environment|conservation|pollution|\bwaste\b|air quality|water quality|recycl/i,
    usc: ["t16"],
    policyAreas: ["Environmental Protection"],
  },
  {
    slug: "natural-resources-law",
    name: "Natural Resources Law",
    laws: /natural resource|public lands|mineral|mining|oil and gas|forest|\bwaters?\b|\bparks?\b|fish and game|game and fish|wildlife/i,
    usc: ["t16", "t30", "t43"],
    policyAreas: ["Public Lands and Natural Resources", "Water Resources Development"],
  },
  {
    slug: "energy-law",
    name: "Energy Law",
    laws: /\benergy|utilit|\bpower\b|electric|oil and gas|nuclear/i,
    policyAreas: ["Energy"],
  },
  {
    slug: "transportation-law",
    name: "Transportation Law",
    laws: /transport|vehicle|highway|traffic|\bmotor|aviation|railroad|\broads?\b|streets|canal|harbor|navigation|\bports?\b|bridges/i,
    usc: ["t23", "t46", "t49"],
    policyAreas: ["Transportation and Public Works"],
  },
  {
    slug: "election-law",
    name: "Election Law",
    laws: /election|campaign|ballot|voter|initiative, referendum/i,
    usc: ["t52"],
  },
  {
    slug: "business-law",
    name: "Business and Commercial Law",
    laws: /commerc|business|corporat|partnership|\btrade\b|consumer|securities|antitrust|limited liability/i,
    usc: ["t15"],
    policyAreas: ["Commerce", "Foreign Trade and International Finance"],
  },
  {
    slug: "banking-and-finance-law",
    name: "Banking and Finance Law",
    laws: /\bbank|financ|insurance|\bcredit|lending|\bloans?\b/i,
    except: /public financ|state financ/i,
    usc: ["t12"],
    policyAreas: ["Finance and Financial Sector"],
  },
  {
    slug: "family-law",
    name: "Family Law",
    laws: /\bfamil|domestic relations|marriage|\bchild|juvenile|adoption/i,
    policyAreas: ["Families"],
  },
  {
    slug: "estates-and-trusts-law",
    name: "Estates and Trusts Law",
    laws: /\bestates?\b|probate|\btrusts?\b|\bwills?\b|fiduciar|decedent/i,
    except: /real estate/i,
  },
  {
    slug: "civil-rights-law",
    name: "Civil Rights Law",
    laws: /civil rights|human rights|discriminat|equal (opportunity|rights)/i,
    policyAreas: ["Civil Rights and Liberties, Minority Issues"],
  },
  {
    slug: "social-welfare-law",
    name: "Social Welfare Law",
    laws: /welfare|social services|public assistance|\baging\b|\belder|disabilit/i,
    policyAreas: ["Social Welfare"],
  },
  {
    slug: "military-and-veterans-law",
    name: "Military and Veterans Law",
    laws: /military|veteran|national guard|armed forces|militia|emergency management|\bdefense\b/i,
    usc: ["t10", "t32", "t37", "t38", "t50"],
    policyAreas: ["Armed Forces and National Security", "Emergency Management"],
  },
  {
    slug: "immigration-law",
    name: "Immigration Law",
    laws: /immigra|aliens/i,
    usc: ["t8"],
    policyAreas: ["Immigration"],
  },
  {
    slug: "professions-law",
    name: "Professions and Occupations Law",
    laws: /profession|occupation/i,
  },
  {
    slug: "alcohol-tobacco-and-cannabis-law",
    name: "Alcohol, Tobacco and Cannabis Law",
    laws: /alcohol|beverage|liquor|intoxicating|tobacco|cigar|cannabis|marijuana/i,
    usc: ["t27"],
  },
  {
    slug: "local-government-law",
    name: "Local Government Law",
    laws: /\bcount(y|ies)\b|municipal|cities|\btowns?\b|local government|villages?|special district/i,
  },
  {
    slug: "government-operations-law",
    name: "Government Operations Law",
    laws: /state government|executive|public officers|legislat|administrative|public records|public financ|state financ|general assembly|\bcongress\b/i,
    usc: ["t1", "t2", "t3", "t4", "t5", "t31", "t39", "t40", "t41", "t44"],
    policyAreas: ["Government Operations and Politics", "Congress", "Economics and Public Finance"],
  },
]

export const familyBySlug = (slug: string) => FAMILIES.find((f) => f.slug === slug) ?? null

/** Whether a code is in a family: by hand-named segment, by US Code title, or by its name. */
export function inFamily(family: Family, code: { jurisdiction: string; kind: string; code: string; name: string | null }): boolean {
  if (family.codes?.[code.jurisdiction]?.includes(code.code)) return true
  if (code.kind === "usc") return Boolean(family.usc?.includes(code.code))
  if (code.kind !== "code" || !family.laws || !code.name) return false
  return family.laws.test(code.name) && !(family.except?.test(code.name) ?? false)
}
