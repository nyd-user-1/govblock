import type { Binding, BlankRule, FieldInfo, FormSpec, RepeatBinding } from "@/lib/forms/spec"
import FIELDS from "@/lib/forms/specs/ldss-2921.fields.json"

// LDSS-2921 (Rev. 07/23), the common application, as an adapter from the
// applicant's keys onto the positional fields of livingston's fillable base.
//
// Built by sight on 2026-09-08 against scripts/forms/annotate.mjs's renders
// of every data page, with .research/2921-field-map.json and 2921-layout.json
// proposing candidates. A field name says where it is: p03_r462_c056 is page
// 3, a cell whose bottom is at y=462 and left edge at x=56. Every binding
// below names the printed label it sits beside.
//
// The base found the ruled grid on most pages and none of the write-in cells
// on page 2 (Section 3, the applicant's own name and address), none of the
// yes/no/who columns of Sections 15, 19, 20, 22 and 23, and none of the
// option lines of Section 18. `added` mints those at fill time from the
// printed labels' positions, named the same way. They are text cells that
// take an X or a value; the base's 176 checkboxes are the glyph-drawn ones.
//
// Pages 19–24 are notices, 25 is the withdrawal, 26 is blank, 27–28 the voter
// form; only the voter page takes anything.

const fields = FIELDS as FieldInfo[]

/** The text fields on one page at one column, top row first: the rows of a table. */
function column(page: number, x: number) {
  return fields.filter((f) => f.page === page && Math.abs(f.rect[0] - x) < 2 && f.type === "text").sort((a, b) => b.rect[1] - a.rect[1])
}

const cell = (name: string, page: number, rect: [number, number, number, number], label: string): FieldInfo => ({ name, type: "text", page, rect, label })

const NOT_NONE = "^(?!\\s*(no|none|n/a)\\s*$).+"
const IF_VOTER = { key: "voter.register", is: "yes" }

/* ---------------------------------------------------- the cells the base lacks */

const added: FieldInfo[] = []

// Page 2, Section 3 — APPLICANT INFORMATION. The label is printed inside each
// box and the value is written under it. Geometry from livingston's
// fill-form.ts APPLICANT table, which drew these by coordinate.
added.push(
  cell("p02_add_firstName", 2, [21, 454, 144, 12], "FIRST NAME"),
  cell("p02_add_mi", 2, [170, 454, 12, 12], "M.I."),
  cell("p02_add_lastName", 2, [187, 454, 188, 12], "LAST NAME"),
  cell("p02_add_marital", 2, [381, 454, 102, 12], "MARITAL STATUS"),
  cell("p02_add_phoneArea", 2, [505, 454, 42, 12], "PHONE NUMBER — AREA CODE"),
  cell("p02_add_phoneRest", 2, [552, 454, 58, 12], "PHONE NUMBER"),
  cell("p02_add_street", 2, [21, 430, 227, 12], "STREET ADDRESS"),
  cell("p02_add_apt", 2, [252, 430, 26, 12], "APT. NO."),
  cell("p02_add_city", 2, [282, 430, 126, 12], "CITY"),
  cell("p02_add_county", 2, [413, 430, 84, 12], "COUNTY"),
  cell("p02_add_state", 2, [502, 430, 25, 12], "STATE"),
  cell("p02_add_zip", 2, [531, 430, 79, 12], "ZIP CODE"),
  cell("p02_add_mailStreet", 2, [21, 383, 227, 12], "MAILING ADDRESS (IF DIFFERENT FROM ABOVE)"),
  cell("p02_add_mailApt", 2, [252, 383, 26, 12], "APT. NO."),
  cell("p02_add_mailCity", 2, [282, 383, 126, 12], "CITY"),
  cell("p02_add_mailCounty", 2, [413, 383, 84, 12], "COUNTY"),
  cell("p02_add_mailState", 2, [502, 383, 25, 12], "STATE"),
  cell("p02_add_mailZip", 2, [531, 383, 79, 12], "ZIP CODE"),
  cell("p02_add_email", 2, [450, 353, 158, 12], "EMAIL ADDRESS (OPTIONAL)"),
  cell("p02_add_langOther", 2, [158, 496, 42, 10], "OTHER (specify)"),
  cell("p02_add_urgentOther", 2, [648, 254, 92, 10], "Other ____ (Section 5)")
)

// Page 3, Section 6 — the household roster. "This person is applying for"
// has seven narrow columns per line and no cells; "Does This Person Buy Food
// or Prepare Meals with You?" has YES and NO columns and no cells.
const ROSTER = column(3, 56.2).slice(0, 8) // eight name cells, line 01 first
const PROGRAM_COLUMNS: [string, number][] = [["PA", 283], ["SNAP", 297], ["MA", 314], ["CC", 328], ["FC", 342], ["S", 356], ["EMRG", 370]]
ROSTER.forEach((row, i) => {
  const y = row.rect[1] + 3
  const line = i + 1
  if (line === 1) for (const [name, x] of PROGRAM_COLUMNS) added.push(cell(`p03_add_prog_${name}_r1`, 3, [x, y, 12, 13], `This person is applying for: ${name}, line 01`))
  // Line 01 is the applicant; the question is about the others.
  if (line === 1) return
  added.push(cell(`p03_add_food_yes_r${line}`, 3, [738, y, 14, 13], `Buy food or prepare meals with you? YES, line ${String(line).padStart(2, "0")}`))
  added.push(cell(`p03_add_food_no_r${line}`, 3, [758, y, 14, 13], `Buy food or prepare meals with you? NO, line ${String(line).padStart(2, "0")}`))
})
added.push(cell("p03_add_alias_first", 3, [183, 298, 150, 11], "PLEASE LIST MAIDEN OR OTHER NAMES — FIRST NAME"))

// Page 4, Section 7 — race and ethnicity has an H column with no cells.
const RACE_ROWS = column(4, 65).slice(0, 8)
RACE_ROWS.forEach((row, i) => added.push(cell(`p04_add_h_r${i + 1}`, 4, [30, row.rect[1], 33, row.rect[3]], `H — Hispanic or Latino, line ${String(i + 1).padStart(2, "0")}`)))

// Page 6, Section 10 — row A of the child-support referral has no name cell,
// and the date of birth has a YEAR cell only.
added.push(
  cell("p06_add_childName", 6, [20, 275, 138, 20], "NAME OF INDIVIDUAL UNDER AGE 21 — A."),
  cell("p06_add_dobMonth", 6, [420, 275, 22, 12], "PARENT'S DATE OF BIRTH — MONTH — A."),
  cell("p06_add_dobDay", 6, [444, 275, 20, 12], "PARENT'S DATE OF BIRTH — DAY — A.")
)

// Page 7, Section 12 — absent/deceased spouse has no cells at all.
added.push(cell("p07_add_spouseApplicant", 7, [32, 246, 108, 12], "NAME OF PERSON APPLYING (Section 12)"), cell("p07_add_spouseName", 7, [145, 246, 132, 12], "NAME OF SPOUSE"))

