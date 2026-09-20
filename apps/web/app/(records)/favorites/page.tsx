import { DocsPage } from "@/components/docs-page"
import { FavoritesList } from "@/components/favorites-list"

// /favorites (Brendan, 2026-09-20): every starred item in one place, in
// /amendments's layout. Each page's right rail shows three of its own kind;
// the whole list is here, and in the left rail between Account home and
// Recents. Favorites are kept in the browser, so the page itself is static.
const title = "Favorites"
const description = "Keep the bills, members and committees you come back to, and find them all in one place."

export const metadata = { title, description }

export default function FavoritesPage() {
  return (
    <DocsPage title={title} description={description} slug="/favorites" previous={{ name: "Changelog", url: "/changelog" }} next={{ name: "Bills", url: "/bills" }}>
      <FavoritesList />
    </DocsPage>
  )
}
