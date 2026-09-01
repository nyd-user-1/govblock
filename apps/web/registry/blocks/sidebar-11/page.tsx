import { DocumentsTree } from "@/components/policy/documents-tree"

// Documents — the bill text versions we hold.
//
// The page is a thin mount so both registries' copies of this block render
// exactly the same surface; the implementation lives in components/policy.
export default function Page() {
  return <DocumentsTree />
}
