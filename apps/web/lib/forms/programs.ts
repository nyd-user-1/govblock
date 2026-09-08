import { KEYS, type CanonicalKey } from "@/lib/forms/keys"

// The two forms the Filer fills, as data.
//
// Ported from livingston's src/lib/programs.ts (2026-09-08): the sections
// mirror the printed form in printed order, so a person with the paper in
// front of them is never lost, and `asks` is what a section collects in plain
// words. What is new is `keys`: which canonical keys (lib/forms/keys.ts) each
// section asks, so the questionnaire is data the `form_schema` tool can hand
// the model and the profile can be checked against — a section whose keys are
// all known is skipped, and that is the whole reason the second form is short.
//
// OCFS-6025's sections follow the 06/2024 revision the PDF in public/forms is;
// livingston's six-section list put the benefits question on page 4 where this
// revision prints it on page 1, so the sections here follow the paper.

export type FormId = "ldss-2921" | "ocfs-6025"

/** A group of rows — one per household member, per income, per resource. */
export type Repeat = {
  /** The key prefix: `household` for `household[n].*`. */
  key: string
  /** What one row is: "Person", "Income". */
  label: string
  /** Rows the paper form has room for. */
  max: number
}

export type FormSection = {
  /** Section number as printed ("1", "17"), or a slug for unnumbered parts. */
  n: string
  title: string
  /** Pages of the PDF this section covers. */
  pages: number[]
  /** What this section collects, in the order the form asks. */
  asks: string[]
  /** Consent text rather than questions — read, not filled. */
  consent?: boolean
  /** The canonical keys this section asks, in the form's order. */
  keys: CanonicalKey[]
  /** The rows this section repeats over, if any. */
  repeat?: Repeat
}

export type ProgramForm = {
  id: FormId
  /** Official form number. */
  code: string
  /** The short name a card shows. */
  name: string
  title: string
  blurb: string
  /** The programs this one form applies for. */
  covers: string[]
  agency: string
  revision: string
  pages: number
  /** Honest estimate, said the way a person would say it. */
  minutes: number
  /** The blank form, served from public/. */
  pdf: string
  sections: FormSection[]
}

const HOUSEHOLD: Repeat = { key: "household", label: "Person", max: 7 }

