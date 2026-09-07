import "server-only"

import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch"

import { n, one, q } from "@/lib/policy/db"

// The site's traffic, as the Admin experience's Traffic page reads it
// (Brendan, 2026-09-06: "tie it to one of the admin dashboard views and pull
// in all analytics data now"). Two sources, both kept in Aurora by
// scripts/cloudflare/pull.mjs so history outlives the vendors' windows:
//
//   Cloudflare: the zone nysgpt.com — daily totals since 2026-07-01, hourly
//   for three days, per host/path/country/device/browser/status for eight
//   days. policy.nysgpt.com is DNS-only and never passes through Cloudflare,
//   so these rows are the proxied hosts (pay, and whatever was proxied before).
//
//   Amplify: policy.nysgpt.com's own requests, errors, bytes and latency from
//   CloudWatch, daily, since the app moved there on 2026-08-31.
//
// `refreshIfStale` keeps the Cloudflare side live from the page itself: when
// the last pull is older than six hours and the token is in the environment,
// it re-reads the last three days before answering, so an open dashboard
// stays current without a box.

export type ZoneDay = { date: string; requests: number; cached_requests: number; bytes: number; cached_bytes: number; threats: number; page_views: number; uniques: number; response_status_map: { edgeResponseStatus: number; requests: number }[] | null; country_map: { clientCountryName: string; requests: number; threats: number; bytes: number }[] | null; browser_map: { uaBrowserFamily: string; pageViews: number }[] | null }
export type ZoneHour = { datetime: string; requests: number; cached_requests: number; bytes: number; threats: number; page_views: number; uniques: number }
export type Dim = { date: string; host: string; value: string; requests: number; visits: number; bytes: number }
export type AmplifyDay = { date: string; app_id: string; app_name: string; requests: number; errors_4xx: number; errors_5xx: number; bytes_downloaded: number; latency_ms: number | null }

const ZONE = process.env.CLOUDFLARE_ZONE_ID || "cdfeb4c8e4604d64f2d7bb884aadfc6f"

async function gql<T>(query: string): Promise<T> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set")
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }), cache: "no-store" })
  const body = (await res.json()) as { data?: { viewer: { zones: T[] } }; errors?: { message: string }[] }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "))
  return body.data!.viewer.zones[0]
}
const day = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (k: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - k); return d }