// Page 8, Section 15 — income. The base found the shaded INCOME box at the
// right and the trust and Other Income rows; the 26 other kinds' YES / NO /
// WHO / AMOUNT cells are minted here, one row per printed kind, from the
// labels' baselines. Wages are Section 17's gross-income line on page 10.
const INCOME_ROWS: [string, number, string][] = [
  ["unemployment", 536, "Unemployment Insurance Benefits"],
  ["ssi", 512, "Supplemental Security Income (SSI) Benefits"],
  ["ssd", 496, "Social Security Disability (SSD) Benefits"],
  ["socialSecurityDependent", 480, "Social Security Dependent Benefits"],
  ["socialSecuritySurvivor", 462, "Social Security Survivor's Benefits"],
  ["socialSecurityRetirement", 448, "Social Security Retirement Benefits"],
  ["railroadRetirement", 431, "Railroad Retirement Benefits"],
  ["pension", 417, "Retirement Benefits (Pensions)"],
  ["dividendsInterest", 403, "Dividends/Interest from Stocks, Bonds, Savings, etc."],
  ["workersComp", 387, "Workers' Compensation"],
  ["nysDisability", 373, "NYS Disability Benefits"],
  ["veterans", 360, "Veteran's Pension/Benefits/Aid and Attendance"],
  ["publicAssistance", 345, "Public Assistance Grant"],
  ["giAllotment", 331, "GI Dependency Allotments"],
  ["educationGrant", 315, "Education Grants or Loans"],
  ["contributions", 299, "Contributions/Gifts (Received)"],
  ["fosterCare", 286, "Foster Care Maintenance Payments (Received)"],
  ["childSupport", 265, "Child Support Payments (Received)"],
  ["spousalSupport", 248, "Spousal Support (Received)"],
  ["privateDisability", 224, "Private Disability Insurance"],
  ["noFault", 206, "No-Fault Insurance Benefits"],
  ["unionBenefits", 195, "Union Benefits (including Strike Benefits)"],
  ["loans", 182, "Loans, Other than Education (Received)"],
  ["trainingStipend", 136, "Training Allotments/Stipends"],
  ["rental", 119, "Rental Income (Received)"],
  ["boarders", 102, "Boarders/Lodgers Income (Received)"],
]
for (const [kind, y, label] of INCOME_ROWS) {
  added.push(
    cell(`p08_add_${kind}_yes`, 8, [271, y - 3, 14, 12], `${label} — YES`),
    cell(`p08_add_${kind}_no`, 8, [289, y - 3, 14, 12], `${label} — NO`),
    cell(`p08_add_${kind}_who1`, 8, [307, y - 3, 76, 12], `${label} — WHO`),
    cell(`p08_add_${kind}_amount1`, 8, [385, y - 3, 70, 12], `${label} — AMOUNT/VALUE & FREQUENCY`),
    cell(`p08_add_${kind}_who2`, 8, [457, y - 3, 82, 12], `${label} — WHO (second)`),
    cell(`p08_add_${kind}_amount2`, 8, [540, y - 3, 65, 12], `${label} — AMOUNT/VALUE & FREQUENCY (second)`)
  )
}
added.push(cell("p08_add_trust_yes", 8, [271, 152, 14, 12], "Income from a Trust — YES"), cell("p08_add_trust_no", 8, [289, 152, 14, 12], "Income from a Trust — NO"))

// Page 9, Section 16 — the stepparent and sponsor questions' YES / NO cells.
added.push(
  cell("p09_add_step_yes", 9, [213, 206, 13, 12], "Does the stepparent … have any resources or receive income? YES"),
  cell("p09_add_step_no", 9, [229, 206, 13, 12], "Does the stepparent … have any resources or receive income? NO"),
  cell("p09_add_sponsor_yes", 9, [213, 168, 13, 12], "Is anyone … a non-citizen … who was sponsored? YES"),
  cell("p09_add_sponsor_no", 9, [229, 168, 13, 12], "Is anyone … a non-citizen … who was sponsored? NO")
)

// Page 10, Section 17 — the write-in lines of the employment block.
added.push(
  cell("p10_add_gross1", 10, [96, 536, 68, 11], "Gross Income $"),
  cell("p10_add_employer1", 10, [42, 466, 300, 11], "Employer's Name and Address:"),
  cell("p10_add_who2", 10, [52, 426, 180, 11], "Is anyone else who lives with you currently employed — Who:"),
  cell("p10_add_gross2", 10, [96, 411, 68, 11], "Gross Income $ (anyone else)"),
  cell("p10_add_employer2", 10, [42, 367, 300, 11], "Employer's Name and Address: (anyone else)")
)

// Page 11, Section 17 continued — the last-job lines.
added.push(
  cell("p11_add_careAmount", 11, [505, 424, 50, 14], "CHILD/DEPENDENT CARE EXPENSES — Amount, first row"),
  cell("p11_add_lastWho", 11, [62, 537, 180, 11], "If not employed, when was the last time … worked? Who:"),
  cell("p11_add_lastWhere", 11, [72, 521, 328, 11], "Where:"),
  cell("p11_add_lastWhy", 11, [220, 505, 300, 11], "Why did you (or they) stop working?")
)

// Page 12, Section 18 — the education level is a list with a blank before
// each line, and the training and school questions are write-in lines.
added.push(
  cell("p12_add_edu_lessThanHighSchool", 12, [22, 544, 10, 10], "__ Less than high school diploma"),
  cell("p12_add_edu_lastGrade", 12, [152, 533, 28, 10], "If so, last grade completed? ____"),
  cell("p12_add_edu_iep", 12, [22, 523, 10, 10], "__ Completion of an Individualized Education Plan (IEP)"),
  cell("p12_add_edu_highSchoolOrGed", 12, [22, 513, 10, 10], "__ High school diploma or General Equivalency Diploma (GED) or TASC"),
  cell("p12_add_edu_associates", 12, [22, 492, 10, 10], "__ Associate's Degree (2-year college degree)"),
  cell("p12_add_edu_bachelorsOrHigher", 12, [22, 482, 10, 10], "__ Bachelor's Degree (4-year college degree) or higher"),
  cell("p12_add_training_who", 12, [45, 327, 200, 11], "Is or has been in any training program? Who"),
  cell("p12_add_training_program", 12, [62, 301, 190, 11], "Program"),
  cell("p12_add_school_who", 12, [45, 240, 200, 11], "Is 16 years of age or older and is attending school or college? Who"),
  cell("p12_add_school_where", 12, [52, 227, 200, 11], "Where")
)

// Page 13, Section 19 — resources: YES and NO columns without cells. Each
// row's AMOUNT/VALUE cell is the base's; these sit beside it.
const RESOURCE_ROWS: [string, number, string, string][] = [
  ["cash", 533, "Has cash available", "p13_r533_c365"],
  ["checking", 519, "Has a checking account(s)", "p13_r519_c365"],
  ["savings", 505, "Has a savings account(s) or certificate(s) of deposit", "p13_r505_c365"],
  ["creditUnion", 491, "Has a credit union account(s)", "p13_r491_c365"],
  ["lifeInsurance", 477, "Has life insurance", "p13_r477_c365"],
  ["vehicle", 462, "Has title or registration to a motor vehicle(s)", "p13_add_vehicle_value"],
  ["stocksBonds", 397, "Has stocks, bonds, certificates or mutual funds", "p13_r397_c365"],
  ["savingsBonds", 383, "Has savings bonds", "p13_r383_c365"],
  ["retirementAccount", 364, "Has an IRA, Keogh, 401(k) or deferred compensation account(s)", "p13_r358_c365"],
  ["burialTrust", 344, "Has an irrevocable burial trust", "p13_r344_c365"],
  ["burialFund", 330, "Has a burial fund", "p13_r330_c365"],
  ["burialSpace", 316, "Has a burial space", "p13_r316_c365"],
  ["ownHome", 302, "Has their own home", "p13_r302_c365"],
  ["realEstate", 284, "Has real estate, including income-producing and non-income-producing property", "p13_r278_c365"],
  ["taxRefund", 264, "Is eligible for an income tax refund", "p13_r264_c365"],
  ["annuity", 250, "Has an annuity", "p13_r250_c365"],
  ["trustBeneficiary", 236, "Is the beneficiary of a trust", "p13_r236_c365"],
  ["expectedMoney", 219, "Expects to receive a trust fund, lawsuit settlement, inheritance or income from any other sources", "p13_r215_c365"],
  ["inTrustAccount", 201, "Has an \"in trust\" account(s)", "p13_r201_c365"],
  ["safeDepositBox", 187, "Has a safe deposit box(es)", "p13_r187_c365"],
  ["other", 173, "Has resources other than those listed above", "p13_r173_c365"],
]
for (const [kind, y, label] of RESOURCE_ROWS) {
  added.push(cell(`p13_add_${kind}_yes`, 13, [254, y, 12, 12], `${label} — YES`), cell(`p13_add_${kind}_no`, 13, [269, y, 12, 12], `${label} — NO`))
}
added.push(
  cell("p13_add_vehicle_value", 13, [365, 440, 76, 13], "Has title or registration to a motor vehicle(s) — AMOUNT/VALUE"),
  cell("p13_add_vehicle_detail", 13, [110, 441, 138, 11], "Year ____ Make/Model ____"),
  cell("p13_add_soldRecently_yes", 13, [254, 148, 12, 12], "Has anyone … sold/transferred … in the past 36 months? — YES"),
  cell("p13_add_soldRecently_no", 13, [269, 148, 12, 12], "Has anyone … sold/transferred … in the past 36 months? — NO")
)

