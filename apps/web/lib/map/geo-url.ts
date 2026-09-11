// Where the map's GeoJSON lives (2026-09-11): a public S3 bucket, not the
// app's public folder. The 211 files under /geo were 13 MB of every deploy,
// and Amplify caps a build's output at 220 MB (jobs 255–258). The paths in
// the generated tables still read `/geo/…`; this turns them into the bucket's
// URLs at fetch time. scripts/geo writes the files; upload them with
//   aws s3 cp apps/web/public/geo s3://govblock-geo-638175140432/ --recursive
// (geojson as application/geo+json, json as application/json).

export const GEO_BASE = process.env.NEXT_PUBLIC_GEO_BASE ?? "https://govblock-geo-638175140432.s3.amazonaws.com"

/** `/geo/al-house.geojson` → the bucket's URL for it; any other path unchanged. */
export const geoUrl = (path: string) => (path.startsWith("/geo/") ? `${GEO_BASE}/${path.slice("/geo/".length)}` : path)
