// GovBlock's own tags (Brendan, 2026-09-16: "generate original tags as you see
// fit and we'll improve their definition and accuracy later"). Until now /tags
// stood on the Congressional Research Service's vocabulary — its policy areas
// and legislative subjects — which is the record's own filing, not ours. These
// are ours: a reader's words for what a bill is about, each defined by the
// source terms it gathers, so a tag page shows real bills from the first day.
//
// `match` is read against the jurisdiction's own term names, case-insensitively;
// a tag holds every bill filed under a term it matches. The blurbs are a first
// pass and are meant to be argued with.

export type Tag = {
  name: string
  slug: string
  blurb: string
  /** The source terms this tag gathers, as patterns over their names. */
  match: string[]
  /**
   * Bills this tag gathers by their own title. The Congressional Research
   * Service has no term for some of what a reader looks for — there is no
   * "artificial intelligence" subject — so a tag may also name the words a bill
   * calls itself by.
   */
  title?: string[]
}

export const TAGS: Tag[] = [
  { name: "Agriculture", slug: "agriculture", blurb: "Farming, crops, livestock and the programs that pay for them.", match: ["agricultur", "farm", "crop", "livestock", "dairy"] },
  { name: "Animals", slug: "animals", blurb: "Animal welfare, veterinary care and the treatment of animals in law.", match: ["^animals$", "animal welfare", "veterinar"] },
  { name: "Appropriations", slug: "appropriations", blurb: "The bills that hand out federal money and the fights over them.", match: ["appropriation", "budget process", "government trust funds"] },
  { name: "Artificial Intelligence", slug: "artificial-intelligence", blurb: "Automated decision-making, from research funding to what agencies may deploy.", match: ["artificial intelligence", "machine learning"], title: ["artificial intelligence", "machine learning", "\\bA\\.?I\\.?\\b", "large language model", "deepfake", "algorithmic"] },
  { name: "Asia", slug: "asia", blurb: "Relations with Asian governments, from trade to defense.", match: ["^asia$", "japan", "korea", "india", "vietnam", "philippines"] },
  { name: "Aviation", slug: "aviation", blurb: "Airlines, airports, air traffic control and what flies above them.", match: ["aviation", "airport", "aircraft", "drone"] },
  { name: "Banking", slug: "banking", blurb: "Banks, credit unions and the rules examiners hold them to.", match: ["banking", "financial institutions", "credit"] },
  { name: "Border Security", slug: "border-security", blurb: "The border itself: enforcement, ports of entry and unlawful crossing.", match: ["border security", "customs enforcement", "border"] },
  { name: "Broadband", slug: "broadband", blurb: "Getting networks to places that do not have them, and paying for it.", match: ["broadband", "internet, web applications", "telecommunication"] },
  { name: "Campaign Finance", slug: "campaign-finance", blurb: "Money raised and spent to win office, and who must disclose it.", match: ["campaign", "political action committees", "political parties"] },
  { name: "Child Welfare", slug: "child-welfare", blurb: "Children in the state's care: safety, foster care and adoption.", match: ["child safety and welfare", "adoption", "foster", "child care"] },
  { name: "China", slug: "china", blurb: "The People's Republic: trade, technology, security and sanction.", match: ["china", "hong kong", "taiwan"] },
  { name: "Civil Rights", slug: "civil-rights", blurb: "Equal protection, discrimination and the reach of the law over it.", match: ["civil rights", "discrimination", "racial and ethnic", "minority"] },
  { name: "Climate", slug: "climate", blurb: "Warming, emissions and the policies aimed at both.", match: ["climate", "greenhouse gas", "global warming", "air quality"] },
  { name: "Congress", slug: "congress", blurb: "The institution itself: its rules, its members and its committees.", match: ["^congress", "house of representatives", "^senate$", "legislative rules", "members of congress"] },
  { name: "Consumer Protection", slug: "consumer-protection", blurb: "What sellers may claim, charge and hide from buyers.", match: ["consumer", "advertising", "product safety"] },
  { name: "Courts", slug: "courts", blurb: "Judges, jurisdiction and how a case moves through the federal bench.", match: ["judicial", "courts", "judges", "civil actions and liability"] },
  { name: "Crime", slug: "crime", blurb: "Offenses, sentencing and the machinery of prosecution.", match: ["crime", "criminal", "violent crime", "offenses"] },
  { name: "Cybersecurity", slug: "cybersecurity", blurb: "Attacks on networks and the defenses required by law.", match: ["computer security", "cyber", "identity theft"] },
  { name: "Data Privacy", slug: "data-privacy", blurb: "What may be collected about a person and who may hold it.", match: ["data collection, sharing, protection", "privacy", "health information and medical records"] },
  { name: "Defense", slug: "defense", blurb: "The armed forces, their budget and what they are sent to do.", match: ["armed forces and national security", "defense", "military", "conflicts and wars"] },
  { name: "Disability", slug: "disability", blurb: "Access, benefits and the rights of disabled Americans.", match: ["disability", "disabilities"] },
  { name: "Disaster Relief", slug: "disaster-relief", blurb: "What the government owes a place after a flood, a fire or a storm.", match: ["emergency management", "disaster", "emergency planning", "flood"] },
  { name: "Drug Policy", slug: "drug-policy", blurb: "Controlled substances: trafficking, treatment and what counts as legal.", match: ["drug trafficking", "drug, alcohol, tobacco", "controlled substances", "opioid"] },
  { name: "Education", slug: "education", blurb: "Schools, teachers and the money that reaches a classroom.", match: ["education", "school", "teacher"] },
  { name: "Elections", slug: "elections", blurb: "How votes are cast, counted and contested.", match: ["election", "voting", "voter"] },
  { name: "Electric Grid", slug: "electric-grid", blurb: "Generation, transmission and keeping the lights on.", match: ["electric power", "utilit", "grid"] },
  { name: "Energy", slug: "energy", blurb: "Where power comes from, and what it costs to produce.", match: ["^energy", "oil and gas", "petroleum", "renewable", "solar", "wind"] },
  { name: "Environment", slug: "environment", blurb: "Pollution, cleanup and the agencies that police both.", match: ["environmental", "pollut", "hazardous wastes", "toxic substances"] },
  { name: "Ethics in Government", slug: "ethics-in-government", blurb: "Conflicts of interest, corruption and what officials must disclose.", match: ["government ethics", "public corruption", "conflict of interest"] },
  { name: "Families", slug: "families", blurb: "Marriage, parenting and the household as a unit of law.", match: ["famil", "marriage", "domestic relations"] },
  { name: "Federal Workforce", slug: "federal-workforce", blurb: "The people who staff the government: pay, hiring and dismissal.", match: ["government employee", "federal officials", "employee hiring", "civil service"] },
  { name: "Firearms", slug: "firearms", blurb: "Guns: who may own one, carry one and sell one.", match: ["firearms", "explosives", "gun"] },
  { name: "Fisheries", slug: "fisheries", blurb: "Fishing grounds, catch limits and the coasts that depend on them.", match: ["fisher", "marine and coastal"] },
  { name: "Food Safety", slug: "food-safety", blurb: "What may be sold to eat, and who inspects it.", match: ["food industry", "food supply", "nutrition", "^food"] },
  { name: "Foreign Aid", slug: "foreign-aid", blurb: "Money and help sent abroad, and the conditions attached.", match: ["foreign aid", "humanitarian assistance", "international organizations"] },
  { name: "Forests", slug: "forests", blurb: "Timber, forest health and the land the Forest Service holds.", match: ["forest", "timber", "trees"] },
  { name: "Government Contracts", slug: "government-contracts", blurb: "What the government buys, from whom, and on what terms.", match: ["public contracts and procurement", "government lending", "contractor"] },
  { name: "Health Care Costs", slug: "health-care-costs", blurb: "Premiums, prices and the bill a patient is finally handed.", match: ["health care costs and insurance", "health care coverage", "health programs administration"] },
  { name: "Higher Education", slug: "higher-education", blurb: "Colleges, accreditation and what a degree costs.", match: ["higher education", "student aid and college costs", "universit"] },
  { name: "Housing", slug: "housing", blurb: "Building homes, renting them and who can afford either.", match: ["housing", "mortgage", "rent", "homeless"] },
  { name: "Immigration", slug: "immigration", blurb: "Who may enter, stay and become a citizen.", match: ["immigration", "refugee", "asylum", "visa", "citizenship"] },
  { name: "Indian Country", slug: "indian-country", blurb: "Tribal sovereignty, trust lands and the federal-tribal relationship.", match: ["indian lands", "native american", "federal-indian", "tribal", "alaska native"] },
  { name: "Infrastructure", slug: "infrastructure", blurb: "Roads, bridges, ports and the public works that carry them.", match: ["public works", "infrastructure", "bridges", "highway", "roads"] },
  { name: "Intelligence", slug: "intelligence", blurb: "Spycraft, surveillance and the oversight of both.", match: ["intelligence activities", "surveillance", "espionage"] },
  { name: "Judiciary", slug: "judiciary", blurb: "The federal bench as an institution, and who is confirmed to it.", match: ["judicial", "judges", "supreme court"] },
  { name: "K-12 Education", slug: "k-12-education", blurb: "Elementary and secondary schools, and what is taught in them.", match: ["elementary and secondary education", "education programs funding", "student"] },
  { name: "Labor", slug: "labor", blurb: "Work, wages and the rights of the people doing it.", match: ["labor", "wages and earnings", "employment", "collective bargaining", "employee"] },
  { name: "Land Conservation", slug: "land-conservation", blurb: "Public land kept as it is, and the uses allowed on it.", match: ["land use and conservation", "public lands", "wilderness", "land transfers"] },
  { name: "Law Enforcement", slug: "law-enforcement", blurb: "Police, federal agents and the funding behind a badge.", match: ["law enforcement", "police", "first responders"] },
  { name: "Manufacturing", slug: "manufacturing", blurb: "What is built in the country, and the supply chains behind it.", match: ["manufactur", "industrial", "supply chain"] },
  { name: "Medicaid", slug: "medicaid", blurb: "Coverage for low-income Americans, and the state-federal split.", match: ["medicaid"] },
  { name: "Medicare", slug: "medicare", blurb: "Coverage for older Americans, and what it pays for.", match: ["medicare"] },
  { name: "Mental Health", slug: "mental-health", blurb: "Treatment, crisis response and parity with physical care.", match: ["mental health", "suicide", "substance abuse treatment"] },
  { name: "Military Families", slug: "military-families", blurb: "Service members' households: housing, schooling and pay.", match: ["military personnel and dependents", "military families"] },
  { name: "Mining", slug: "mining", blurb: "Extraction, claims and the minerals under public land.", match: ["mining", "mineral", "coal"] },
  { name: "National Parks", slug: "national-parks", blurb: "Parks, monuments, trails and what may be done in them.", match: ["parks, recreation areas, trails", "monuments", "national park"] },
  { name: "Nuclear Energy", slug: "nuclear-energy", blurb: "Reactors, waste and the regulators in between.", match: ["nuclear"] },
  { name: "Nutrition Assistance", slug: "nutrition-assistance", blurb: "Food aid: who qualifies and what the benefit buys.", match: ["food assistance", "nutrition", "school meals"] },
  { name: "Oceans", slug: "oceans", blurb: "The sea, its resources and the coasts it meets.", match: ["marine", "ocean", "coastal", "^water resources"] },
  { name: "Oversight", slug: "oversight", blurb: "Congress asking the executive branch what it has been doing.", match: ["congressional oversight", "government studies and investigations", "performance measurement", "accounting and auditing"] },
  { name: "Pensions", slug: "pensions", blurb: "Retirement plans, their funding and their guarantees.", match: ["employee benefits and pensions", "retirement", "pension"] },
  { name: "Pharmaceuticals", slug: "pharmaceuticals", blurb: "Drugs: approval, pricing and supply.", match: ["prescription drugs", "drug approval", "pharmaceutic"] },
  { name: "Postal Service", slug: "postal-service", blurb: "The mail: its finances, its service and its obligations.", match: ["postal"] },
  { name: "Prisons", slug: "prisons", blurb: "Incarceration, sentencing and what happens after release.", match: ["correctional", "prison", "criminal procedure and sentencing", "reentry"] },
  { name: "Public Health", slug: "public-health", blurb: "Disease, prevention and the agencies watching for both.", match: ["health promotion and preventive care", "disease", "epidemic", "public health", "immuniz"] },
  { name: "Quality of Care", slug: "quality-of-care", blurb: "Whether the care delivered is any good, and who measures it.", match: ["health care quality", "health facilities", "health personnel", "medical malpractice"] },
  { name: "Research Funding", slug: "research-funding", blurb: "Federal money for science, and the strings on it.", match: ["research administration and funding", "research and development", "medical research", "science"] },
  { name: "Rural Development", slug: "rural-development", blurb: "Small towns and the country between them.", match: ["rural"] },
  { name: "Sanctions", slug: "sanctions", blurb: "Penalties aimed at governments, companies and individuals abroad.", match: ["sanction", "embargo", "export controls"] },
  { name: "Small Business", slug: "small-business", blurb: "Firms too small to lobby, and the programs meant for them.", match: ["small business", "entrepreneur"] },
  { name: "Social Security", slug: "social-security", blurb: "The retirement and disability programs, and their trust funds.", match: ["social security", "old age"] },
  { name: "Space", slug: "space", blurb: "Launches, satellites and the agencies that run them.", match: ["space", "satellite", "astronaut"] },
  { name: "Student Loans", slug: "student-loans", blurb: "Borrowing for school, repaying it and forgiving it.", match: ["student aid and college costs", "student loan", "loan forgiveness"] },
  { name: "Taxes", slug: "taxes", blurb: "What is owed, who collects it and which breaks survive.", match: ["taxation", "^tax", "income tax", "tax credit"] },
  { name: "Technology", slug: "technology", blurb: "Computing, software and the government's use of both.", match: ["computers and information technology", "technological innovations", "software"] },
  { name: "Telecommunications", slug: "telecommunications", blurb: "Phones, spectrum and the carriers in between.", match: ["telephone and wireless", "spectrum", "broadcast"] },
  { name: "Terrorism", slug: "terrorism", blurb: "Political violence and the powers claimed to stop it.", match: ["terror", "homeland security"] },
  { name: "Trade", slug: "trade", blurb: "Imports, exports, tariffs and the agreements behind them.", match: ["foreign trade", "trade agreements", "tariff", "customs"] },
  { name: "Transportation", slug: "transportation", blurb: "How people and freight move, and who pays for the way.", match: ["transportation", "motor vehicles", "railroad", "transit", "shipping"] },
  { name: "Ukraine", slug: "ukraine", blurb: "The war and the American response to it.", match: ["ukraine", "russia"] },
  { name: "Unemployment", slug: "unemployment", blurb: "Being out of work: benefits, retraining and the count itself.", match: ["unemployment", "employment and training programs"] },
  { name: "Urban Development", slug: "urban-development", blurb: "Cities: their grants, their planning and their growth.", match: ["urban", "housing and community development", "community life"] },
  { name: "Veterans", slug: "veterans", blurb: "What the country owes the people it sent to war.", match: ["veteran"] },
  { name: "Voting Rights", slug: "voting-rights", blurb: "Access to the ballot and the law protecting it.", match: ["voting rights", "voter registration", "election administration"] },
  { name: "Water", slug: "water", blurb: "Supply, drought, dams and what comes out of the tap.", match: ["water use and supply", "water resources", "drinking water", "irrigation"] },
  { name: "Wildfires", slug: "wildfires", blurb: "Fire on the landscape, and the money spent fighting it.", match: ["fires", "wildfire", "fire prevention"] },
  { name: "Wildlife", slug: "wildlife", blurb: "Species, habitat and the protections around them.", match: ["wildlife", "endangered species", "habitat"] },
  { name: "Women's Health", slug: "womens-health", blurb: "Care specific to women, and the fights over access to it.", match: ["women's health", "maternal", "reproductive", "pregnan"] },
  { name: "Workplace Safety", slug: "workplace-safety", blurb: "Hazards on the job and who answers for them.", match: ["occupational safety", "workplace", "worker safety", "employment discrimination"] },
  { name: "Youth", slug: "youth", blurb: "Young people: juvenile justice, youth programs and school age.", match: ["youth", "juvenile", "child health"] },
  { name: "Zoning", slug: "zoning", blurb: "What may be built where, and who decides.", match: ["zoning", "land use", "building construction"] },
]

export const TAG_BY_SLUG = new Map(TAGS.map((t) => [t.slug, t]))

/** The letter a tag files under on /tags; anything not a letter files under #. */
export function tagLetter(name: string) {
  const first = name.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : "#"
}

/** The source terms a tag gathers, out of the terms a jurisdiction files under. */
export function termsFor(tag: Tag, terms: string[]) {
  const tests = tag.match.map((m) => new RegExp(m, "i"))
  return terms.filter((name) => tests.some((re) => re.test(name)))
}