// Page 14, Section 20 — medical: YES / NO / IF YES, WHO columns without
// cells, and the insurance block's company line.
const MEDICAL_ROWS: [string, number, string][] = [
  ["bills", 531, "Has any medical bills or medically-related expenses"],
  ["insurance", 494, "Has health or hospital/accident insurance (including insurance from employer)"],
  ["disabled", 398, "Is blind, sick or disabled"],
  ["retroactive", 336, "Has paid or unpaid medical bills within 3 months preceding the month of this application"],
  ["longTermCare", 297, "Needs home care/personal care"],
  ["pregnant", 267, "Is pregnant"],
]
for (const [kind, y, label] of MEDICAL_ROWS) {
  added.push(cell(`p14_add_${kind}_yes`, 14, [250, y, 14, 12], `${label} — YES`), cell(`p14_add_${kind}_no`, 14, [268, y, 14, 12], `${label} — NO`))
  // IF YES, WHO — only where the vocabulary says who.
  if (["disabled", "longTermCare", "pregnant"].includes(kind)) added.push(cell(`p14_add_${kind}_who`, 14, [288, y, 66, 12], `${label} — IF YES, WHO`))
}
added.push(cell("p14_add_insuranceCompany", 14, [450, 470, 95, 10], "INSURANCE COMPANY NAME:"))

// Page 15, Section 21 — shelter: the landlord line and the two yes/no/amount rows.
added.push(
  cell("p15_add_landlord", 15, [35, 290, 230, 10], "WHAT IS YOUR LANDLORD'S NAME?"),
  cell("p15_add_rent_yes", 15, [246, 130, 11, 11], "Do you … have a rent, mortgage or other shelter expense? YES"),
  cell("p15_add_rent_no", 15, [261, 130, 11, 11], "Do you … have a rent, mortgage or other shelter expense? NO"),
  cell("p15_add_rent_amount", 15, [276, 130, 40, 11], "Do you … have a rent, mortgage or other shelter expense? IF YES, AMOUNT"),
  cell("p15_add_heat_yes", 15, [246, 99, 11, 11], "Do you … have a heat bill separate from your rent? YES"),
  cell("p15_add_heat_no", 15, [261, 99, 11, 11], "Do you … have a heat bill separate from your rent? NO"),
  cell("p15_add_heat_amount", 15, [276, 99, 40, 11], "Do you … have a heat bill separate from your rent? IF YES, AMOUNT")
)

// Page 16, Section 22 — other expenses: YES / NO / IF YES, AMOUNT without cells.
added.push(
  cell("p16_add_childSupportPaid_yes", 16, [222, 184, 14, 12], "Pays child support — YES"),
  cell("p16_add_childSupportPaid_no", 16, [243, 184, 14, 12], "Pays child support — NO"),
  cell("p16_add_childSupportPaid_amount", 16, [268, 184, 75, 12], "Pays child support — IF YES, AMOUNT"),
  cell("p16_add_childCare_yes", 16, [222, 162, 14, 12], "Pays for child care — YES"),
  cell("p16_add_childCare_no", 16, [243, 162, 14, 12], "Pays for child care — NO"),
  cell("p16_add_childCare_amount", 16, [268, 162, 75, 12], "Pays for child care — IF YES, AMOUNT"),
  cell("p16_add_other_yes", 16, [222, 110, 14, 12], "Has additional expenses — YES"),
  cell("p16_add_other_no", 16, [243, 110, 14, 12], "Has additional expenses — NO"),
  cell("p16_add_other_specify", 16, [72, 83, 150, 11], "Has additional expenses — Specify:")
)

// Page 17, Section 23 — the right column's YES / NO have no cells.
added.push(
  cell("p17_add_disqualified_yes", 17, [690, 490, 11, 11], "Have you … ever been found guilty of and/or been disqualified for PA and/or SNAP … ? YES"),
  cell("p17_add_disqualified_no", 17, [702, 490, 11, 11], "Have you … ever been found guilty of and/or been disqualified for PA and/or SNAP … ? NO")
)

// Page 27 — NYS Agency-Based Voter Registration Form, a portrait page with no
// fields of its own; the base's three fields there sit off the page.
added.push(
  cell("p27_add_reg_yes", 27, [44, 687, 9, 9], "YES — If you checked YES, please complete the VOTER REGISTRATION APPLICATION below"),
  cell("p27_add_reg_no", 27, [44, 672, 9, 9], "NO because I choose not to register"),
  cell("p27_add_reg_already", 27, [44, 659, 9, 9], "I am already registered at my current address"),
  cell("p27_add_citizen_yes", 27, [104, 507, 8, 8], "Are you a U.S. citizen? YES"),
  cell("p27_add_lastName", 27, [56, 458, 148, 12], "3 — Last Name"),
  cell("p27_add_firstName", 27, [208, 458, 120, 12], "3 — First Name"),
  cell("p27_add_mi", 27, [335, 458, 40, 12], "3 — Middle Initial"),
  cell("p27_add_address", 27, [56, 432, 200, 12], "4 — Address where you live"),
  cell("p27_add_apt", 27, [265, 432, 45, 12], "4 — Apt. No."),
  cell("p27_add_city", 27, [316, 432, 120, 12], "4 — City/Town/Village"),
  cell("p27_add_zip", 27, [445, 432, 55, 12], "4 — Zip Code"),
  cell("p27_add_county", 27, [518, 432, 50, 12], "4 — County"),
  cell("p27_add_dob", 27, [56, 380, 80, 12], "6 — Date of Birth"),
  cell("p27_add_phone", 27, [242, 380, 150, 12], "8 — Telephone (optional)"),
  cell("p27_add_email", 27, [410, 380, 150, 12], "8 — Email (optional)")
)

/* ----------------------------------------------------- the roster's lines */

/** Page 3, Section 6, one line: name, DOB, sex, gender, relationship, SSN. */
const roster = (line: number) => {
  const y = ROSTER[line - 1]?.rect[1]
  const at = (x: number) => fields.find((f) => f.page === 3 && Math.abs(f.rect[0] - x) < 2 && f.rect[1] === y)?.name ?? ""
  return { name: at(56.2), dob: at(390.2), sex: at(435.2), gender: at(462.2), relationship: at(570.2), ssn: at(615.2) }
}

/** Page 4, Section 7, one line: the H I A B P W U cells. */
const raceRow = (line: number) => {
  const y = RACE_ROWS[line - 1]?.rect[1]
  const at = (x: number) => fields.find((f) => f.page === 4 && Math.abs(f.rect[0] - x) < 2 && f.rect[1] === y)?.name ?? ""
  return { h: `p04_add_h_r${line}`, i: at(65), a: at(101), b: at(137), p: at(173), w: at(210), u: at(246) }
}

/** Page 5, Section 8, one line: first name, last name, CITIZEN / NON-CITIZEN. */
const CITIZEN_FIRST = column(5, 49)
const CITIZEN_LAST = column(5, 143)
const CITIZEN_BOX = fields.filter((f) => f.page === 5 && f.type === "check" && Math.abs(f.rect[0] - 259) < 2).sort((a, b) => b.rect[1] - a.rect[1])
const NONCITIZEN_BOX = fields.filter((f) => f.page === 5 && f.type === "check" && Math.abs(f.rect[0] - 319) < 2).sort((a, b) => b.rect[1] - a.rect[1])
const citizen = (line: number) => ({
  first: CITIZEN_FIRST[line - 1]?.name ?? "",
  last: CITIZEN_LAST[line - 1]?.name ?? "",
  citizen: CITIZEN_BOX[line - 1]?.name ?? "",
  nonCitizen: NONCITIZEN_BOX[line - 1]?.name ?? "",
})

