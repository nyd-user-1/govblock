import sidebar07 from "@/lib/data/blocks/sidebar-07.json"

// A block on file. livingston-v3 computes this per request from its registry
// (lib/registry.ts: fixImport, targets, then shiki); govblock generates it once
// into lib/data/blocks, so the page is a lookup. Same shape either way.
export type BlockFile = { path: string; type: string; target: string; content: string; highlightedContent: string }
export type Block = {
  name: string
  type: string
  description?: string
  categories?: string[]
  registryDependencies?: string[]
  meta?: { iframeHeight?: string; containerClassName?: string; mobile?: string }
  files: BlockFile[]
}

const blocks: Record<string, Block> = { "sidebar-07": sidebar07 }

export const getBlock = (name: string): Block | null => blocks[name] ?? null

export const getBlockNames = (categories: string[] = []) =>
  Object.values(blocks)
    .filter((b) => !categories.length || b.categories?.some((c) => categories.includes(c)))
    .map((b) => b.name)

// v3 lib/categories.ts — the template's taxonomy; "Browse all blocks" points at it.
export const registryCategories = [
  { name: "Sidebar", slug: "sidebar", hidden: false },
  { name: "Dashboard", slug: "dashboard", hidden: true },
  { name: "Authentication", slug: "authentication", hidden: true },
  { name: "Login", slug: "login", hidden: false },
  { name: "Signup", slug: "signup", hidden: false },
]

export type FileTree = { name: string; path?: string; children?: FileTree[] }

// v3 lib/registry.ts createFileTreeForRegistryItemFiles, verbatim.
export function createFileTreeForRegistryItemFiles(files: Array<{ path: string; target?: string }>) {
  const root: FileTree[] = []

  for (const file of files) {
    const path = file.target ?? file.path
    const parts = path.split("/")
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const existingNode = currentLevel.find((node) => node.name === part)

      if (existingNode) {
        if (isFile) {
          existingNode.path = path
        } else {
          currentLevel = existingNode.children!
        }
      } else {
        const newNode: FileTree = isFile ? { name: part, path } : { name: part, children: [] }
        currentLevel.push(newNode)
        if (!isFile) {
          currentLevel = newNode.children!
        }
      }
    }
  }

  return root
}
