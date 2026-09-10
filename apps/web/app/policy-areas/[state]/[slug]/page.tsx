import { SubjectPage, subjectMetadata, type Props } from "@/components/subjects/subject-page"

// A Congressional Research Service policy area at /policy-areas/us/health, a
// legislative subject at /legislative-subjects/us/marine-biology. They are
// different things — a bill carries exactly one policy area and any number of
// legislative subjects — so each kind has its own path, and both are drawn by
// the one page in components/subjects/subject-page.tsx.

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

export const generateMetadata = subjectMetadata

export default SubjectPage

export type { Props }