/** Page 7, Section 11, one line: first name, M.I., last name and the eight status cells. */
const TAX_FIRST = column(7, 30)
const tax = (line: number) => {
  const y = TAX_FIRST[line - 1]?.rect[1]
  const at = (x: number) => fields.find((f) => f.page === 7 && Math.abs(f.rect[0] - x) < 2 && f.rect[1] === y)?.name ?? ""
  return { first: at(30), mi: at(112), last: at(152), single: at(230), jointly: at(284), separately: at(334), headOfHousehold: at(392), widow: at(458), dependent: at(526), notFiling: at(589) }
}

const raceBindings = (r: ReturnType<typeof raceRow>): Binding[] => [
  { field: r.h, match: "hispanic|latin", mark: "Y" },
  { field: r.i, match: "native american|american indian|alaska", mark: "Y" },
  { field: r.a, match: "asian", mark: "Y" },
  { field: r.b, match: "black|african", mark: "Y" },
  { field: r.p, match: "hawaiian|pacific", mark: "Y" },
  { field: r.w, match: "white|caucasian", mark: "Y" },
  { field: r.u, match: "unknown|decline|prefer not", mark: "Y" },
]

const L1 = roster(1)
const C1 = citizen(1)
const T1 = tax(1)

/* ------------------------------------------------------------- repeats */

// Household lines 02–08 across pages 3 (roster), 4 (race), 5 (citizenship)
// and 7 (tax status). The lines are not evenly spaced, so each row's fields
// are looked up rather than computed from a stride.
const household: RepeatBinding = {
  repeat: "household",
  offset: 1,
  rows: 7,
  computed: { fullName: { fn: "join", from: ["firstName", "lastName"] } },
  fields: {},
  rowFields: Array.from({ length: 7 }, (_, i) => {
    const line = i + 2
    const r = roster(line)
    const c = citizen(line)
    const t = tax(line)
    return {
      fullName: { field: r.name }, // p3 §6 line — First Name, Middle Initial, Last Name
      dob: { field: r.dob, format: "date" as const }, // Date of Birth (mm/dd/yyyy)
      sex: { field: r.sex }, // Sex (M/F/X)
      genderIdentity: { field: r.gender }, // Gender Identity (Optional)
      relationship: { field: r.relationship }, // Relationship to you
      ssn: { field: r.ssn, format: "ssn" as const }, // Social Security Number of Applying Household Members
      buysFoodTogether: [
        { field: `p03_add_food_yes_r${line}`, when: "yes" }, // Buy Food or Prepare Meals with You? YES
        { field: `p03_add_food_no_r${line}`, when: "no" }, // NO
      ],
      race: raceBindings(raceRow(line)), // p4 §7 H I A B P W U
      firstName: [{ field: c.first }, { field: t.first }], // p5 §8 FIRST NAME; p7 §11 FIRST NAME
      lastName: [{ field: c.last }, { field: t.last }], // p5 §8 LAST NAME; p7 §11 LAST NAME
      citizenship: [
        { field: c.citizen, when: "citizen" }, // p5 §8 CITIZEN/NATIONAL
        { field: c.nonCitizen, when: "qualified non-citizen|other" }, // NON-CITIZEN
      ],
    }
  }),
}

// Income by the printed kind, two earners a kind. The trust row and the
// Other Income rows are the base's own cells; wages are Section 17's line.
const income: RepeatBinding = {
  repeat: "income",
  rows: 12,
  classify: {
    key: "source",
    slots: 2,
    classes: Object.fromEntries([...INCOME_ROWS.map(([kind]) => [kind, kind]), ["trust", "trust"], ["other", "other"], ["job", "wages"], ["selfEmployment", "wages"]]),
  },
  computed: { amountPeriod: { fn: "amountPeriod", from: ["amount", "period", "periodDetail"] } },
  present: { field: "p08_add_{class}_yes" }, // YES
  fields: {
    who: { field: "p08_add_{class}_who{slot}" }, // WHO
    amountPeriod: { field: "p08_add_{class}_amount{slot}" }, // AMOUNT/VALUE & FREQUENCY
  },
  classFields: {
    trust: {
      who: { field: "{slot:p08_r145_c306|p08_r145_c456}" }, // Income from a Trust — WHO
      amountPeriod: { field: "{slot:p08_r145_c384|p08_r145_c539}" }, // AMOUNT/VALUE & FREQUENCY
    },
    other: {
      $present: { field: "" }, // the Other Income rows have no YES cell
      sourceDetail: { field: "{slot:p08_r052_c077|p08_r028_c077}" }, // Other Income (Please Specify)
      who: { field: "{slot:p08_r052_c306|p08_r028_c306}" }, // WHO
      amountPeriod: { field: "{slot:p08_r052_c383|p08_r028_c383}" }, // AMOUNT/VALUE & FREQUENCY
    },
    wages: {
      who: { field: "{slot:|p10_add_who2}" }, // p10 §17 Is anyone else … employed — Who:
      amount: { field: "{slot:p10_add_gross1|p10_add_gross2}", format: "money" }, // Gross Income $
      period: [
        { field: "{slot:p10_cb504_043|p10_cb402_043}", when: "weekly" }, // Paid: Weekly
        { field: "{slot:p10_cb504_089|p10_cb402_089}", when: "biweekly" }, // Biweekly
        { field: "{slot:p10_cb504_140|p10_cb402_140}", when: "monthly|twiceMonthly" }, // Monthly
      ],
    },
  },
}
// The wages class has no YES cell and no amount/period cell of its own: the
// template fields resolve to nothing (an empty field name is skipped) and
// Section 17's checkbox says the applicant is employed.
income.classFields!.wages.amountPeriod = { field: "" }
income.classFields!.wages.$present = { field: "" }

// Resources by the printed kind: YES beside it, the value in AMOUNT/VALUE.
const resources: RepeatBinding = {
  repeat: "resources",
  rows: 21,
  classify: { key: "kind", slots: 1, classes: Object.fromEntries(RESOURCE_ROWS.map(([kind]) => [kind, kind])) },
  present: { field: "p13_add_{class}_yes" }, // YES
  fields: { value: { field: "" } },
  classFields: Object.fromEntries(
    RESOURCE_ROWS.map(([kind, , , valueCell]) => [
      kind,
      {
        value: { field: valueCell, format: "money" as const }, // AMOUNT/VALUE
        kindDetail: { field: kind === "other" ? "p13_r173_c288" : kind === "vehicle" ? "p13_add_vehicle_detail" : "" }, // "other" names its kind in WHO; a vehicle on the Year/Make/Model line
      },
    ])
  ),
}

/* ------------------------------------------------------------- the spec */