export const LDSS_2921: ProgramForm = {
  id: "ldss-2921",
  code: "LDSS-2921",
  name: "Public Assistance",
  title: "New York State Application for Certain Benefits and Services",
  blurb: "One application for food, cash, medical, heating and child care help.",
  covers: ["Public Assistance", "SNAP", "Medicaid", "Child Care Assistance", "Services incl. Foster Care", "Emergency Assistance"],
  agency: "NYS Office of Temporary and Disability Assistance",
  revision: "07/23",
  pages: 28,
  minutes: 30,
  pdf: "/forms/LDSS-2921.pdf",
  sections: [
    { n: "1", title: "Programs you are applying for", pages: [2], asks: [
      "Which programs you want: Public Assistance, Child Care in lieu of PA, SNAP, Medicaid + SNAP, Medicaid + PA, Services including Foster Care, Child Care Assistance, Emergency Assistance only",
    ], keys: ["programs"] },
    { n: "2–5", title: "Language, and anything urgent", pages: [2], asks: [
      "The language you read and speak, and whether you want an interpreter",
      "Whether any of these apply: pregnant, victim of domestic violence, need to establish parentage, need child support",
    ], keys: ["language.read", "language.readDetail", "language.speak", "language.speakDetail", "interpreter", "urgent", "urgent.otherDetail"] },
    { n: "3", title: "About you", pages: [2], asks: [
      "Name, address, mailing address, phone, email, date of birth, Social Security number",
    ], keys: [
      "applicant.firstName", "applicant.middleInitial", "applicant.lastName", "applicant.dob", "applicant.ssn", "applicant.sex", "applicant.maritalStatus", "applicant.maritalStatusDetail",
      "applicant.phone", "applicant.email",
      "address.street", "address.apt", "address.city", "address.county", "address.state", "address.zip",
      "mailing.same", "mailing.street", "mailing.apt", "mailing.city", "mailing.county", "mailing.state", "mailing.zip",
    ] },
    { n: "6", title: "Everyone in your home", pages: [3], asks: [
      "For each person: name, date of birth, sex, Social Security number, relationship to you",
      "Whether each person buys food or prepares meals with you",
    ], keys: ["household.count", "household[n].firstName", "household[n].lastName", "household[n].dob", "household[n].sex", "household[n].ssn", "household[n].relationship", "household[n].buysFoodTogether"], repeat: HOUSEHOLD },
    { n: "7", title: "Race and ethnicity", pages: [4], asks: [
      "Optional, and it does not affect the decision — race and ethnicity for each person",
    ], keys: ["raceEthnicity.provide", "applicant.race", "household[n].race"], repeat: HOUSEHOLD },
    { n: "8", title: "Citizenship and immigration status", pages: [5], asks: [
      "Citizenship or immigration status for each person applying",
    ], keys: ["applicant.citizenship", "applicant.citizenshipDetail", "household[n].citizenship", "household[n].citizenshipDetail"], repeat: HOUSEHOLD },
    // Section 9 is printed on page 5 but asked LAST — see the end of this list.
    { n: "10", title: "Child support referral", pages: [6], asks: [
      "Whether a parent is absent from the home, and details for a child support referral",
    ], keys: ["childSupport.absentParent", "childSupport.absentParent.firstName", "childSupport.absentParent.lastName", "childSupport.absentParent.dob", "childSupport.absentParent.lastAddress", "childSupport.absentParent.forChild"] },
    { n: "11", title: "Tax filing and dependents", pages: [7], asks: [
      "Whether you file taxes, and who you claim as a dependent",
    ], keys: ["taxes.files", "taxes.dependents"] },
    { n: "12", title: "Absent or deceased spouse", pages: [7], asks: ["Details if a spouse is absent or has died"], keys: ["spouse.absent", "spouse.deceased", "spouse.firstName", "spouse.lastName"] },
    { n: "13", title: "Absent child", pages: [7], asks: ["Details if a child lives elsewhere"], keys: ["child.absent"] },
    { n: "14", title: "Teen parent", pages: [7], asks: ["Details if a parent in the home is a teenager"], keys: ["teenParent"] },
    { n: "15", title: "Income", pages: [8], asks: [
      "Every kind of money coming in, per person: job, self-employment, Social Security, SSI, pensions, child support, unemployment, workers' comp, veterans' benefits, rental income, interest, alimony, student aid, help from friends or relatives, roomers or boarders",
    ], keys: ["income.hasAny", "income[n].source", "income[n].sourceDetail", "income[n].who", "income[n].amount", "income[n].period", "income[n].periodDetail"], repeat: { key: "income", label: "Income", max: 6 } },
    { n: "16", title: "Stepparent / sponsor income", pages: [9], asks: [
      "Income of a stepparent or an immigration sponsor, if that applies",
    ], keys: ["stepparent.income", "sponsor.income"] },
    { n: "17", title: "Employment", pages: [10, 11], asks: [
      "Whether you are employed, and where; if not, when you last worked and why it ended",
      "Whether you are looking for work, in training, or unable to work",
    ], keys: ["employment.status", "employment.statusDetail", "employment.employer", "employment.lastWorked", "employment.lastEmployer", "employment.endReason", "employment.lookingForWork", "employment.inTraining"] },
    { n: "18", title: "Education and training", pages: [12], asks: [
      "Highest grade completed, and any school or training you are in now",
    ], keys: ["education.highestGrade", "education.highestGradeDetail", "education.currentSchool"] },
    { n: "19", title: "Resources", pages: [13], asks: [
      "Savings and checking, cash, stocks and bonds, CDs, trust funds, 401k, life insurance cash value, vehicles, property other than your home, burial funds",
    ], keys: ["resources.hasAny", "resources[n].kind", "resources[n].kindDetail", "resources[n].value"], repeat: { key: "resources", label: "Resource", max: 6 } },
    { n: "20", title: "Medical", pages: [14, 15], asks: [
      "Health insurance you have now, medical bills, and anyone who is pregnant, disabled or needs long-term care",
      "Medical expenses in the last three months, if you want retroactive Medicaid",
    ], keys: ["medical.insurance", "medical.pregnant", "medical.disabled", "medical.bills", "medical.longTermCare", "medical.retroactive"] },
    { n: "21", title: "Where you live and what it costs", pages: [15, 16], asks: [
      "Rent or mortgage, who you pay it to, and whether heat is included",
      "Heating and utility costs, and whether you have had a shut-off notice",
    ], keys: ["shelter.type", "shelter.typeDetail", "shelter.amount", "shelter.payee", "shelter.heatIncluded", "utilities.heatCost", "utilities.shutoffNotice"] },
    { n: "22", title: "Other expenses", pages: [16], asks: [
      "Child care or dependent care you pay for, child support you pay, and other regular bills",
    ], keys: ["expenses.childCare", "expenses.childSupportPaid", "expenses.other"] },
    { n: "23", title: "Other information", pages: [17, 18], asks: [
      "Anything bought or sold recently, strikes, prior benefits or disqualifications, veteran status, and whether you have applied in another county",
    ], keys: ["other.soldRecently", "other.strike", "other.priorBenefits", "other.disqualified", "other.veteran", "other.appliedElsewhere"] },
    { n: "notices", title: "Notices, rights and consents", pages: [19, 20, 21, 22, 23, 24], consent: true, asks: [
      "Nothing to fill in. Seven pages of legal notices — how your Social Security number is used, consent to investigation, the penalties for lying, assignment of support rights, and the Early Intervention release.",
    ], keys: [] },
    { n: "withdraw", title: "Withdrawing an application", pages: [25], consent: true, asks: [
      "Only if you want to withdraw an application for one or more programs",
    ], keys: [] },
    { n: "vote", title: "Voter registration", pages: [27, 28], asks: [
      "Optional — a voter registration form that rides along with the application",
    ], keys: ["voter.register"] },
    // The one exception to printed order. The certification is printed on
    // page 5, but it attests to everything the applicant has said, so it is
    // asked after everything has been said.
    { n: "9", title: "Certification", pages: [5], asks: [
      "Whether you agree to the certification — that what you told us is true and complete, that the district may verify it, and that you assign child-support rights while on assistance",
    ], keys: ["certification.agree"] },
  ],
}

