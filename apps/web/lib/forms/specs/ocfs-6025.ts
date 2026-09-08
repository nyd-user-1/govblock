import type { Binding, FieldInfo, FormSpec } from "@/lib/forms/spec"
import FIELDS from "@/lib/forms/specs/ocfs-6025.fields.json"

// OCFS-6025 (Rev. 06/2024), the child-care application, as an adapter from
// the applicant's keys onto its 429 named fields.
//
// The field names are the childcare app's (src/app/application/page.tsx,
// lines 620–830), reconciled against every field the PDF carries: what is not
// in `map` or a repeat is in `blank` with its reason. Every checkbox's
// on-value is `On` in this PDF — read by draft-spec.mjs, never assumed.

const yn = (base: string): Binding[] => [
  { field: `${base}_yes`, when: "yes" },
  { field: `${base}_no`, when: "no" },
]

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const schedule = (keyPrefix: string, fieldPrefix: string) => Object.fromEntries(DAYS.map((d) => [`${keyPrefix}.${d}`, { field: `${fieldPrefix}_${d}` }]))

/** The six race cells on a household row: Y in each the person's own words name. */
const race = (row: string): Binding[] => [
  { field: `${row}_hispanic`, match: "hispanic|latin", mark: "Y" },
  { field: `${row}_race_native`, match: "native american|american indian|alaska", mark: "Y" },
  { field: `${row}_race_asian`, match: "asian", mark: "Y" },
  { field: `${row}_race_black`, match: "black|african", mark: "Y" },
  { field: `${row}_race_pacific`, match: "hawaiian|pacific", mark: "Y" },
  { field: `${row}_race_white`, match: "white|caucasian", mark: "Y" },
]