/** Re-read the last three days from Cloudflare when the stored copy is stale. Quiet on failure: the stored rows still answer. */
export async function refreshIfStale(hours = 6) {
  if (!process.env.CLOUDFLARE_API_TOKEN) return { refreshed: false, reason: "no token" }
  const state = await one<{ last_run: string | null }>(`select last_run::text from cloudflare_pull_state where key = 'zone'`).catch(() => null)
  const last = state?.last_run ? new Date(state.last_run.replace(" ", "T")) : null
  if (last && Date.now() - last.getTime() < hours * 36e5) return { refreshed: false, reason: "fresh" }
  try {
    type DailyRow = { dimensions: { date: string }; sum: Record<string, unknown> & { requests: number; cachedRequests: number; bytes: number; cachedBytes: number; threats: number; pageViews: number; encryptedRequests: number }; uniq: { uniques: number } }
    const daily = await gql<{ httpRequests1dGroups: DailyRow[] }>(`{ viewer { zones(filter:{zoneTag:"${ZONE}"}) { httpRequests1dGroups(limit:10, orderBy:[date_ASC], filter:{date_geq:"${day(daysAgo(3))}", date_leq:"${day(new Date())}"}) {
      dimensions { date }
      sum { requests cachedRequests bytes cachedBytes threats pageViews encryptedRequests
            countryMap { clientCountryName requests threats bytes } responseStatusMap { edgeResponseStatus requests }
            browserMap { uaBrowserFamily pageViews } contentTypeMap { edgeResponseContentTypeName requests bytes }
            clientSSLMap { clientSSLProtocol requests } clientHTTPVersionMap { clientHTTPProtocol requests }
            ipClassMap { ipType requests } threatPathingMap { threatPathingName requests } }
      uniq { uniques } } } } }`)
    for (const r of daily.httpRequests1dGroups) {
      await q(
        `insert into cloudflare_zone_daily (date, requests, cached_requests, bytes, cached_bytes, threats, page_views, encrypted_requests, uniques,
           country_map, response_status_map, browser_map, content_type_map, client_ssl_map, client_http_version_map, ip_class_map, threat_pathing_map, fetched_at)
         values ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, now())
         on conflict (date) do update set requests = excluded.requests, cached_requests = excluded.cached_requests, bytes = excluded.bytes, cached_bytes = excluded.cached_bytes,
           threats = excluded.threats, page_views = excluded.page_views, encrypted_requests = excluded.encrypted_requests, uniques = excluded.uniques,
           country_map = excluded.country_map, response_status_map = excluded.response_status_map, browser_map = excluded.browser_map, content_type_map = excluded.content_type_map,
           client_ssl_map = excluded.client_ssl_map, client_http_version_map = excluded.client_http_version_map, ip_class_map = excluded.ip_class_map, threat_pathing_map = excluded.threat_pathing_map, fetched_at = now()`,
        [r.dimensions.date, r.sum.requests, r.sum.cachedRequests, r.sum.bytes, r.sum.cachedBytes, r.sum.threats, r.sum.pageViews, r.sum.encryptedRequests, r.uniq.uniques,
          JSON.stringify(r.sum.countryMap), JSON.stringify(r.sum.responseStatusMap), JSON.stringify(r.sum.browserMap), JSON.stringify(r.sum.contentTypeMap),
          JSON.stringify(r.sum.clientSSLMap), JSON.stringify(r.sum.clientHTTPVersionMap), JSON.stringify(r.sum.ipClassMap), JSON.stringify(r.sum.threatPathingMap)],
      )
    }
    type HourRow = { dimensions: { datetime: string }; sum: { requests: number; cachedRequests: number; bytes: number; cachedBytes: number; threats: number; pageViews: number; encryptedRequests: number }; uniq: { uniques: number } }
    const hourly = await gql<{ httpRequests1hGroups: HourRow[] }>(`{ viewer { zones(filter:{zoneTag:"${ZONE}"}) { httpRequests1hGroups(limit:200, orderBy:[datetime_ASC], filter:{datetime_geq:"${daysAgo(3).toISOString()}", datetime_leq:"${new Date().toISOString()}"}) {
      dimensions { datetime } sum { requests cachedRequests bytes cachedBytes threats pageViews encryptedRequests } uniq { uniques } } } } }`)
    for (const r of hourly.httpRequests1hGroups) {
      await q(
        `insert into cloudflare_zone_hourly (datetime, requests, cached_requests, bytes, cached_bytes, threats, page_views, encrypted_requests, uniques, fetched_at)
         values ($1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9, now())
         on conflict (datetime) do update set requests = excluded.requests, cached_requests = excluded.cached_requests, bytes = excluded.bytes, cached_bytes = excluded.cached_bytes,
           threats = excluded.threats, page_views = excluded.page_views, encrypted_requests = excluded.encrypted_requests, uniques = excluded.uniques, fetched_at = now()`,
        [r.dimensions.datetime, r.sum.requests, r.sum.cachedRequests, r.sum.bytes, r.sum.cachedBytes, r.sum.threats, r.sum.pageViews, r.sum.encryptedRequests, r.uniq.uniques],
      )
    }
    // Today and yesterday by dimension; the script fills the rest of the window nightly.
    type AdaptiveRow = { count: number; dimensions: Record<string, string>; sum: { visits: number; edgeResponseBytes: number }; avg: { sampleInterval: number } }
    const DIMS: [string, string, number][] = [["host", "clientRequestHTTPHost", 50], ["path", "clientRequestPath", 300], ["country", "clientCountryName", 60], ["device", "clientDeviceType", 10], ["browser", "userAgentBrowser", 30], ["status", "edgeResponseStatus", 30]]
    for (const k of [1, 0]) {
      const d = day(daysAgo(k))
      let hosts: string[] = []
      for (const [name, field, limit] of DIMS) {
        for (const host of name === "host" ? [""] : ["", ...hosts]) {
          const rows = (await gql<{ httpRequestsAdaptiveGroups: AdaptiveRow[] }>(`{ viewer { zones(filter:{zoneTag:"${ZONE}"}) { httpRequestsAdaptiveGroups(limit:${limit}, orderBy:[count_DESC], filter:{date:"${d}"${host ? `, clientRequestHTTPHost:"${host}"` : ""}}) {
              count dimensions { ${field} } sum { visits edgeResponseBytes } avg { sampleInterval } } } } }`)).httpRequestsAdaptiveGroups
          if (name === "host") hosts = rows.map((r) => r.dimensions[field]).filter(Boolean).slice(0, 12)
          for (const r of rows) {
            await q(
              `insert into cloudflare_adaptive_daily (date, host, dimension, value, requests, visits, bytes, sample_interval, fetched_at)
               values ($1::date, $2, $3, $4, $5, $6, $7, $8, now())
               on conflict (date, host, dimension, value) do update set requests = excluded.requests, visits = excluded.visits, bytes = excluded.bytes, sample_interval = excluded.sample_interval, fetched_at = now()`,
              [d, host, name, String(r.dimensions[field] ?? ""), r.count, r.sum.visits, r.sum.edgeResponseBytes, Number(r.avg?.sampleInterval ?? 1)],
            )
          }
        }
      }
    }
    // Amplify's last three days, the same way the script takes them.
    try {
      const cw = new CloudWatchClient({ region: process.env.AWS_REGION || "us-east-1" })
      const start = daysAgo(3); start.setUTCHours(0, 0, 0, 0)
      for (const [appId, appName] of [["d2a69zdzqun8m7", "govblock"], ["d19scfayvy6e0b", "paulrubell"], ["d2bart0mempmp5", "solar"]]) {
        const metric = (id: string, name: string, stat: string) => ({ Id: id, MetricStat: { Metric: { Namespace: "AWS/AmplifyHosting", MetricName: name, Dimensions: [{ Name: "App", Value: appId }] }, Period: 86400, Stat: stat }, ReturnData: true })
        const out = await cw.send(new GetMetricDataCommand({ StartTime: start, EndTime: new Date(), ScanBy: "TimestampAscending", MetricDataQueries: [metric("requests", "Requests", "Sum"), metric("e4", "4xxErrors", "Sum"), metric("e5", "5xxErrors", "Sum"), metric("down", "BytesDownloaded", "Sum"), metric("up", "BytesUploaded", "Sum"), metric("lat", "Latency", "Average")] }))
        const series = Object.fromEntries((out.MetricDataResults ?? []).map((r) => [r.Id, new Map((r.Timestamps ?? []).map((t, i) => [day(new Date(t)), r.Values?.[i] ?? null]))])) as Record<string, Map<string, number | null>>
        for (const d of series.requests?.keys() ?? []) {
          await q(
            `insert into amplify_daily (date, app_id, app_name, requests, errors_4xx, errors_5xx, bytes_downloaded, bytes_uploaded, latency_ms, fetched_at)
             values ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, now())
             on conflict (date, app_id) do update set app_name = excluded.app_name, requests = excluded.requests, errors_4xx = excluded.errors_4xx, errors_5xx = excluded.errors_5xx,
               bytes_downloaded = excluded.bytes_downloaded, bytes_uploaded = excluded.bytes_uploaded, latency_ms = excluded.latency_ms, fetched_at = now()`,
            [d, appId, appName, Math.round(series.requests?.get(d) ?? 0), Math.round(series.e4?.get(d) ?? 0), Math.round(series.e5?.get(d) ?? 0), Math.round(series.down?.get(d) ?? 0), Math.round(series.up?.get(d) ?? 0), series.lat?.get(d) ?? null],
          )
        }
      }
    } catch (error) {
      console.error("amplify refresh failed", error instanceof Error ? error.message : error)
    }
    await q(`insert into cloudflare_pull_state (key, last_run, note) values ('zone', now(), 'refreshed from the page') on conflict (key) do update set last_run = now(), note = excluded.note`)
    return { refreshed: true, reason: "stale" }
  } catch (error) {
    console.error("traffic refresh failed", error instanceof Error ? error.message : error)
    return { refreshed: false, reason: "failed" }
  }
}

