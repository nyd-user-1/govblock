import { BookmarksList } from "@/components/bookmarks-list"
import { DocsPage } from "@/components/docs-page"

// /bookmarks (Brendan, 2026-09-20): every bookmarked page in one place, in
// /amendments's layout; in the left rail before Favorites. A favorite keeps a
// record, a bookmark keeps a page. Kept in the browser, so the page is static.
const title = "Bookmarks"
const description = "Keep the pages you work from, just as you left them, and come back in one click."

export const metadata = { title, description }

export default function BookmarksPage() {
  return (
    <DocsPage title={title} description={description} slug="/bookmarks" previous={{ name: "Account home", url: "/home" }} next={{ name: "Changelog", url: "/changelog" }}>
      <BookmarksList />
    </DocsPage>
  )
}
