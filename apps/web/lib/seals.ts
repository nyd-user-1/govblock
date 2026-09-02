// The seal a nominating organization wears in a record item's avatar slot.
//
// Harvested from Wikimedia Commons on 2026-09-02 by listing the distinct
// `organization` values in `congress_nominations` and resolving each by hand
// against a named Commons file — a search-only pass put the National Guard's
// seal on the Army, Alabama's on the Department of Transportation and
// Mississippi's judiciary on the federal one, so every entry below names the
// exact file it came from. `public/seals/SOURCES.md` carries the file page and
// licence for each; every one is public domain or CC0.
//
// The files are 144 px renderings, not the originals: an avatar is 36 CSS px
// and the Department of Veterans Affairs' seal is a 2 MB SVG.
//
// Six organizations have no seal on Commons under a licence we can use. They
// fall back to the Senate seal, which is honest — the Senate is the body the
// nomination is before, and it is what this page can actually say.

export type SealShape = "circle" | "rect"

export const AGENCY_SEALS: Record<string, { file: string; shape: SealShape }> = {
  "African Development Foundation": { file: "/seals/african-development-foundation.png", shape: "circle" },
  "Air Force": { file: "/seals/air-force.png", shape: "circle" },
  "Amtrak Board of Directors": { file: "/seals/amtrak-board-of-directors.png", shape: "rect" },
  "Army": { file: "/seals/army.png", shape: "circle" },
  "Asian Development Bank": { file: "/seals/asian-development-bank.png", shape: "circle" },
  "Bureau of Consumer Financial Protection": { file: "/seals/bureau-of-consumer-financial-protection.png", shape: "circle" },
  "Central Intelligence Agency": { file: "/seals/central-intelligence-agency.png", shape: "circle" },
  "Coast Guard": { file: "/seals/coast-guard.png", shape: "circle" },
  "Commodity Futures Trading Commission": { file: "/seals/commodity-futures-trading-commission.png", shape: "circle" },
  "Congressional Research Service": { file: "/seals/congressional-research-service.png", shape: "rect" },
  "Consumer Product Safety Commission": { file: "/seals/consumer-product-safety-commission.png", shape: "circle" },
  "Department of Agriculture": { file: "/seals/department-of-agriculture.png", shape: "circle" },
  "Department of Commerce": { file: "/seals/department-of-commerce.png", shape: "circle" },
  "Department of Defense": { file: "/seals/department-of-defense.png", shape: "circle" },
  "Department of Education": { file: "/seals/department-of-education.png", shape: "circle" },
  "Department of Energy": { file: "/seals/department-of-energy.png", shape: "circle" },
  "Department of Health and Human Services": { file: "/seals/department-of-health-and-human-services.png", shape: "circle" },
  "Department of Homeland Security": { file: "/seals/department-of-homeland-security.png", shape: "circle" },
  "Department of Housing and Urban Development": { file: "/seals/department-of-housing-and-urban-development.png", shape: "circle" },
  "Department of Justice": { file: "/seals/department-of-justice.png", shape: "circle" },
  "Department of Labor": { file: "/seals/department-of-labor.png", shape: "circle" },
  "Department of State": { file: "/seals/department-of-state.png", shape: "circle" },
  "Department of Transportation": { file: "/seals/department-of-transportation.png", shape: "circle" },
  "Department of Veterans Affairs": { file: "/seals/department-of-veterans-affairs.png", shape: "circle" },
  "Department of the Interior": { file: "/seals/department-of-the-interior.png", shape: "circle" },
  "Department of the Treasury": { file: "/seals/department-of-the-treasury.png", shape: "circle" },
  "Environmental Protection Agency": { file: "/seals/environmental-protection-agency.png", shape: "circle" },
  "Equal Employment Opportunity Commission": { file: "/seals/equal-employment-opportunity-commission.png", shape: "circle" },
  "Executive Office of the President": { file: "/seals/executive-office-of-the-president.png", shape: "circle" },
  "Export-Import Bank of the United States": { file: "/seals/export-import-bank-of-the-united-states.png", shape: "circle" },
  "Farm Credit Administration": { file: "/seals/farm-credit-administration.png", shape: "circle" },
  "Federal Communications Commission": { file: "/seals/federal-communications-commission.png", shape: "circle" },
  "Federal Deposit Insurance Corporation": { file: "/seals/federal-deposit-insurance-corporation.png", shape: "circle" },
  "Federal Election Commission": { file: "/seals/federal-election-commission.png", shape: "circle" },
  "Federal Energy Regulatory Commission": { file: "/seals/federal-energy-regulatory-commission.png", shape: "circle" },
  "Federal Housing Finance Agency": { file: "/seals/federal-housing-finance-agency.png", shape: "circle" },
  "Federal Labor Relations Authority": { file: "/seals/federal-labor-relations-authority.png", shape: "rect" },
  "Federal Maritime Commission": { file: "/seals/federal-maritime-commission.png", shape: "circle" },
  "Federal Mediation and Conciliation Services": { file: "/seals/federal-mediation-and-conciliation-services.png", shape: "circle" },
  "Federal Mine Safety and Health Review Commission": { file: "/seals/federal-mine-safety-and-health-review-commission.png", shape: "circle" },
  "Federal Motor Carrier Safety Administration": { file: "/seals/federal-motor-carrier-safety-administration.png", shape: "rect" },
  "Federal Reserve System": { file: "/seals/federal-reserve-system.png", shape: "circle" },
  "Federal Trade Commission": { file: "/seals/federal-trade-commission.png", shape: "circle" },
  "General Services Administration": { file: "/seals/general-services-administration.png", shape: "circle" },
  "Inter-American Foundation": { file: "/seals/inter-american-foundation.png", shape: "circle" },
  "International Monetary Fund": { file: "/seals/international-monetary-fund.png", shape: "circle" },
  "Marine Corps": { file: "/seals/marine-corps.png", shape: "circle" },
  "Merit Systems Protection Board": { file: "/seals/merit-systems-protection-board.png", shape: "circle" },
  "Metropolitan Washington Airports Authority": { file: "/seals/metropolitan-washington-airports-authority.png", shape: "rect" },
  "National Aeronautics and Space Administration": { file: "/seals/national-aeronautics-and-space-administration.png", shape: "circle" },
  "National Archives and Records Administration": { file: "/seals/national-archives-and-records-administration.png", shape: "circle" },
  "National Credit Union Administration": { file: "/seals/national-credit-union-administration.png", shape: "circle" },
  "National Endowment for the Arts": { file: "/seals/national-endowment-for-the-arts.png", shape: "rect" },
  "National Endowment for the Humanities": { file: "/seals/national-endowment-for-the-humanities.png", shape: "rect" },
  "National Indian Gaming Commission": { file: "/seals/national-indian-gaming-commission.png", shape: "circle" },
  "National Labor Relations Board": { file: "/seals/national-labor-relations-board.png", shape: "circle" },
  "National Mediation Board": { file: "/seals/national-mediation-board.png", shape: "circle" },
  "National Science Foundation": { file: "/seals/national-science-foundation.png", shape: "circle" },
  "National Transportation Safety Board": { file: "/seals/national-transportation-safety-board.png", shape: "circle" },
  "Navy": { file: "/seals/navy.png", shape: "circle" },
  "Nuclear Regulatory Commission": { file: "/seals/nuclear-regulatory-commission.png", shape: "circle" },
  "Occupational Safety and Health Review Commission": { file: "/seals/occupational-safety-and-health-review-commission.png", shape: "circle" },
  "Office of Government Ethics": { file: "/seals/office-of-government-ethics.png", shape: "circle" },
  "Office of Personnel Management": { file: "/seals/office-of-personnel-management.png", shape: "circle" },
  "Office of Special Counsel": { file: "/seals/office-of-special-counsel.png", shape: "circle" },
  "Office of Surface Mining Reclamation and Enforcement": { file: "/seals/office-of-surface-mining-reclamation-and-enforcement.png", shape: "circle" },
  "Office of the Director of National Intelligence": { file: "/seals/office-of-the-director-of-national-intelligence.png", shape: "circle" },
  "Peace Corps": { file: "/seals/peace-corps.png", shape: "circle" },
  "Pension Benefit Guaranty Corporation": { file: "/seals/pension-benefit-guaranty-corporation.png", shape: "rect" },
  "Public Health Service": { file: "/seals/public-health-service.png", shape: "circle" },
  "Securities and Exchange Commission": { file: "/seals/securities-and-exchange-commission.png", shape: "circle" },
  "Small Business Administration": { file: "/seals/small-business-administration.png", shape: "circle" },
  "Social Security Administration": { file: "/seals/social-security-administration.png", shape: "circle" },
  "Space Force": { file: "/seals/space-force.png", shape: "circle" },
  "Surface Transportation Board": { file: "/seals/surface-transportation-board.png", shape: "circle" },
  "Tennessee Valley Authority": { file: "/seals/tennessee-valley-authority.png", shape: "circle" },
  "The Judiciary": { file: "/seals/the-judiciary.png", shape: "circle" },
  "United States Agency for Global Media": { file: "/seals/united-states-agency-for-global-media.png", shape: "rect" },
  "United States International Trade Commission": { file: "/seals/united-states-international-trade-commission.png", shape: "circle" },
  "United States Sentencing Commission": { file: "/seals/united-states-sentencing-commission.png", shape: "circle" },
  "United States Tax Court": { file: "/seals/united-states-tax-court.png", shape: "circle" },
}

/** The research service's own logo, for the CRS reports list. */
export const CRS_SEAL = AGENCY_SEALS["Congressional Research Service"]

/**
 * The seal for a nominating organization, or `null` when Commons has none we
 * can use — the caller falls back to the Senate seal and the list says so by
 * showing the chamber rather than pretending to an emblem.
 */
export function agencySeal(organization?: string | null) {
  if (!organization) return null
  return AGENCY_SEALS[organization] ?? null
}