/** Everything the Traffic page shows, in one read. */
export async function getTraffic(days = 90) {
  const since = day(daysAgo(days))
  const [zone, hourly, dims, amplify, state] = await Promise.all([
    q<ZoneDay>(`select date::text, requests, cached_requests, bytes, cached_bytes, threats, page_views, uniques, response_status_map, country_map, browser_map
                  from cloudflare_zone_daily where date >= $1::date order by date`, [since]),
    q<ZoneHour>(`select datetime::text, requests, cached_requests, bytes, threats, page_views, uniques from cloudflare_zone_hourly where datetime >= now() - interval '3 days' order by datetime`),
    q<Dim & { dimension: string }>(`select date::text, host, dimension, value, requests, visits, bytes from cloudflare_adaptive_daily where date >= $1::date order by date`, [day(daysAgo(9))]),
    q<AmplifyDay>(`select date::text, app_id, app_name, requests, errors_4xx, errors_5xx, bytes_downloaded, latency_ms from amplify_daily where date >= $1::date order by date`, [since]),
    one<{ last_run: string | null }>(`select last_run::text from cloudflare_pull_state where key = 'zone'`),
  ])
  const num = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]) => { for (const k of keys) (row as Record<string, unknown>)[k as string] = n(row[k]); return row }
  const byDim = (name: string) => dims.filter((d) => d.dimension === name).map((d) => num(d, ["requests", "visits", "bytes"]))
  return {
    zone: zone.map((r) => num(r, ["requests", "cached_requests", "bytes", "cached_bytes", "threats", "page_views", "uniques"])),
    hourly: hourly.map((r) => num(r, ["requests", "cached_requests", "bytes", "threats", "page_views", "uniques"])),
    hosts: byDim("host"),
    paths: byDim("path"),
    countries: byDim("country"),
    devices: byDim("device"),
    browsers: byDim("browser"),
    statuses: byDim("status"),
    amplify: amplify.map((r) => num(r, ["requests", "errors_4xx", "errors_5xx", "bytes_downloaded"])),
    pulled_at: state?.last_run ?? null,
    zone_name: "nysgpt.com",
    note: "policy.nysgpt.com is DNS-only and never passes through Cloudflare; its own traffic is the Amplify series.",
  }
}
