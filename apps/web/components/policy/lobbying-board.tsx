import { DocsPage, type DocsLink } from "@/components/docs-page"
import { LobbyingList, type LobbyingKind } from "@/components/policy/lobbying-list"

// The three lobbying boards — registrants, clients, lobbyists — on the docs
// shell (components/docs-page.tsx). One file rather than three pages: the
// boards differ only by which list they hold and where the arrows point. Until
// 2026-09-20 it carried a copy of the shell's markup.

export type BoardLink = DocsLink

export function LobbyingBoard({ title, description, slug, kind, previous, next }: { title: string; description: string; slug: string; kind: LobbyingKind; previous: BoardLink; next: BoardLink }) {
  return (
    <DocsPage title={title} description={description} slug={slug} previous={previous} next={next}>
      <LobbyingList kind={kind} />
    </DocsPage>
  )
}
