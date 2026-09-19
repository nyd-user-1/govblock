// Where the heavier static files live (2026-09-19): the public bucket the
// map's GeoJSON already uses (lib/map/geo-url.ts), not the app's public folder.
// The chamber and agency seals, the Unite captures, the Filer's two PDFs, the
// reports and the shadcn registry were 10.7 MB of every deploy, and Amplify
// refused job 287 at 234.9 MB against its 230.7 MB cap. Paths in the code still
// read `/chambers/…`; this turns them into the bucket's URLs, and next.config.ts
// redirects the old addresses for anything that asks the site for them.
//
// Upload a folder one file type at a time, so each carries its own type (the
// CLI takes .avif for binary):
//   aws s3 cp <folder> s3://govblock-geo-638175140432/public/<folder>/ --recursive \
//     --exclude "*" --include "*.avif" --content-type image/avif --cache-control "public, max-age=86400"

export const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "https://govblock-geo-638175140432.s3.amazonaws.com/public"

// /forms and /reports are pages too; only their files moved.
const MOVED = /^\/(?:chambers|seals|unite|r)\/|^\/(?:forms|reports)\/[^/]+\.(?:pdf|html)(?:#|$)/

/** `/chambers/ny.avif` → the bucket's URL for it; any other path unchanged. */
export const assetUrl = (path: string) => (MOVED.test(path) ? `${ASSET_BASE}${path}` : path)
