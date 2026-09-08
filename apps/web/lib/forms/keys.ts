// The vocabulary an applicant answers in.
//
// One profile, in canonical keys, outlives both forms and the session. A key
// here is the applicant's fact — "date of birth", "monthly rent" — never a PDF
// field: LDSS-2921 and OCFS-6025 are each an adapter from these keys onto their
// own fields (lib/forms/specs), so a form can be re-cut or a second one added
// without asking anyone anything twice.
//
// The first hundred-odd entries are livingston's FORM_KEYS (src/lib/programs.ts,
// 2026-09-08), ported as data with the wording unchanged; `form.fill` is not
// here because it was an action, not an answer, and the Filer sequences with
// tools instead. After them come the concepts OCFS-6025 asks that the common
// application does not — the child-care reason, work and class schedules, the
// other adult applying, benefits already received — so a person who finished
// LDSS-2921 is asked only those when they start the child-care form.
//
// `[n]` in a key is a 1-based row: `household[2].dob` is the second person
// listed after the applicant. `normaliseKey` folds a numbered key back to its
// entry here.

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "tel"
  | "email"
  | "ssn"
  | "select"
  | "radio"
  | "checkbox"
  | "yesno"
  | "attest"

export type CanonicalKey = string

export type KeyDef = {
  key: CanonicalKey
  /** What a person sees on the control. */
  label: string
  /** What the key holds, in the form's own words — the model reads this. */
  what: string
  kind: FieldKind
  /** `value|Label`, the form's fixed values in printed order. */
  options?: string[]
  /** Several values may be chosen; stored comma-separated. */
  multi?: boolean
  /** Always asked, never prefilled from the profile: attestations. */
  always?: boolean
  /** A page of the form the control links to, for attestations. */
  href?: string
  /** Boxed on its own: amber for an attestation, blue for information. */
  tone?: "caution" | "info"
  /** Only OCFS-6025 asks it; absent means LDSS-2921 does (and OCFS may). */
  ocfs?: true
}

export const YN = ["yes|Yes", "no|No"]
const SEX = ["M|Male", "F|Female", "X|X"]
const CITIZENSHIP = ["citizen|U.S. citizen", "qualified non-citizen|Qualified non-citizen", "other|Other"]
const LANGUAGE = ["english|English", "spanish|Spanish", "other|Another language"]

/** Section 15 (p.8), the 27 printed kinds, plus work from Section 17. */
export const INCOME_SOURCES = [
  "job|Wages from a job", "selfEmployment|Self-employment",
  "unemployment|Unemployment insurance", "ssi|SSI", "ssd|Social Security Disability (SSD)",
  "socialSecurityDependent|Social Security dependent benefits", "socialSecuritySurvivor|Social Security survivor's benefits",
  "socialSecurityRetirement|Social Security retirement", "railroadRetirement|Railroad retirement",
  "pension|Pension or retirement benefits", "dividendsInterest|Dividends or interest",
  "workersComp|Workers' compensation", "nysDisability|NYS disability benefits",
  "veterans|Veteran's pension or benefits", "publicAssistance|Public Assistance grant",
  "giAllotment|GI dependency allotment", "educationGrant|Education grants or loans",
  "contributions|Contributions or gifts", "fosterCare|Foster care maintenance payments",
  "childSupport|Child support received", "spousalSupport|Spousal support received",
  "privateDisability|Private disability or accident insurance", "noFault|No-fault insurance benefits",
  "unionBenefits|Union or strike benefits", "loans|Loans other than education",
  "trust|Income from a trust", "trainingStipend|Training allotment or stipend",
  "rental|Rental income", "boarders|Boarders or lodgers", "other|Something else",
]