const SCHEDULE = (prefix: string) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => `${prefix}.${d}`)

export const OCFS_6025: ProgramForm = {
  id: "ocfs-6025",
  code: "OCFS-6025",
  name: "Child Care Assistance",
  title: "New York State Application for Child Care Assistance",
  blurb: "Help paying for child care while you work, study or look for work.",
  covers: ["Child Care Assistance Program (CCAP)"],
  agency: "NYS Office of Children and Family Services",
  revision: "06/2024",
  pages: 5,
  minutes: 15,
  pdf: "/forms/OCFS-6025.pdf",
  sections: [
    { n: "1", title: "About you", pages: [1], asks: [
      "Name, other names used, address, mailing address, phone, email, and how you would rather be contacted",
      "The language you speak, and marital status",
    ], keys: [
      "applicant.firstName", "applicant.lastName", "applicant.aliases",
      "address.street", "address.apt", "address.city", "address.state", "address.county", "address.zip",
      "mailing.same", "mailing.street", "mailing.apt", "mailing.city", "mailing.state", "mailing.county", "mailing.zip",
      "applicant.phone", "applicant.phoneType", "applicant.email", "contact.preferred", "contact.preferredDetail",
      "language.speak", "language.speakDetail", "applicant.maritalStatus",
    ] },
    { n: "2", title: "Benefits you receive", pages: [1], asks: [
      "Whether you or an adult applying with you gets Medicaid, SNAP, housing help, HEAP, WIC, Head Start or cash assistance",
    ], keys: ["benefits.receiving"] },
    { n: "3", title: "Your household's circumstances", pages: [1], asks: [
      "Whether anyone applying is homeless, on active duty, in the National Guard or Reserve, or receiving other child care funding",
      "The reason child care is needed",
    ], keys: ["housing.homeless", "military.active", "military.reserve", "otherFunding.has", "otherFunding.agency", "care.reason"] },
    { n: "4", title: "Everyone in your home", pages: [2], asks: [
      "For each person: name, date of birth, sex, relationship to you, Social Security number, citizenship",
      "Which children need care, whether any has special needs, and whether both parents live in the home",
    ], keys: [
      "applicant.dob", "applicant.sex", "applicant.genderIdentity", "applicant.ssn", "applicant.citizenship",
      "household[n].firstName", "household[n].lastName", "household[n].dob", "household[n].sex", "household[n].relationship", "household[n].genderIdentity", "household[n].ssn",
      "household[n].citizenship", "household[n].needsCare", "household[n].specialNeeds", "household[n].bothParents",
    ], repeat: HOUSEHOLD },
    { n: "5", title: "Parents who do not live in the home", pages: [2], asks: [
      "For each child under 19 who needs care and whose parent does not live in the home: whether that parent is available to provide care, and if not, why",
    ], keys: ["absentParent[n].child", "absentParent[n].available", "absentParent[n].reason"], repeat: { key: "absentParent", label: "Child", max: 4 } },
    { n: "6", title: "Your job and other activities", pages: [3], asks: [
      "Whether you need care because you are working, about to start a job, or looking for work — your employer, hours and typical week",
      "Whether you are in or about to start a training program, or college or classes — and those schedules",
    ], keys: [
      "employment.status", "employment.startingNewJob", "employment.newJobStartDate", "employment.lookingForWork", "employment.employer", "employment.hoursPerWeek", "employment.scheduleChanges", ...SCHEDULE("employment.schedule"), "employment.multipleJobs",
      "employment.inTraining", "training.startingSoon", "training.startDate", "training.name", "training.hoursPerWeek", "training.scheduleChanges", ...SCHEDULE("training.schedule"),
      "college.attending", "college.startingSoon", "college.startDate", "education.currentSchool", "college.hoursPerWeek", "college.scheduleChanges", ...SCHEDULE("college.schedule"),
    ] },
    { n: "7", title: "The other adult applying", pages: [3, 4], asks: [
      "Who the other adult applying with you is, if anyone, and their work, training and classes",
    ], keys: [
      "otherAdult.who", "otherAdult.multipleJobs", "otherAdult.working", "otherAdult.startingNewJob", "otherAdult.newJobStartDate", "otherAdult.lookingForWork", "otherAdult.employer", "otherAdult.hoursPerWeek", "otherAdult.scheduleChanges", ...SCHEDULE("otherAdult.schedule"),
      "otherAdult.training.inTraining", "otherAdult.training.startingSoon", "otherAdult.training.startDate", "otherAdult.training.name", "otherAdult.training.hoursPerWeek", "otherAdult.training.scheduleChanges", ...SCHEDULE("otherAdult.training.schedule"),
      "otherAdult.college.attending", "otherAdult.college.startingSoon", "otherAdult.college.startDate", "otherAdult.college.name", "otherAdult.college.hoursPerWeek", "otherAdult.college.scheduleChanges", ...SCHEDULE("otherAdult.college.schedule"),
    ] },
    { n: "8", title: "Household income", pages: [4], asks: [
      "Every kind of money coming in: work, self-employment, child support, alimony, unemployment, Social Security, disability, rental, dividends, pensions, public assistance",
    ], keys: ["income.hasAny", "income[n].source", "income[n].sourceDetail", "income[n].who", "income[n].amount", "income[n].period", "income[n].periodDetail"], repeat: { key: "income", label: "Income", max: 12 } },
    { n: "consents", title: "Consents and notices", pages: [4, 5], consent: true, asks: [
      "Nothing to fill in. Change reporting, penalties, citizenship, consent for investigation, resources, jurisdiction and non-discrimination.",
    ], keys: [] },
    { n: "9", title: "Attestation and signature", pages: [5], asks: [
      "Whether you attest that what you gave is correct and complete — the signature itself is written by hand",
    ], keys: ["attestation.ccap"] },
  ],
}