export const LDSS_2921_SPEC: FormSpec = {
  id: "ldss-2921",
  code: "LDSS-2921",
  name: "Application for Certain Benefits and Services",
  agency: "NYS Office of Temporary and Disability Assistance",
  revision: "07/23",
  base: "/forms/LDSS-2921.pdf",
  fields,
  added,

  computed: {
    "applicant.fullName": { fn: "join", from: ["applicant.firstName", "applicant.middleInitial", "applicant.lastName"] },
    "applicant.fullNameNoMi": { fn: "join", from: ["applicant.firstName", "applicant.lastName"] },
    "applicant.under21": { fn: "under21", from: ["applicant.dob"] },
    "language.notices": { fn: "notices", from: ["language.read"] },
    "childSupport.absentParent.name": { fn: "join", from: ["childSupport.absentParent.firstName", "childSupport.absentParent.lastName"] },
    "childSupport.absentParent.nameAddress": { fn: "join", from: ["childSupport.absentParent.name", "childSupport.absentParent.lastAddress"], sep: ", " },
    "spouse.fullName": { fn: "join", from: ["spouse.firstName", "spouse.lastName"] },
    "stepparent.hasIncome": { fn: "nonzero", from: ["stepparent.income"] },
    "sponsor.hasIncome": { fn: "nonzero", from: ["sponsor.income"] },
    "income.hasUnemployment": { fn: "hasSource", arg: "unemployment" },
    "expenses.hasChildCare": { fn: "nonzero", from: ["expenses.childCare"] },
    "expenses.hasChildSupportPaid": { fn: "nonzero", from: ["expenses.childSupportPaid"] },
    "expenses.hasOther": { fn: "nonempty", from: ["expenses.other"] },
    "medical.hasInsurance": { fn: "whoYN", from: ["medical.insurance"] },
    "medical.isDisabled": { fn: "whoYN", from: ["medical.disabled"] },
    "medical.isPregnant": { fn: "whoYN", from: ["medical.pregnant"] },
    "medical.needsCare": { fn: "whoYN", from: ["medical.longTermCare"] },
    "shelter.hasCost": { fn: "shelterCost", from: ["shelter.type"] },
    "shelter.isShelter": { fn: "isShelter", from: ["shelter.type"] },
    "utilities.heatSeparate": { fn: "heatSeparate", from: ["shelter.heatIncluded"] },
  },

  map: {
    // ---- page 2, SECTION 1 — CHECK EACH PROGRAM YOU OR ANY HOUSEHOLD MEMBER ARE APPLYING FOR
    programs: [
      { field: "p02_cb565_233", when: "PA" }, // Public Assistance (PA)
      { field: "p02_cb565_325", when: "ChildCareInLieuOfPA" }, // Child Care in lieu of PA
      { field: "p02_cb565_418", when: "SNAP" }, // Supplemental Nutrition Assistance Program (SNAP)
      { field: "p02_cb565_612", when: "MedicaidAndSNAP" }, // Medicaid (MA) and SNAP
      { field: "p02_cb550_228", when: "MedicaidAndPA" }, // Medicaid (MA) and PA
      { field: "p02_cb550_319", when: "Services" }, // Services (S), including Foster Care (FC)
      { field: "p02_cb550_470", when: "ChildCare" }, // Child Care Assistance (CC)
      { field: "p02_cb550_577", when: "Emergency" }, // Emergency Assistance Only (EMRG)
      // Page 3, line 01 — "This person is applying for": the applicant's own columns.
      { field: "p03_add_prog_PA_r1", when: "PA|MedicaidAndPA" },
      { field: "p03_add_prog_SNAP_r1", when: "SNAP|MedicaidAndSNAP" },
      { field: "p03_add_prog_MA_r1", when: "MedicaidAndSNAP|MedicaidAndPA" },
      { field: "p03_add_prog_CC_r1", when: "ChildCare|ChildCareInLieuOfPA" },
      { field: "p03_add_prog_FC_r1", when: "Services" },
      { field: "p03_add_prog_S_r1", when: "Services" },
      { field: "p03_add_prog_EMRG_r1", when: "Emergency" },
    ],

    // ---- page 2, SECTION 2 — WHAT IS YOUR PRIMARY LANGUAGE?
    "language.read": [
      { field: "p02_cb508_100", when: "english" }, // ENGLISH
      { field: "p02_cb508_201", when: "spanish" }, // SPANISH
      { field: "p02_cb497_098", when: "other" }, // OTHER (specify)
    ],
    "language.readDetail": { field: "p02_add_langOther" }, // OTHER (specify) ____
    "language.notices": [
      { field: "p02_cb508_386", when: "english" }, // DO YOU WANT TO RECEIVE NOTICES IN: ENGLISH ONLY
      { field: "p02_cb508_456", when: "both" }, // ENGLISH AND SPANISH
    ],

    // ---- page 2, SECTION 5 — DO ANY OF THESE APPLY TO YOU?
    urgent: [
      { field: "p02_cb496_616", when: "pregnant" }, // 1 Pregnant
      { field: "p02_cb481_616", when: "domesticViolence" }, // 2 Victim of Domestic Violence
      { field: "p02_cb466_616", when: "establishParentage" }, // 3 Need to Establish Parentage
      { field: "p02_cb451_616", when: "needChildSupport" }, // 4 Need Child Support
      { field: "p02_cb436_616", when: "drugAlcohol" }, // 5 Drug/Alcohol Problem
      { field: "p02_cb421_616", when: "utilityShutoff" }, // 6 Fuel or Utility Shutoff
      { field: "p02_cb406_616", when: "homeless" }, // 7 No Place to Stay/Homeless
      { field: "p02_cb391_616", when: "fireOrDisaster" }, // 8 Fire or Other Disaster
      { field: "p02_cb376_616", when: "noIncome" }, // 9 Have No Income
      { field: "p02_cb361_616", when: "seriousMedical" }, // 10 Serious Medical Problem
      { field: "p02_cb346_616", when: "pendingEviction" }, // 11 Pending Eviction
      { field: "p02_cb331_616", when: "noFood" }, // 12 No Food
      { field: "p02_cb316_616", when: "needFosterCare" }, // 13 Need Foster Care
      { field: "p02_cb301_616", when: "needChildCare" }, // 14 Need Child Care
      { field: "p02_cb286_616", when: "problemsWithEnglish" }, // 15 Problems with English
      { field: "p02_cb271_616", when: "reasonableAccommodations" }, // 16 Reasonable Accommodations
      { field: "p02_cb256_615", when: "other" }, // 17 Other
      { field: "p02_cb294_193", when: "homeless" }, // IF YOU ARE CURRENTLY WITHOUT A HOME, CHECK HERE
      { field: "p06_cb486_095", when: "establishParentage" }, // p6 §10 1. … born to unmarried parents and/or … legal parentage has not been established? Yes
    ],
    "urgent.otherDetail": { field: "p02_add_urgentOther" }, // 17 Other ____
    "utilities.shutoffNotice": { field: "p02_cb421_616", when: "yes" }, // 6 Fuel or Utility Shutoff, implied by a shut-off notice
    "housing.homeless": [
      { field: "p02_cb406_616", when: "yes" }, // 7 No Place to Stay/Homeless
      { field: "p02_cb294_193", when: "yes" }, // IF YOU ARE CURRENTLY WITHOUT A HOME, CHECK HERE
    ],

    // ---- page 2, SECTION 3 — APPLICANT INFORMATION
    "applicant.firstName": [
      { field: "p02_add_firstName" }, // FIRST NAME
      { field: C1.first }, // p5 §8 line 01 FIRST NAME
      { field: T1.first }, // p7 §11 line 1 FIRST NAME
      { field: "p27_add_firstName", if: IF_VOTER }, // voter 3 — First Name
    ],
    "applicant.middleInitial": [
      { field: "p02_add_mi", format: "initial" }, // M.I.
      { field: T1.mi, format: "initial" }, // p7 §11 MIDDLE INITIAL
      { field: "p27_add_mi", format: "initial", if: IF_VOTER }, // voter 3 — Middle Initial
    ],
    "applicant.lastName": [
      { field: "p02_add_lastName" }, // LAST NAME
      { field: C1.last }, // p5 §8 line 01 LAST NAME
      { field: T1.last }, // p7 §11 LAST NAME
      { field: "p27_add_lastName", if: IF_VOTER }, // voter 3 — Last Name
    ],
    "applicant.fullName": { field: L1.name }, // p3 §6 line 01 — First Name, Middle Initial, Last Name
    "applicant.fullNameNoMi": [
      { field: "p07_add_spouseApplicant", if: { key: "spouse.absent", is: "yes" } }, // p7 §12 NAME OF PERSON APPLYING
      { field: "p07_add_spouseApplicant", if: { key: "spouse.deceased", is: "yes" } },
      { field: "p07_r173_c030", if: { key: "child.absent", is: "yes" } }, // p7 §13 NAME OF PERSON APPLYING
      { field: "p11_r422_c428", if: { key: "expenses.hasChildCare", is: "yes" } }, // p11 CHILD/DEPENDENT CARE EXPENSES — Who Pays
      { field: "p11_add_lastWho", if: { key: "employment.status", is: "unemployed|unable to work" } }, // p11 If not employed … Who:
      { field: "p12_add_training_who", if: { key: "employment.inTraining", is: "yes" } }, // p12 §18 training — Who
      { field: "p12_add_school_who", if: { key: "college.attending", is: "yes" } }, // p12 §18 attending school or college — Who
    ],
    "applicant.maritalStatus": { field: "p02_add_marital", format: "label" }, // MARITAL STATUS
    "applicant.maritalStatusDetail": { field: "p02_add_marital" }, // MARITAL STATUS, in their words
    "applicant.phone": [
      { field: "p02_add_phoneArea", format: "phone-area" }, // PHONE NUMBER — AREA CODE
      { field: "p02_add_phoneRest", format: "phone-rest" }, // PHONE NUMBER
      { field: "p27_add_phone", format: "phone", if: IF_VOTER }, // voter 8 — Telephone (optional)
    ],
    "applicant.phoneType": [
      { field: "p02_cb457_552", when: "cell" }, // MOBILE NUMBER? YES
      { field: "p02_cb457_572", when: "home|work" }, // MOBILE NUMBER? NO
    ],
    "applicant.email": [
      { field: "p02_add_email" }, // EMAIL ADDRESS (OPTIONAL)
      { field: "p27_add_email", if: IF_VOTER }, // voter 8 — Email (optional)
    ],
    "address.street": [{ field: "p02_add_street" }, { field: "p27_add_address", if: IF_VOTER }], // STREET ADDRESS; voter 4
    "address.apt": [{ field: "p02_add_apt" }, { field: "p27_add_apt", if: IF_VOTER }], // APT. NO.
    "address.city": [{ field: "p02_add_city" }, { field: "p27_add_city", if: IF_VOTER }], // CITY
    "address.county": [{ field: "p02_add_county" }, { field: "p27_add_county", if: IF_VOTER }], // COUNTY
    "address.state": { field: "p02_add_state", format: "upper" }, // STATE
    "address.zip": [{ field: "p02_add_zip" }, { field: "p27_add_zip", if: IF_VOTER }], // ZIP CODE
    // MAILING ADDRESS (IF DIFFERENT FROM ABOVE) — only when it is.
    "mailing.street": { field: "p02_add_mailStreet", if: { key: "mailing.same", is: "no" } },
    "mailing.apt": { field: "p02_add_mailApt", if: { key: "mailing.same", is: "no" } },
    "mailing.city": { field: "p02_add_mailCity", if: { key: "mailing.same", is: "no" } },
    "mailing.county": { field: "p02_add_mailCounty", if: { key: "mailing.same", is: "no" } },
    "mailing.state": { field: "p02_add_mailState", format: "upper", if: { key: "mailing.same", is: "no" } },
    "mailing.zip": { field: "p02_add_mailZip", if: { key: "mailing.same", is: "no" } },
    "shelter.isShelter": [
      { field: "p02_cb367_169", when: "yes" }, // IS THIS A SHELTER? YES
      { field: "p02_cb367_189", when: "no" }, // NO
    ],
    "applicant.aliases": { field: "p03_add_alias_first" }, // p3 PLEASE LIST MAIDEN OR OTHER NAMES — FIRST NAME

    // ---- page 3, SECTION 6 — HOUSEHOLD INFORMATION, line 01 (yourself)
    "applicant.dob": [
      { field: L1.dob, format: "date" }, // Date of Birth (mm/dd/yyyy)
      { field: "p27_add_dob", format: "date", if: IF_VOTER }, // voter 6 — Date of Birth
    ],
    "applicant.sex": { field: L1.sex }, // Sex (M/F/X)
    "applicant.genderIdentity": { field: L1.gender }, // Gender Identity (Optional)
    "applicant.ssn": { field: L1.ssn, format: "ssn" }, // Social Security Number of Applying Household Members
    "applicant.under21": [
      { field: "p06_cb401_149", when: "yes" }, // p6 §10 3. Are you under the age of 21? Yes
      { field: "p06_cb401_191", when: "no" }, // No
    ],
    "education.highestGrade": [
      { field: "p03_r099_c424", format: "label" }, // p3 INDIVIDUAL EDUCATION — LN 01 DEGREE RECEIVED
      { field: "p12_add_edu_lessThanHighSchool", when: "lessThanHighSchool" }, // p12 §18 __ Less than high school diploma
      { field: "p12_add_edu_iep", when: "iep" }, // __ Completion of an Individualized Education Plan (IEP)
      { field: "p12_add_edu_highSchoolOrGed", when: "highSchoolOrGed" }, // __ High school diploma or GED or TASC
      { field: "p12_add_edu_associates", when: "associates" }, // __ Associate's Degree
      { field: "p12_add_edu_bachelorsOrHigher", when: "bachelorsOrHigher" }, // __ Bachelor's Degree or higher
    ],
    "education.highestGradeDetail": { field: "p12_add_edu_lastGrade" }, // If so, last grade completed? ____

    // ---- page 4, SECTION 7 — RACE/ETHNICITY, line 01
    "applicant.race": raceBindings(raceRow(1)),

    // ---- page 5, SECTION 8 — CITIZENSHIP, line 01
    "applicant.citizenship": [
      { field: C1.citizen, when: "citizen" }, // CITIZEN/NATIONAL
      { field: C1.nonCitizen, when: "qualified non-citizen|other" }, // NON-CITIZEN
      { field: "p27_add_citizen_yes", when: "citizen", if: IF_VOTER }, // voter 1 — Are you a U.S. citizen? YES
    ],

    // ---- page 6, SECTION 10 — CHILD SUPPORT REFERRAL
    "childSupport.absentParent": [
      { field: "p06_cb474_390", when: "yes" }, // 2. … has an absent parent (noncustodial parent)? Yes
      { field: "p06_cb474_433", when: "no" }, // No
    ],
    "childSupport.absentParent.forChild": { field: "p06_add_childName" }, // NAME OF INDIVIDUAL UNDER AGE 21 — A.
    "childSupport.absentParent.nameAddress": { field: "p06_r273_c160" }, // NONCUSTODIAL, ALLEGED, OR INTENDED PARENT'S NAME AND ADDRESS — A.
    "childSupport.absentParent.dob": [
      { field: "p06_add_dobMonth", format: "date-mm" }, // PARENT'S DATE OF BIRTH — MONTH
      { field: "p06_add_dobDay", format: "date-dd" }, // DAY
      { field: "p06_r273_c465", format: "date-yyyy" }, // YEAR
    ],

    // ---- page 7, SECTION 11 — TAX FILING/DEPENDENT STATUS, line 1
    "taxes.files": { field: T1.notFiling, when: "no" }, // WILL NOT BE FILING TAXES
    "taxes.status": [
      { field: T1.single, when: "single" }, // SINGLE
      { field: T1.jointly, when: "jointly" }, // MARRIED FILING JOINTLY
      { field: T1.separately, when: "separately" }, // MARRIED FILING SINGLE
      { field: T1.headOfHousehold, when: "headOfHousehold" }, // HEAD OF HOUSEHOLD (WITH QUALIFYING INDIVIDUAL)
      { field: T1.widow, when: "widow" }, // QUALIFYING WIDOW(ER) WITH DEPENDENT CHILD
      { field: T1.dependent, when: "dependent" }, // DEPENDENT AND WILL BE FILING TAXES
    ],

    // ---- page 7, SECTION 12 — ABSENT/DECEASED SPOUSE
    "spouse.fullName": { field: "p07_add_spouseName" }, // NAME OF SPOUSE

    // ---- page 7, SECTION 14 — TEEN PARENT
    teenParent: [
      { field: "p07_cb114_264", when: "yes" }, // Is there a parent under the age of 18 … in the household? Yes
      { field: "p07_cb114_298", when: "no" }, // No
    ],

    // ---- page 8, SECTION 15 — INCOME
    "income.hasAny": [
      ...INCOME_ROWS.map(([kind]) => ({ field: `p08_add_${kind}_no`, when: "no" })), // NO, every kind
      { field: "p08_add_trust_no", when: "no" }, // Income from a Trust — NO
    ],

    // ---- page 9, SECTION 16 — STEPPARENT / SPONSOR
    "stepparent.hasIncome": [
      { field: "p09_add_step_yes", when: "yes" }, // Does the stepparent … have any resources or receive income? YES
      { field: "p09_add_step_no", when: "no" }, // NO
    ],
    "sponsor.hasIncome": [
      { field: "p09_add_sponsor_yes", when: "yes" }, // Is anyone … a non-citizen … who was sponsored? YES
      { field: "p09_add_sponsor_no", when: "no" }, // NO
    ],

    // ---- page 10, SECTION 17 — EMPLOYMENT
    "employment.status": [
      { field: "p10_cb555_092", when: "employed" }, // I am currently: employed
      { field: "p10_cb555_164", when: "self-employed" }, // self-employed
      { field: "p10_cb555_248", when: "unemployed" }, // unemployed
    ],
    "employment.employer": { field: "p10_add_employer1" }, // Employer's Name and Address:
    "otherAdult.working": { field: "p10_cb448_188", when: "yes" }, // Is anyone else who lives with you currently: employed
    "otherAdult.employer": { field: "p10_add_employer2" }, // Employer's Name and Address: (anyone else)
    "expenses.hasChildCare": [
      { field: "p10_cb272_278", when: "yes" }, // Do you … have child or dependent care expenses due to employment? Yes
      { field: "p10_cb272_332", when: "no" }, // No
      { field: "p16_add_childCare_yes", when: "yes" }, // p16 §22 Pays for child care — YES
      { field: "p16_add_childCare_no", when: "no" }, // NO
    ],
    "expenses.childCare": [
      { field: "p11_add_careAmount", format: "money", if: { key: "expenses.hasChildCare", is: "yes" } }, // p11 CHILD/DEPENDENT CARE EXPENSES — Amount, first row
      { field: "p16_add_childCare_amount", format: "money", if: { key: "expenses.hasChildCare", is: "yes" } }, // p16 §22 Pays for child care — IF YES, AMOUNT
    ],

    // ---- page 11, SECTION 17 continued
    "employment.lastWorked": { field: "p11_r551_c338", format: "date" }, // If not employed, when was the last time … worked? When:
    "employment.lastEmployer": { field: "p11_add_lastWhere" }, // Where:
    "employment.endReason": { field: "p11_add_lastWhy" }, // Why did you (or they) stop working?
    "income.hasUnemployment": [
      { field: "p11_cb472_241", when: "yes" }, // Did you or anyone living with you file for unemployment? Yes
      { field: "p11_cb472_268", when: "no" }, // No
    ],
    "other.strike": [
      { field: "p11_cb410_290", when: "yes" }, // Are you or is anyone who lives with you participating in a strike? Yes
      { field: "p11_cb410_341", when: "no" }, // No
    ],
    "medical.isDisabled": [
      { field: "p11_cb301_130", when: "yes" }, // Do you or any other adult … have any medical conditions that limit the ability to work … ? Yes
      { field: "p11_cb301_161", when: "no" }, // No
      { field: "p14_add_disabled_yes", when: "yes" }, // p14 §20 Is blind, sick or disabled — YES
      { field: "p14_add_disabled_no", when: "no" }, // NO
    ],
    "medical.disabled": { field: "p14_add_disabled_who", match: NOT_NONE, mark: "=" }, // p14 §20 Is blind, sick or disabled — IF YES, WHO

    // ---- page 12, SECTION 18 — EDUCATION/TRAINING
    "employment.inTraining": [
      { field: "p12_cb340_207", when: "yes" }, // Is or has been in any training program? Yes
      { field: "p12_cb340_246", when: "no" }, // No
    ],
    "training.name": { field: "p12_add_training_program" }, // Program
    "college.attending": [
      { field: "p12_cb263_207", when: "yes" }, // Is 16 years of age or older and is attending school or college? Yes
      { field: "p12_cb263_244", when: "no" }, // No
    ],
    "education.currentSchool": { field: "p12_add_school_where", match: NOT_NONE, mark: "=" }, // Where

    // ---- page 13, SECTION 19 — RESOURCES
    "resources.hasAny": RESOURCE_ROWS.map(([kind]) => ({ field: `p13_add_${kind}_no`, when: "no" })), // NO, every kind
    "other.soldRecently": [
      { field: "p13_add_soldRecently_yes", when: "yes" }, // Has anyone … given away any cash, or sold/transferred … in the past 36 months? YES
      { field: "p13_add_soldRecently_no", when: "no" }, // NO
      { field: "p17_cb150_514", when: "yes" }, // p17 PROPERTY TRANSFER STATUS — I have
      { field: "p17_cb150_566", when: "no" }, // I have not
    ],

    // ---- page 14, SECTION 20 — MEDICAL
    "medical.bills": [
      { field: "p14_add_bills_yes", when: "yes" }, // Has any medical bills or medically-related expenses — YES
      { field: "p14_add_bills_no", when: "no" }, // NO
    ],
    "medical.hasInsurance": [
      { field: "p14_add_insurance_yes", when: "yes" }, // Has health or hospital/accident insurance — YES
      { field: "p14_add_insurance_no", when: "no" }, // NO
    ],
    "medical.insurance": { field: "p14_add_insuranceCompany", match: NOT_NONE, mark: "=" }, // INSURANCE COMPANY NAME:
    "medical.retroactive": [
      { field: "p14_add_retroactive_yes", when: "yes" }, // Has paid or unpaid medical bills within 3 months preceding … — YES
      { field: "p14_add_retroactive_no", when: "no" }, // NO
    ],
    "medical.needsCare": [
      { field: "p14_add_longTermCare_yes", when: "yes" }, // Needs home care/personal care — YES
      { field: "p14_add_longTermCare_no", when: "no" }, // NO
    ],
    "medical.longTermCare": { field: "p14_add_longTermCare_who", match: NOT_NONE, mark: "=" }, // IF YES, WHO
    "medical.isPregnant": [
      { field: "p14_add_pregnant_yes", when: "yes" }, // Is pregnant — YES
      { field: "p14_add_pregnant_no", when: "no" }, // NO
    ],
    "medical.pregnant": { field: "p14_add_pregnant_who", match: NOT_NONE, mark: "=" }, // IF YES, WHO

    // ---- page 15, SECTION 21 — SHELTER
    "shelter.payee": { field: "p15_add_landlord" }, // WHAT IS YOUR LANDLORD'S NAME?
    "shelter.hasCost": [
      { field: "p15_add_rent_yes", when: "yes" }, // Do you … have a rent, mortgage or other shelter expense? YES
      { field: "p15_add_rent_no", when: "no" }, // NO
    ],
    "shelter.amount": [
      { field: "p15_add_rent_amount", format: "money" }, // IF YES, AMOUNT
      { field: "p15_r288_c410", format: "money", if: { key: "shelter.type", is: "roomAndBoard" } }, // SHELTER COSTS — A. Room and Board — MONTHLY ACTUAL COST
      { field: "p15_r275_c410", format: "money", if: { key: "shelter.type", is: "rent" } }, // B. Rent
      { field: "p15_r263_c410", format: "money", if: { key: "shelter.type", is: "trailerLot" } }, // C. Trailer Lot Rent
      { field: "p15_r251_c410", format: "money", if: { key: "shelter.type", is: "mortgage" } }, // D. Mortgage Payment
    ],
    "utilities.heatSeparate": [
      { field: "p15_add_heat_yes", when: "yes" }, // Do you … have a heat bill separate from your rent … ? YES
      { field: "p15_add_heat_no", when: "no" }, // NO
    ],
    "utilities.heatCost": { field: "p15_add_heat_amount", format: "money", if: { key: "shelter.heatIncluded", is: "no" } }, // IF YES, AMOUNT

    // ---- page 16, SECTION 22 — OTHER EXPENSES
    "expenses.hasChildSupportPaid": [
      { field: "p16_add_childSupportPaid_yes", when: "yes" }, // Pays child support — YES
      { field: "p16_add_childSupportPaid_no", when: "no" }, // NO
    ],
    "expenses.childSupportPaid": { field: "p16_add_childSupportPaid_amount", format: "money", if: { key: "expenses.hasChildSupportPaid", is: "yes" } }, // IF YES, AMOUNT
    "expenses.hasOther": [
      { field: "p16_add_other_yes", when: "yes" }, // Has additional expenses — YES
      { field: "p16_add_other_no", when: "no" }, // NO
    ],
    "expenses.other": { field: "p16_add_other_specify", match: NOT_NONE, mark: "=" }, // Specify:

    // ---- page 17, SECTION 23 — OTHER INFORMATION
    "other.veteran": [
      { field: "p17_cb502_250", when: "yes" }, // 10 Have you or anyone in your household ever been in the U.S. military? YES
      { field: "p17_cb502_316", when: "no" }, // NO
    ],
    "other.priorBenefits": [
      { field: "p17_cb361_306", when: "yes" }, // 14 Have you or anyone who lives with you received assistance or services in the past? YES
      { field: "p17_cb361_328", when: "no" }, // NO
    ],
    "other.disqualified": [
      { field: "p17_add_disqualified_yes", when: "yes" }, // Have you … ever been found guilty of and/or been disqualified for PA and/or SNAP … ? YES
      { field: "p17_add_disqualified_no", when: "no" }, // NO
    ],

    // ---- page 27 — voter registration
    "voter.register": [
      { field: "p27_add_reg_yes", when: "yes" }, // YES
      { field: "p27_add_reg_no", when: "no" }, // NO because I choose not to register
      { field: "p27_add_reg_already", when: "already" }, // I am already registered at my current address
    ],
  },

  repeats: [household, income, resources],

  blank: [
    { page: 1, why: "Office use: case name, worker, supervisor, the blind/visually-impaired formats question" },
    { page: 2, yMin: 490, xMax: 300, type: "text", why: "Section 2's shaded language cells: office use" },
    "p02_cb241_482", "p02_cb241_504", // DO YOU NEED THE MEDICAID PORTION … KEPT CONFIDENTIAL? — not asked
    { page: 3, yMin: 500, why: "Section 6 column headers' cells" },
    "p03_r309_c615", // maiden-name row's shaded cell
    "p03_cb250_085", "p03_cb250_142", // IS ANYONE SANCTIONED? — not asked
    { page: 3, yMax: 240, why: "Non-applicant information, non-citizen status detail, RCA/RMA referral, and the education lines beyond line 01: office use or questions the vocabulary does not hold" },
    { page: 4, xMin: 280, why: "Client identification numbers and codes: office use" },
    { page: 4, yMax: 330, why: "Anticipated future action, case type, service eligibility, documentation: office use" },
    { page: 5, yMin: 370, why: "SAVE referral: office use" },
    { page: 5, xMin: 640, why: "Section 9 DATE column: signed by hand" },
    { page: 6, xMin: 490, yMin: 300, why: "Documentation, referrals and CONSIDER: office use" },
    "p06_cb486_137", // 1. … parentage not established? No — only the Yes is implied by an urgent need
    { page: 6, yMax: 300, xMin: 490, why: "Rows A–E parent SSN and office columns" },
    { page: 6, yMax: 260, why: "Rows B–E of the referral: the vocabulary holds one absent parent" },
    "p06_r298_c018", // NAME OF INDIVIDUAL UNDER AGE 21 — header cell
    { page: 7, xMin: 650, why: "Office columns" },
    { page: 7, xMin: 100, yMin: 385, yMax: 470, why: "Section 11 lines 2–8: the household members' middle initials and tax statuses are not asked" },
    "p02_r517_c376", // the cell that holds the notices checkboxes
    { page: 7, yMin: 280, yMax: 330, why: "Tax dependents not living in the household: the vocabulary holds who is claimed, not where they live" },
    { page: 7, yMin: 140, yMax: 180, xMin: 100, why: "Section 13 columns beyond the applicant's name: the vocabulary holds only that a child lives elsewhere" },
    { page: 7, yMax: 140, why: "Section 14's teen-parent lines and office cells" },
    "p07_r163_c030", "p07_r152_c030", // Section 13 rows 2–3 NAME OF PERSON APPLYING: one absent child in the vocabulary
    "p07_cb061_206", "p07_cb061_240", // Does the teen parent's child live in the household? — not asked
    { page: 8, xMin: 600, why: "The shaded INCOME box and CD column: office use" },
    "p08_r064_c077", "p08_r064_c306", // Other Income row 1: the two rows with amount cells are used
    "p08_r052_c456", "p08_r052_c539", "p08_r028_c456", "p08_r028_c539", // Other Income second-earner cells: each other kind is its own row
    "p08_cb241_654", "p08_cb241_698", // Child Support Disregard Explained/Budgeted: office use
    { page: 9, why: "Medicaid deductions and the Section 16 office columns; the two questions' YES/NO are minted cells" },
    { page: 10, type: "text", why: "Office columns and the small cells beside the write-in lines" },
    "p10_cb448_248", "p10_cb402_043", "p10_cb402_089", "p10_cb402_140", // anyone else: self-employed, and their pay period — bound through the second wages slot only where a second earner exists
    "p10_cb336_278", "p10_cb336_332", "p10_cb322_278", "p10_cb322_332", // employer health insurance: not asked
    "p10_cb212_278", "p10_cb212_332", // other employment-related expenses: not asked
    { page: 11, type: "text", why: "Office columns and the CHILD/DEPENDENT CARE EXPENSES rows' name, age and provider: the vocabulary holds the amount and who pays" },
    "p11_cb439_087", "p11_cb439_132", "p11_cb439_169", // Status of filing: not asked
    "p11_cb351_290", "p11_cb351_344", // migrant or seasonal farm worker: not asked
    "p11_cb223_290", "p11_cb223_344", // Could you accept a job today? — not the same question as looking for work
    { page: 12, type: "text", why: "Office columns and dates attended/completed" },
    "p12_cb463_207", "p12_cb463_246", "p12_cb196_204", "p12_cb196_241", // anyone else's diploma; under-16 schooling: not asked
    { page: 12, xMin: 640, type: "check", why: "CONSIDER: office use" },
    { page: 13, xMin: 590, why: "Office columns" },
    { page: 13, type: "text", xMax: 300, why: "WHO columns: the vocabulary holds what is owned, not by whom" },
    { page: 13, type: "text", xMin: 440, xMax: 560, why: "The second owner's WHO and AMOUNT/VALUE" },
    { page: 13, yMax: 160, why: "Trust transfers, vehicle table, exemption: not asked" },
    "p13_r139_c365", "p13_r278_c513", "p13_r358_c513", // sold-in-36-months amount; second-owner cells
    { page: 14, why: "Office columns and the retroactive Medicaid block: office use" },
    { page: 15, why: "Retroactive Medicaid, TPHI, health plan selection, mortgage detail and documentation: office use or not asked" },
    { page: 16, why: "Non-heat utilities, heat type, public housing, and office columns: not asked" },
    { page: 17, why: "Office columns, prior-assistance detail rows, military and meals questions: not asked" },
    "p17_cb555_250", "p17_cb555_316", "p17_cb529_250", "p17_cb529_316", "p17_cb471_250", "p17_cb471_316", "p17_cb449_250", "p17_cb449_316", "p17_cb418_292", "p17_cb418_322",
    { page: 18, why: "Budget worksheet: office use" },
    { page: 19, why: "Notices" },
    { page: 25, why: "Withdrawal of application: not asked" },
    { page: 27, why: "The base's three fields here sit off the page; the voter form's cells are minted" },
  ] as BlankRule[],
}