/** Section 19 (p.13), the 21 printed kinds. */
const RESOURCE_KINDS = [
  "cash|Cash", "checking|Checking account", "savings|Savings account or CD", "creditUnion|Credit union account",
  "lifeInsurance|Life insurance", "vehicle|Car or other vehicle", "stocksBonds|Stocks, bonds or mutual funds",
  "savingsBonds|Savings bonds", "retirementAccount|IRA, 401(k) or deferred compensation",
  "burialTrust|Irrevocable burial trust", "burialFund|Burial fund", "burialSpace|Burial space",
  "ownHome|Their own home", "realEstate|Other real estate", "taxRefund|An income tax refund coming",
  "annuity|Annuity", "trustBeneficiary|Beneficiary of a trust", "expectedMoney|Money expected — settlement, inheritance",
  "inTrustAccount|An \"in trust\" account", "safeDepositBox|Safe deposit box", "other|Something else",
]

/** Section 21 (p.15): the shelter cost lines, plus the page-2 shelter question. */
const SHELTER_TYPES = [
  "rent|Rent", "mortgage|Mortgage", "roomAndBoard|Room and board", "trailerLot|Trailer lot rent",
  "shelter|A shelter", "none|No housing cost", "other|Something else",
]

/** Section 18 (p.12), as printed. */
const EDUCATION = [
  "lessThanHighSchool|Less than a high school diploma", "iep|Completed an IEP",
  "highSchoolOrGed|High school diploma, GED or TASC", "associates|Associate's degree",
  "bachelorsOrHigher|Bachelor's degree or higher", "other|Something else",
]

const PERIODS = ["weekly|Weekly", "biweekly|Every two weeks", "twiceMonthly|Twice a month", "monthly|Monthly", "yearly|Yearly", "other|Something else"]

const DAYS = ["sun|Sunday", "mon|Monday", "tue|Tuesday", "wed|Wednesday", "thu|Thursday", "fri|Friday", "sat|Saturday"] as const

/** The seven day cells of one of OCFS-6025's weekly schedule rows. */
function schedule(prefix: string, whose: string): KeyDef[] {
  return DAYS.map((day) => {
    const [value, label] = day.split("|")
    return { key: `${prefix}.${value}`, label, what: `${whose} hours on ${label}, or off`, kind: "text", ocfs: true }
  })
}