export const FORMS: ProgramForm[] = [LDSS_2921, OCFS_6025]

export const formById = (id: string): ProgramForm | undefined => FORMS.find((f) => f.id === id)

export const isFormId = (id: unknown): id is FormId => id === "ldss-2921" || id === "ocfs-6025"

/** The sections that ask something, in interview order. */
export const askedSections = (f: ProgramForm) => f.sections.filter((s) => !s.consent)

/** `Section 6 — Everyone in your home`; unnumbered parts are just their title. */
export function sectionLabel(f: ProgramForm | undefined, n: string): string {
  const sec = f?.sections.find((s) => s.n === n)
  const num = /^\d/.test(n) ? `Section ${n}` : ""
  if (!sec) return num || n
  return num ? `${num} — ${sec.title}` : sec.title
}

/** Every key a form asks, rows normalised, in the form's order. */
export function formKeys(f: ProgramForm): CanonicalKey[] {
  const seen = new Set<string>()
  for (const s of f.sections) for (const k of s.keys) seen.add(k)
  return [...seen]
}

/** A key the form's schema does not carry is not an answer the Filer may ask for. */
export function sectionOf(f: ProgramForm, key: CanonicalKey): FormSection | undefined {
  const norm = key.replace(/\[\d+\]/g, "[n]")
  return f.sections.find((s) => s.keys.includes(norm))
}

/** Sanity: every key a section names is in the vocabulary. Thrown at import in dev, so a typo cannot ship. */
if (process.env.NODE_ENV !== "production") {
  const known = new Set(KEYS.map((k) => k.key))
  for (const f of FORMS)
    for (const s of f.sections)
      for (const k of s.keys) if (!known.has(k)) throw new Error(`${f.code} section ${s.n} names an unknown key: ${k}`)
}