export const OCFS_6025_SPEC: FormSpec = {
  id: "ocfs-6025",
  code: "OCFS-6025",
  name: "Application for Child Care Assistance",
  agency: "NYS Office of Children and Family Services",
  revision: "06/2024",
  base: "/forms/OCFS-6025.pdf",
  fields: FIELDS as FieldInfo[],

  computed: {
    "applicant.fullName": { fn: "join", from: ["applicant.firstName", "applicant.lastName"] },
  },

  map: {
    // ---- page 1: Tell us about yourself --------------------------------
    "applicant.fullName": [{ field: "full_name" }, { field: "hh1_name" }, { field: "sig_applicant_print_name" }],
    "applicant.aliases": { field: "aliases" },
    "address.street": { field: "address_street" },
    "address.apt": { field: "address_apt" },
    "address.city": { field: "address_city" },
    "address.state": { field: "address_state", format: "upper" },
    "address.county": { field: "address_county" },
    "address.zip": { field: "address_zip" },
    // The mailing block is only filled when it differs; a duplicated address
    // reads as a second address and gets queried.
    "mailing.street": { field: "mailing_street", if: { key: "mailing.same", is: "no" } },
    "mailing.apt": { field: "mailing_apt", if: { key: "mailing.same", is: "no" } },
    "mailing.city": { field: "mailing_city", if: { key: "mailing.same", is: "no" } },
    "mailing.state": { field: "mailing_state", format: "upper", if: { key: "mailing.same", is: "no" } },
    "mailing.county": { field: "mailing_county", if: { key: "mailing.same", is: "no" } },
    "mailing.zip": { field: "mailing_zip", if: { key: "mailing.same", is: "no" } },
    "applicant.phone": [
      { field: "phone_area", format: "phone-area" },
      { field: "phone_prefix", format: "phone-prefix" },
      { field: "phone_line", format: "phone-line" },
    ],
    "applicant.phoneType": [
      { field: "phone_type_cell", when: "cell" },
      { field: "phone_type_home", when: "home" },
      { field: "phone_type_work", when: "work" },
    ],
    "applicant.email": { field: "email" },
    "contact.preferred": [
      { field: "contact_pref_phone", when: "phone" },
      { field: "contact_pref_email", when: "email" },
      { field: "contact_pref_other", when: "other" },
    ],
    "contact.preferredDetail": { field: "contact_pref_other_text" },
    "language.speak": [
      { field: "lang_english", when: "english" },
      { field: "lang_spanish", when: "spanish" },
      { field: "lang_other", when: "other" },
    ],
    "language.speakDetail": { field: "lang_other_text" },
    "applicant.maritalStatus": [
      { field: "marital_single", when: "single" },
      { field: "marital_married", when: "married" },
      { field: "marital_divorced", when: "divorced" },
      { field: "marital_separated", when: "separated" },
      { field: "marital_widowed", when: "widowed" },
    ],
    // Do you or any adult(s) applying with you receive any of the following benefits?
    "benefits.receiving": [
      { field: "benefit_medicaid", when: "medicaid" },
      { field: "benefit_snap", when: "snap" },
      { field: "benefit_housing", when: "housing" },
      { field: "benefit_heap", when: "heap" },
      { field: "benefit_wic", when: "wic" },
      { field: "benefit_headstart", when: "headstart" },
      { field: "benefit_tanf", when: "tanf" },
      { field: "benefit_none", when: "none" },
    ],
    // Tell us about your household's circumstances.
    "housing.homeless": yn("homeless"),
    "military.active": yn("military_active"),
    "military.reserve": yn("military_reserve"),
    "otherFunding.has": yn("other_funding"),
    "otherFunding.agency": { field: "other_funding_agency" },
    "care.reason": { field: "reason_child_care_needed" },

    // ---- page 2: everyone in your home, line 1 is the applicant ---------
    "applicant.dob": { field: "hh1_dob", format: "date-mmddyy" },
    "applicant.sex": { field: "hh1_sex" },
    "applicant.genderIdentity": { field: "hh1_gender_identity" },
    "applicant.ssn": { field: "hh1_ssn", format: "ssn" },
    "applicant.race": race("hh1"),
    "applicant.citizenship": [
      { field: "hh1_us_citizen", when: "citizen", mark: "Y" },
      { field: "hh1_us_citizen", when: "qualified non-citizen|other", mark: "N" },
    ],

    // ---- page 3: your job and other activities --------------------------
    "employment.status": [
      { field: "work_need_care_yes", when: "employed|self-employed" },
      { field: "work_need_care_no", when: "unemployed|unable to work" },
    ],
    "employment.startingNewJob": yn("work_about_to_start"),
    "employment.newJobStartDate": { field: "work_start_date", format: "date" },
    "employment.lookingForWork": yn("work_looking_work"),
    "employment.employer": { field: "work_employer_name" },
    "employment.hoursPerWeek": { field: "work_hours_per_week" },
    "employment.scheduleChanges": yn("work_schedule_changes"),
    ...schedule("employment.schedule", "work_sched"),
    "employment.multipleJobs": yn("work_more_than_one"),
    "employment.inTraining": yn("training_need_care"),
    "training.startingSoon": yn("training_about_to_start"),
    "training.startDate": { field: "training_start_date", format: "date" },
    "training.name": { field: "training_program_name" },
    "training.hoursPerWeek": { field: "training_hours_per_week" },
    "training.scheduleChanges": yn("training_schedule_changes"),
    ...schedule("training.schedule", "training_sched"),
    "college.attending": yn("college_need_care"),
    "college.startingSoon": yn("college_about_to_start"),
    "college.startDate": { field: "college_start_date", format: "date" },
    "education.currentSchool": { field: "college_school_name", if: { key: "college.attending", is: "yes" } },
    "college.hoursPerWeek": { field: "college_hours_per_week" },
    "college.scheduleChanges": yn("college_schedule_changes"),
    ...schedule("college.schedule", "college_sched"),

    // Tell us about the other adult(s) applying with you.
    "otherAdult.who": [
      { field: "oa_whose_spouse", when: "spouse" },
      { field: "oa_whose_oparent", when: "otherParent" },
      { field: "oa_whose_oadult", when: "otherAdult" },
    ],
    "otherAdult.multipleJobs": yn("oa_more_than_one"),
    "otherAdult.working": yn("oa_working"),
    "otherAdult.startingNewJob": yn("oa_about_to_start"),
    "otherAdult.newJobStartDate": { field: "oa_start_date", format: "date" },
    "otherAdult.lookingForWork": yn("oa_looking_work"),
    "otherAdult.employer": { field: "oa_employer_name" },
    "otherAdult.hoursPerWeek": { field: "oa_hours_per_week" },
    "otherAdult.scheduleChanges": yn("oa_schedule_changes"),
    ...schedule("otherAdult.schedule", "oa_work_sched"),
    "otherAdult.training.inTraining": yn("oa_training_in"),
    "otherAdult.training.startingSoon": yn("oa_training_about_to_start"),
    "otherAdult.training.startDate": { field: "oa_training_start_date", format: "date" },
    "otherAdult.training.name": { field: "oa_training_program_name" },
    "otherAdult.training.hoursPerWeek": { field: "oa_training_hours_per_week" },
    "otherAdult.training.scheduleChanges": yn("oa_training_schedule_changes"),
    ...schedule("otherAdult.training.schedule", "oa_training_sched"),
    "otherAdult.college.attending": yn("oa_college_in"),
    "otherAdult.college.startingSoon": yn("oa_college_about_to_start"),
    "otherAdult.college.startDate": { field: "oa_college_start_date", format: "date" },
    "otherAdult.college.name": { field: "oa_college_school_name" },
    "otherAdult.college.hoursPerWeek": { field: "oa_college_hours_per_week" },
    "otherAdult.college.scheduleChanges": yn("oa_college_schedule_changes"),
    ...schedule("otherAdult.college.schedule", "oa_college_sched"),

    // ---- page 4: income — every kind the form lists, No when there is none
    "income.hasAny": [
      "work", "self_employment", "child_support", "alimony", "unemployment", "social_security", "disability", "rental", "dividends", "pensions", "public_assistance", "other",
    ].map((kind) => ({ field: `income_${kind}_no`, when: "no" })),

    // ---- page 5: attestation -------------------------------------------
    "attestation.ccap": { field: "attestation_agree", when: "yes" },
  },

  repeats: [
    {
      // Household lines 2–8; line 1 is the applicant, mapped above.
      repeat: "household",
      offset: 1,
      rows: 7,
      computed: { fullName: { fn: "join", from: ["firstName", "lastName"] } },
      fields: {
        fullName: { field: "hh{n}_name" },
        dob: { field: "hh{n}_dob", format: "date-mmddyy" },
        sex: { field: "hh{n}_sex" },
        relationship: { field: "hh{n}_relationship" },
        genderIdentity: { field: "hh{n}_gender_identity" },
        ssn: { field: "hh{n}_ssn", format: "ssn" },
        race: race("hh{n}"),
        citizenship: [
          { field: "hh{n}_us_citizen", when: "citizen", mark: "Y" },
          { field: "hh{n}_us_citizen", when: "qualified non-citizen|other", mark: "N" },
        ],
        needsCare: { field: "hh{n}_needs_care", format: "yn" },
        specialNeeds: { field: "hh{n}_special_needs", format: "yn" },
        bothParents: { field: "hh{n}_both_parents", format: "yn" },
      },
    },
    {
      // Children whose other parent does not live in the home.
      repeat: "absentParent",
      rows: 4,
      fields: {
        child: { field: "parent_not_home_{n}_name" },
        available: yn("parent_not_home_{n}_available"),
        reason: { field: "parent_not_home_{n}_reason" },
      },
    },
    {
      // Income by the form's own kinds, two earners a kind.
      repeat: "income",
      rows: 24,
      classify: {
        key: "source",
        slots: 2,
        classes: {
          job: "work",
          selfEmployment: "self_employment",
          childSupport: "child_support",
          spousalSupport: "alimony",
          unemployment: "unemployment",
          workersComp: "unemployment",
          ssi: "social_security",
          socialSecurityDependent: "social_security",
          socialSecuritySurvivor: "social_security",
          socialSecurityRetirement: "social_security",
          railroadRetirement: "social_security",
          ssd: "disability",
          nysDisability: "disability",
          veterans: "disability",
          privateDisability: "disability",
          rental: "rental",
          boarders: "rental",
          dividendsInterest: "dividends",
          pension: "pensions",
          publicAssistance: "public_assistance",
          giAllotment: "other",
          educationGrant: "other",
          contributions: "other",
          fosterCare: "other",
          noFault: "other",
          unionBenefits: "other",
          loans: "other",
          trust: "other",
          trainingStipend: "other",
          other: "other",
        },
      },
      // The "Other (Please specify.)" line has no field in this PDF, so what
      // the other income is rides in its WHO cell beside the earner's name.
      computed: { whoDetail: { fn: "join", from: ["who", "sourceDetail"], sep: " — " } },
      present: { field: "income_{class}_yes" },
      fields: {
        who: { field: "income_{class}_who{slot}" },
        amount: { field: "income_{class}_amount{slot}", format: "money" },
        period: { field: "income_{class}_period{slot}", format: "label" },
      },
      classFields: {
        other: { who: { field: "" }, whoDetail: { field: "income_other_who{slot}" } },
      },
    },
  ],

  blank: [
    // The applicant's own line has no relationship cell; the adult is not a child.
    "hh1_needs_care", "hh1_special_needs", "hh1_both_parents",
    // Signatures and dates are written by hand; the other adult signs for themself.
    "sig_applicant_signature", "sig_applicant_date_signed", "sig_other_adult_signature", "sig_other_adult_print_name", "sig_other_adult_date_signed",
    // For agency use only.
    "agency_case_name", "agency_case_number", "agency_district_case_type_after40", "agency_application_date", "agency_new_open", "agency_reopen", "agency_recertification", "agency_denial", "agency_withdrawal", "agency_denial_reason_code_1", "agency_denial_reason_code_2", "agency_eligibility_determined_by", "agency_eligibility_determined_date", "agency_eligibility_approved_by", "agency_eligibility_approved_date", "agency_comments", "agency_auth_date_from", "agency_auth_date_to", "agency_l1_cin", "agency_l2_cin", "agency_l3_cin", "agency_l4_cin", "agency_l5_cin", "agency_l6_cin",
  ],
}