export const KEYS: KeyDef[] = [
  { key: "programs", label: "Programs", what: "which programs they are applying for", kind: "checkbox", multi: true, options: [
    "PA|Public Assistance (cash)", "ChildCareInLieuOfPA|Child Care in lieu of PA", "SNAP|SNAP (food)", "MedicaidAndSNAP|Medicaid + SNAP",
    "MedicaidAndPA|Medicaid + Public Assistance", "Services|Services including Foster Care", "ChildCare|Child Care Assistance", "Emergency|Emergency Assistance only",
  ] },
  { key: "language.read", label: "Language you read", what: "language they read", kind: "select", options: LANGUAGE },
  { key: "language.readDetail", label: "Language you read", what: "the language, when it is not English or Spanish", kind: "text" },
  { key: "language.speak", label: "Language you speak", what: "language they speak", kind: "select", options: LANGUAGE },
  { key: "language.speakDetail", label: "Language you speak", what: "the language, when it is not English or Spanish", kind: "text" },
  { key: "interpreter", label: "Interpreter", what: "whether they want an interpreter", kind: "yesno", options: YN },
  { key: "urgent", label: "Urgent", what: "anything urgent that applies", kind: "checkbox", multi: true, options: [
    "pregnant|Pregnant", "domesticViolence|Victim of domestic violence", "establishParentage|Need to establish parentage", "needChildSupport|Need child support",
    "drugAlcohol|Drug or alcohol problem", "utilityShutoff|Fuel or utility shut-off", "homeless|No place to stay", "fireOrDisaster|Fire or other disaster",
    "noIncome|No income", "seriousMedical|Serious medical problem", "pendingEviction|Pending eviction", "noFood|No food", "needFosterCare|Need foster care",
    "needChildCare|Need child care", "problemsWithEnglish|Problems with English", "reasonableAccommodations|Reasonable accommodations", "other|Other", "none|None of these",
  ] },
  { key: "urgent.otherDetail", label: "Other urgent need", what: "what the urgent need is, when it is not in the list", kind: "text" },
  { key: "applicant.firstName", label: "First name", what: "first name", kind: "text" },
  { key: "applicant.middleInitial", label: "Middle initial", what: "middle initial", kind: "text" },
  { key: "applicant.lastName", label: "Last name", what: "last name", kind: "text" },
  { key: "applicant.dob", label: "Date of birth", what: "date of birth, YYYY-MM-DD", kind: "date" },
  { key: "applicant.ssn", label: "Social Security number", what: "Social Security number, digits only — only if freely given", kind: "ssn" },
  { key: "applicant.sex", label: "Sex", what: "sex", kind: "radio", options: SEX },
  { key: "applicant.phone", label: "Phone", what: "phone, digits only", kind: "tel" },
  { key: "applicant.email", label: "Email", what: "email", kind: "email" },
  { key: "address.street", label: "Street", what: "street address", kind: "text" },
  { key: "address.apt", label: "Apt", what: "apartment", kind: "text" },
  { key: "address.city", label: "City", what: "city", kind: "text" },
  { key: "address.state", label: "State", what: "two-letter state", kind: "text" },
  { key: "address.zip", label: "ZIP", what: "ZIP", kind: "text" },
  { key: "address.county", label: "County", what: "county", kind: "text" },
  { key: "mailing.same", label: "Mailing address", what: "whether mail goes to the home address", kind: "radio", options: ["yes|Same as home", "no|A different address"] },
  { key: "mailing.street", label: "Mailing street", what: "mailing street, only if different", kind: "text" },
  { key: "mailing.apt", label: "Mailing apt", what: "mailing apartment", kind: "text" },
  { key: "mailing.city", label: "Mailing city", what: "mailing city", kind: "text" },
  { key: "mailing.county", label: "Mailing county", what: "mailing county", kind: "text" },
  { key: "mailing.state", label: "Mailing state", what: "mailing state", kind: "text" },
  { key: "mailing.zip", label: "Mailing ZIP", what: "mailing ZIP", kind: "text" },
  { key: "applicant.maritalStatus", label: "Marital status", what: "marital status", kind: "select", options: ["single|Single", "married|Married", "separated|Separated", "divorced|Divorced", "widowed|Widowed", "other|Something else"] },
  { key: "applicant.maritalStatusDetail", label: "Marital status", what: "their words, when none of the fixed values fit", kind: "text" },
  { key: "household.count", label: "People in home", what: "how many people live there, including them", kind: "number" },
  { key: "household[n].firstName", label: "First name", what: "each other person's first name", kind: "text" },
  { key: "household[n].lastName", label: "Last name", what: "last name", kind: "text" },
  { key: "household[n].dob", label: "Date of birth", what: "date of birth, YYYY-MM-DD", kind: "date" },
  { key: "household[n].sex", label: "Sex", what: "sex", kind: "radio", options: SEX },
  { key: "household[n].ssn", label: "Social Security number", what: "SSN, digits only — only if freely given", kind: "ssn" },
  { key: "household[n].relationship", label: "Relationship", what: "relationship to the applicant", kind: "text" },
  { key: "household[n].buysFoodTogether", label: "Buys food together", what: "whether they buy food or prepare meals with the applicant", kind: "yesno", options: YN },
  { key: "raceEthnicity.provide", label: "Share race and ethnicity", what: "whether they want to answer the optional race and ethnicity question", kind: "yesno", options: YN },
  { key: "applicant.race", label: "Race and ethnicity", what: "the applicant's race and ethnicity, in their words — optional", kind: "text" },
  { key: "household[n].race", label: "Race and ethnicity", what: "that person's race and ethnicity — optional", kind: "text" },
  { key: "applicant.citizenship", label: "Citizenship", what: "the applicant's citizenship or immigration status", kind: "select", options: CITIZENSHIP },
  { key: "applicant.citizenshipDetail", label: "Immigration status", what: "the status in their words, when it is `other`", kind: "text" },
  { key: "household[n].citizenship", label: "Citizenship", what: "citizenship or immigration status", kind: "select", options: CITIZENSHIP },
  { key: "household[n].citizenshipDetail", label: "Immigration status", what: "the status in their words, when it is `other`", kind: "text" },
  { key: "childSupport.absentParent", label: "Parent absent from home", what: "whether a child's parent is absent from the home", kind: "yesno", options: YN },
  { key: "childSupport.absentParent.firstName", label: "First name", what: "the absent parent's first name", kind: "text" },
  { key: "childSupport.absentParent.lastName", label: "Last name", what: "the absent parent's last name", kind: "text" },
  { key: "childSupport.absentParent.dob", label: "Date of birth", what: "the absent parent's date of birth, YYYY-MM-DD, if known", kind: "date" },
  { key: "childSupport.absentParent.lastAddress", label: "Last address", what: "the absent parent's last known address", kind: "text" },
  { key: "childSupport.absentParent.forChild", label: "For which child", what: "which child or children the absent parent is a parent of", kind: "text" },
  { key: "taxes.files", label: "Files taxes", what: "whether they file a tax return", kind: "yesno", options: YN },
  { key: "taxes.dependents", label: "Dependents claimed", what: "who they claim as a dependent", kind: "text" },
  { key: "spouse.absent", label: "Spouse absent", what: "whether a spouse is absent from the home", kind: "yesno", options: YN },
  { key: "spouse.deceased", label: "Spouse deceased", what: "whether a spouse has died", kind: "yesno", options: YN },
  { key: "spouse.firstName", label: "First name", what: "the spouse's first name", kind: "text" },
  { key: "spouse.lastName", label: "Last name", what: "the spouse's last name", kind: "text" },
  { key: "child.absent", label: "Child living elsewhere", what: "whether a child of theirs lives elsewhere", kind: "yesno", options: YN },
  { key: "teenParent", label: "Teen parent", what: "whether a parent in the home is under 18", kind: "yesno", options: YN },
  { key: "income.hasAny", label: "Any income", what: "whether anyone in the home has any money coming in", kind: "yesno", options: YN },
  { key: "income[n].source", label: "Income source", what: "kind of income", kind: "select", options: INCOME_SOURCES },
  { key: "income[n].sourceDetail", label: "Income source", what: "what the income is, in their words, when it is `other`", kind: "text" },
  { key: "income[n].who", label: "Whose income", what: "whose income it is", kind: "text" },
  { key: "income[n].amount", label: "Amount", what: "amount in dollars, digits only", kind: "money" },
  { key: "income[n].period", label: "How often", what: "how often it comes", kind: "select", options: PERIODS },
  { key: "income[n].periodDetail", label: "How often", what: "how often, in their words, when it is `other`", kind: "text" },
  { key: "stepparent.income", label: "Stepparent income", what: "a stepparent's income, if one lives in the home — amount, or none", kind: "money" },
  { key: "sponsor.income", label: "Sponsor income", what: "an immigration sponsor's income, if that applies — amount, or none", kind: "money" },
  { key: "employment.status", label: "Employment status", what: "employment status", kind: "select", options: ["employed|Employed", "self-employed|Self-employed", "unemployed|Unemployed", "unable to work|Unable to work", "other|Something else"] },
  { key: "employment.statusDetail", label: "Employment status", what: "their situation in their words, when it is `other`", kind: "text" },
  { key: "employment.employer", label: "Employer", what: "employer name", kind: "text" },
  { key: "employment.lastWorked", label: "Last worked", what: "when they last worked, YYYY-MM-DD", kind: "date" },
  { key: "employment.lastEmployer", label: "Last employer", what: "the last employer, if not working now", kind: "text" },
  { key: "employment.endReason", label: "Why it ended", what: "why the last job ended", kind: "text" },
  { key: "employment.lookingForWork", label: "Looking for work", what: "whether they are looking for work", kind: "yesno", options: YN },
  { key: "employment.inTraining", label: "In training", what: "whether they are in a training program", kind: "yesno", options: YN },
  { key: "education.highestGrade", label: "Highest grade", what: "highest level of education completed", kind: "select", options: EDUCATION },
  { key: "education.highestGradeDetail", label: "Highest grade", what: "the last grade completed, or their words when it is `other`", kind: "text" },
  { key: "education.currentSchool", label: "School or training now", what: "any school or training they are in now, or none", kind: "text" },
  { key: "resources.hasAny", label: "Any resources", what: "whether anyone in the home has savings, accounts, vehicles or property", kind: "yesno", options: YN },
  { key: "resources[n].kind", label: "Resource", what: "kind of resource", kind: "select", options: RESOURCE_KINDS },
  { key: "resources[n].kindDetail", label: "Resource", what: "what it is, in their words, when it is `other`", kind: "text" },
  { key: "resources[n].value", label: "Value", what: "value in dollars, digits only", kind: "money" },
  { key: "medical.insurance", label: "Health insurance", what: "current health insurance, or none", kind: "text" },
  { key: "medical.pregnant", label: "Pregnant", what: "who is pregnant, or no", kind: "text" },
  { key: "medical.disabled", label: "Disabled", what: "who is disabled, or no", kind: "text" },
  { key: "medical.bills", label: "Unpaid medical bills", what: "whether there are medical bills they cannot pay", kind: "yesno", options: YN },
  { key: "medical.longTermCare", label: "Long-term care", what: "who needs long-term care, or no", kind: "text" },
  { key: "medical.retroactive", label: "Retroactive Medicaid", what: "whether they want Medicaid for bills from the last three months", kind: "yesno", options: YN },
  { key: "shelter.type", label: "Housing", what: "how they are housed and what they pay for", kind: "select", options: SHELTER_TYPES },
  { key: "shelter.typeDetail", label: "Housing", what: "their situation in their words — e.g. staying with a relative — when it is `other` or `none`", kind: "text" },
  { key: "shelter.amount", label: "Rent / mortgage", what: "monthly rent or mortgage in dollars, digits only", kind: "money" },
  { key: "shelter.payee", label: "Paid to", what: "who the rent or mortgage is paid to", kind: "text" },
  { key: "shelter.heatIncluded", label: "Heat included", what: "whether heat is included in the rent", kind: "yesno", options: YN },
  { key: "utilities.heatCost", label: "Heating cost", what: "monthly heating cost in dollars", kind: "money" },
  { key: "utilities.shutoffNotice", label: "Shut-off notice", what: "whether they have had a shut-off notice", kind: "yesno", options: YN },
  { key: "expenses.childCare", label: "Child care paid", what: "monthly child or dependent care paid", kind: "money" },
  { key: "expenses.childSupportPaid", label: "Child support paid", what: "monthly child support they pay out", kind: "money" },
  { key: "expenses.other", label: "Other bills", what: "other regular bills they pay", kind: "text" },
  { key: "other.veteran", label: "Veteran", what: "whether they are a veteran", kind: "yesno", options: YN },
  { key: "other.appliedElsewhere", label: "Applied elsewhere", what: "whether they applied in another county recently", kind: "yesno", options: YN },
  { key: "other.soldRecently", label: "Sold or gave away property", what: "whether anyone sold, traded or gave away property recently", kind: "yesno", options: YN },
  { key: "other.strike", label: "On strike", what: "whether anyone in the home is on strike", kind: "yesno", options: YN },
  { key: "other.priorBenefits", label: "Got benefits before", what: "whether anyone has received benefits before", kind: "yesno", options: YN },
  { key: "other.disqualified", label: "Disqualified before", what: "whether anyone has been disqualified from benefits before", kind: "yesno", options: YN },
  { key: "voter.register", label: "Register to vote", what: "whether they want to register to vote", kind: "radio", tone: "info", href: "/forms/LDSS-2921.pdf#page=27", options: ["yes|Yes, register me", "no|No, do not register me", "already|Already registered"] },
  { key: "certification.agree", label: "Certification", what: "whether they agree to the certification — asked last, as an attestation", kind: "attest", always: true, tone: "caution", href: "/forms/LDSS-2921.pdf#page=5", options: ["yes|I agree", "no|Not yet"] },

  // ---- OCFS-6025 asks these; the common application does not ----------

  { key: "applicant.aliases", label: "Other names used", what: "any other names they have used — optional", kind: "text", ocfs: true },
  { key: "applicant.phoneType", label: "Phone type", what: "what kind of phone that is", kind: "radio", options: ["cell|Cell", "home|Home or landline", "work|Work"], ocfs: true },
  { key: "contact.preferred", label: "Preferred contact", what: "how they would rather be contacted — optional", kind: "radio", options: ["phone|Phone", "email|Email", "other|Another way"], ocfs: true },
  { key: "contact.preferredDetail", label: "Preferred contact", what: "the other way, in their words", kind: "text", ocfs: true },
  { key: "applicant.genderIdentity", label: "Gender identity", what: "gender identity, in their words — optional", kind: "text", ocfs: true },
  { key: "household[n].genderIdentity", label: "Gender identity", what: "that person's gender identity — optional", kind: "text", ocfs: true },
  { key: "household[n].needsCare", label: "Needs child care", what: "whether this child needs child care", kind: "yesno", options: YN, ocfs: true },
  { key: "household[n].specialNeeds", label: "Special needs", what: "whether this child has special needs", kind: "yesno", options: YN, ocfs: true },
  { key: "household[n].bothParents", label: "Both parents at home", what: "whether both of this child's parents live in the home", kind: "yesno", options: YN, ocfs: true },
  { key: "absentParent[n].child", label: "Child", what: "a child under 19 who needs care and whose other parent does not live in the home", kind: "text", ocfs: true },
  { key: "absentParent[n].available", label: "Parent available to provide care", what: "whether that parent is available to provide care", kind: "yesno", options: YN, ocfs: true },
  { key: "absentParent[n].reason", label: "If not, why", what: "why that parent cannot provide care", kind: "text", ocfs: true },
  { key: "benefits.receiving", label: "Benefits received now", what: "benefits the applicant or an adult applying with them receives now", kind: "checkbox", multi: true, ocfs: true, options: [
    "medicaid|Medicaid", "snap|SNAP", "housing|Housing vouchers or assistance", "heap|HEAP", "wic|WIC", "headstart|Head Start or Early Head Start", "tanf|Cash Assistance from TANF", "none|None of these",
  ] },
  { key: "housing.homeless", label: "Homeless", what: "whether they have no fixed, regular and adequate place to stay at night", kind: "yesno", options: YN, ocfs: true },
  { key: "military.active", label: "Active duty", what: "whether a parent is on active duty in the U.S. military", kind: "yesno", options: YN, ocfs: true },
  { key: "military.reserve", label: "National Guard or Reserve", what: "whether a parent is in the National Guard or a Military Reserve Unit", kind: "yesno", options: YN, ocfs: true },
  { key: "otherFunding.has", label: "Other child care funding", what: "whether they receive or applied for other child care funding", kind: "yesno", options: YN, ocfs: true },
  { key: "otherFunding.agency", label: "Agency", what: "the agency that funding comes from", kind: "text", ocfs: true },
  { key: "care.reason", label: "Why child care is needed", what: "the reason child care is needed, in a phrase", kind: "textarea", ocfs: true },
  { key: "employment.startingNewJob", label: "Starting a new job", what: "whether they are about to start a new job", kind: "yesno", options: YN, ocfs: true },
  { key: "employment.newJobStartDate", label: "Start date", what: "when the new job starts, YYYY-MM-DD", kind: "date", ocfs: true },
  { key: "employment.hoursPerWeek", label: "Hours worked per week", what: "total hours worked per week", kind: "number", ocfs: true },
  { key: "employment.scheduleChanges", label: "Schedule changes weekly", what: "whether the work schedule changes week to week", kind: "yesno", options: YN, ocfs: true },
  { key: "employment.multipleJobs", label: "More than one job", what: "whether they have more than one job", kind: "yesno", options: YN, ocfs: true },
  ...schedule("employment.schedule", "work"),
  { key: "training.startingSoon", label: "Starting training", what: "whether they are about to start a training program for work", kind: "yesno", options: YN, ocfs: true },
  { key: "training.startDate", label: "Start date", what: "when the training starts, YYYY-MM-DD", kind: "date", ocfs: true },
  { key: "training.name", label: "Training program", what: "the training program's name or facility", kind: "text", ocfs: true },
  { key: "training.hoursPerWeek", label: "Hours of training per week", what: "total hours of training per week", kind: "number", ocfs: true },
  { key: "training.scheduleChanges", label: "Schedule changes weekly", what: "whether the training schedule changes week to week", kind: "yesno", options: YN, ocfs: true },
  ...schedule("training.schedule", "training"),
  { key: "college.attending", label: "In college or classes", what: "whether they need care because they are going to college or taking classes", kind: "yesno", options: YN, ocfs: true },
  { key: "college.startingSoon", label: "Starting college", what: "whether they are about to start college or classes", kind: "yesno", options: YN, ocfs: true },
  { key: "college.startDate", label: "Start date", what: "when classes start, YYYY-MM-DD", kind: "date", ocfs: true },
  { key: "college.hoursPerWeek", label: "Hours of classes per week", what: "total hours of classes per week", kind: "number", ocfs: true },
  { key: "college.scheduleChanges", label: "Schedule changes weekly", what: "whether the class schedule changes week to week", kind: "yesno", options: YN, ocfs: true },
  ...schedule("college.schedule", "class"),
  { key: "otherAdult.who", label: "The other adult applying", what: "who the other adult applying with them is, if any", kind: "radio", options: ["spouse|Spouse", "otherParent|Other parent", "otherAdult|Other adult", "none|Nobody else"], ocfs: true },
  { key: "otherAdult.multipleJobs", label: "More than one job", what: "whether the other adult has more than one job", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.working", label: "Working", what: "whether the other adult is working", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.startingNewJob", label: "Starting a new job", what: "whether the other adult is about to start a new job", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.newJobStartDate", label: "Start date", what: "when that job starts, YYYY-MM-DD", kind: "date", ocfs: true },
  { key: "otherAdult.lookingForWork", label: "Looking for work", what: "whether the other adult is looking for work", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.employer", label: "Employer", what: "the other adult's employer", kind: "text", ocfs: true },
  { key: "otherAdult.hoursPerWeek", label: "Hours worked per week", what: "the other adult's hours worked per week", kind: "number", ocfs: true },
  { key: "otherAdult.scheduleChanges", label: "Schedule changes weekly", what: "whether the other adult's work schedule changes week to week", kind: "yesno", options: YN, ocfs: true },
  ...schedule("otherAdult.schedule", "the other adult's work"),
  { key: "otherAdult.training.inTraining", label: "In training", what: "whether the other adult is in a training program for work", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.training.startingSoon", label: "Starting training", what: "whether the other adult is about to start training", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.training.startDate", label: "Start date", what: "when that training starts, YYYY-MM-DD", kind: "date", ocfs: true },
  { key: "otherAdult.training.name", label: "Training program", what: "the other adult's training program or facility", kind: "text", ocfs: true },
  { key: "otherAdult.training.hoursPerWeek", label: "Hours of training per week", what: "the other adult's hours of training per week", kind: "number", ocfs: true },
  { key: "otherAdult.training.scheduleChanges", label: "Schedule changes weekly", what: "whether that training schedule changes week to week", kind: "yesno", options: YN, ocfs: true },
  ...schedule("otherAdult.training.schedule", "the other adult's training"),
  { key: "otherAdult.college.attending", label: "In college or classes", what: "whether the other adult is going to college or taking classes", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.college.startingSoon", label: "Starting college", what: "whether the other adult is about to start college or classes", kind: "yesno", options: YN, ocfs: true },
  { key: "otherAdult.college.startDate", label: "Start date", what: "when those classes start, YYYY-MM-DD", kind: "date", ocfs: true },
  { key: "otherAdult.college.name", label: "School or college", what: "the other adult's school or college", kind: "text", ocfs: true },
  { key: "otherAdult.college.hoursPerWeek", label: "Hours of classes per week", what: "the other adult's hours of classes per week", kind: "number", ocfs: true },
  { key: "otherAdult.college.scheduleChanges", label: "Schedule changes weekly", what: "whether that class schedule changes week to week", kind: "yesno", options: YN, ocfs: true },
  ...schedule("otherAdult.college.schedule", "the other adult's class"),
  { key: "attestation.ccap", label: "Attestation", what: "whether they attest that the child-care application is correct and complete — asked last", kind: "attest", always: true, tone: "caution", href: "/forms/OCFS-6025.pdf#page=5", options: ["yes|I attest", "no|Not yet"], ocfs: true },
]

/** `household[3].dob` → `household[n].dob`, so a row key matches its entry. */
export const normaliseKey = (key: string) => key.replace(/\[\d+\]/g, "[n]")

const INDEX = new Map(KEYS.map((k) => [k.key, k]))

/** The entry for a key, row index normalised; undefined for a key not in the vocabulary. */
export const keyDef = (key: string): KeyDef | undefined => INDEX.get(normaliseKey(key))

export const isKnownKey = (key: string) => INDEX.has(normaliseKey(key))

/** A label a person would read. The entry's, else the last segment humanised. */
export function labelFor(key: string): string {
  const hit = keyDef(key)
  if (hit) return hit.label
  const last = key.split(".").pop()!.replace(/\[\d+\]/g, "")
  return last
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** The fixed values for a key, if the form has them. */
export function optionsFor(key: string): { options: string[]; multi: boolean } | undefined {
  const hit = keyDef(key)
  return hit?.options ? { options: hit.options, multi: hit.multi === true } : undefined
}

/** Split `value|Label`. */
export function optionParts(o: string): { value: string; label: string } {
  const i = o.indexOf("|")
  return i === -1 ? { value: o, label: o } : { value: o.slice(0, i), label: o.slice(i + 1) }
}

/** The label printed beside a fixed value — `biweekly` → `Every two weeks`. */
export function optionLabel(key: string, value: string): string | undefined {
  const opts = optionsFor(key)?.options
  if (!opts) return undefined
  const hit = opts.find((o) => optionParts(o).value.toLowerCase() === value.trim().toLowerCase())
  return hit ? optionParts(hit).label : undefined
}

/** A stored multi value, as its parts. */
export const splitMulti = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

/** `household[3].dob` → 3; undefined when the key has no row. */
export function rowOf(key: string): number | undefined {
  const m = /\[(\d+)\]/.exec(key)
  return m ? Number(m[1]) : undefined
}

/** `household[n].dob` with row 3 → `household[3].dob`. */
export const atRow = (key: string, n: number) => key.replace("[n]", `[${n}]`)

/**
 * What a person sees for a stored value. Storage stays machine-shaped — ten
 * digits for a phone, digits for money, ISO for a date — because the fill
 * depends on that; this is the one place it is turned back into the shape it
 * was typed in.
 */
export function displayValue(key: string, value: string): string {
  const v = (value ?? "").trim()
  if (!v || v === "skip" || v === "unknown") return v
  const def = keyDef(key)
  const kind = def?.kind
  if (kind === "tel") {
    const d = v.replace(/\D/g, "")
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    return v
  }
  if (kind === "ssn") {
    const d = v.replace(/\D/g, "")
    return d.length === 9 ? `•••-••-${d.slice(5)}` : v
  }
  if (kind === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    return m ? `${m[2]}/${m[3]}/${m[1]}` : v
  }
  if (kind === "money") {
    const m = /^\$?\s*([\d,]+)(\.\d{1,2})?$/.exec(v)
    if (m) {
      const whole = Number(m[1].replace(/,/g, ""))
      if (Number.isFinite(whole)) return `$${whole.toLocaleString("en-US")}${m[2] ?? ""}`
    }
    return v
  }
  if (def?.options && !def.multi) return optionLabel(key, v) ?? v
  if (def?.options && def.multi) return splitMulti(v).map((p) => optionLabel(key, p) ?? p).join(", ")
  return v
}
