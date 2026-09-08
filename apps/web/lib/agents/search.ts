import "server-only"

// The one thing on this record that is not on this record.
//
// The Clerk was asked (2026-09-07) who funds open-primary ballot campaigns.
// That money is not federal: it sits in fifty states' ballot-measure committees
// and in public reporting, and get_fec reads only our loaded FEC data — 991
// candidate and PAC committees keyed to members of Congress — so the agent had
// no way to reach any of it and said so.
//
// Two reads, because one is not enough. `search` returns titles, links and
// snippets to cite. `extract` reads a page the agent has decided it needs, and
// that is the half that matters here: OpenSecrets is authoritative for
// ballot-measure money and answers a plain fetch with 403, so a generic
// web_fetch fails on exactly the source the question turns on.
//
// One small interface with Tavily behind it. Brave and Exa implement the search
// half and are chosen by which key the environment holds, so a swap is a key
// change rather than a rewrite of the tool — but only Tavily extracts, and a
// provider that cannot says so rather than pretending.

export type SearchHit = { title: string; url: string; snippet: string; published?: string | null; source?: string | null }
export type SearchAnswer = { provider: string; query: string; count: number; results: SearchHit[] }
export type PageAnswer = { provider: string; url: string; chars: number; full_chars: number; truncated: boolean; text: string }

type Provider = {
  name: string
  search: (query: string, limit: number) => Promise<SearchAnswer>
  extract?: (url: string, chars: number) => Promise<PageAnswer>
}

/** Snippets are for citing, not for reading. A handful of them fits a round. */
const SNIPPET = 320
// Ten seconds, inside a thirty-second round with the model's own write after it.
const DEADLINE = 10_000

const clip = (value: unknown, max = SNIPPET) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max)

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

/* ---- Tavily: the default, and the only one that reads a page -------------- */

function tavily(key: string): Provider {
  const post = async (path: string, body: unknown) => {
    const response = await fetch(`https://api.tavily.com/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEADLINE),
    })
    if (!response.ok) {
      const detail = clip(await response.text().catch(() => ""), 200)
      throw new Error(`Tavily ${path} answered ${response.status}${detail ? `: ${detail}` : ""}`)
    }
    return response.json()
  }

  return {
    name: "tavily",
    async search(query, limit) {
      const body = (await post("search", { query, max_results: limit, include_answer: false, search_depth: "basic" })) as {
        results?: { title?: string; url?: string; content?: string; published_date?: string }[]
      }
      const results = (body.results ?? []).slice(0, limit).map((r) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        snippet: clip(r.content),
        published: r.published_date ?? null,
        source: hostOf(String(r.url ?? "")),
      }))
      return { provider: "tavily", query, count: results.length, results }
    },
    async extract(url, chars) {
      // `advanced` is what gets through a site that refuses a plain fetch, which
      // is the reason this exists; markdown keeps the tables a money page is.
      const body = (await post("extract", { urls: [url], extract_depth: "advanced", format: "markdown" })) as {
        results?: { url?: string; raw_content?: string }[]
        failed_results?: { url?: string; error?: string }[]
      }
      const hit = body.results?.[0]
      if (!hit?.raw_content) {
        const failure = body.failed_results?.[0]?.error
        throw new Error(`Could not read ${url}${failure ? `: ${clip(failure, 160)}` : ". The page returned nothing."}`)
      }
      const full = hit.raw_content.length
      const text = hit.raw_content.slice(0, chars)
      return { provider: "tavily", url: String(hit.url ?? url), chars: text.length, full_chars: full, truncated: full > text.length, text }
    },
  }
}

/* ---- the alternates: search only ----------------------------------------- */

function brave(key: string): Provider {
  return {
    name: "brave",
    async search(query, limit) {
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`, {
        headers: { accept: "application/json", "x-subscription-token": key },
        signal: AbortSignal.timeout(DEADLINE),
      })
      if (!response.ok) throw new Error(`Brave search answered ${response.status}`)
      const body = (await response.json()) as { web?: { results?: { title?: string; url?: string; description?: string; page_age?: string }[] } }
      const results = (body.web?.results ?? []).slice(0, limit).map((r) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        snippet: clip(r.description),
        published: r.page_age ?? null,
        source: hostOf(String(r.url ?? "")),
      }))
      return { provider: "brave", query, count: results.length, results }
    },
  }
}

function exa(key: string): Provider {
  return {
    name: "exa",
    async search(query, limit) {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key },
        body: JSON.stringify({ query, numResults: limit, type: "auto", contents: { text: { maxCharacters: SNIPPET * 2 } } }),
        signal: AbortSignal.timeout(DEADLINE),
      })
      if (!response.ok) throw new Error(`Exa answered ${response.status}`)
      const body = (await response.json()) as { results?: { title?: string; url?: string; text?: string; summary?: string; publishedDate?: string }[] }
      const results = (body.results ?? []).slice(0, limit).map((r) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        snippet: clip(r.summary ?? r.text),
        published: r.publishedDate ?? null,
        source: hostOf(String(r.url ?? "")),
      }))
      return { provider: "exa", query, count: results.length, results }
    },
    // Exa reads a page through /contents rather than a second product, so the
    // seam holds: the tool is the same, the key chooses the implementation.
    async extract(url, chars) {
      const response = await fetch("https://api.exa.ai/contents", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key },
        body: JSON.stringify({ urls: [url], text: { maxCharacters: chars } }),
        signal: AbortSignal.timeout(DEADLINE),
      })
      if (!response.ok) throw new Error(`Exa contents answered ${response.status}`)
      const body = (await response.json()) as { results?: { url?: string; text?: string }[] }
      const hit = body.results?.[0]
      if (!hit?.text) throw new Error(`Could not read ${url}. The page returned nothing.`)
      const text = hit.text.slice(0, chars)
      return { provider: "exa", url: String(hit.url ?? url), chars: text.length, full_chars: hit.text.length, truncated: hit.text.length > text.length, text }
    },
  }
}

const NO_KEY =
  "Web search is not configured on this deployment. Set TAVILY_API_KEY (or BRAVE_SEARCH_API_KEY, or EXA_API_KEY). Until then, answer from the record and say plainly that you could not search the web."

/** Whichever key the environment holds. Tavily first: it is the one that reads pages. */
export function searchProvider(): Provider | null {
  if (process.env.TAVILY_API_KEY) return tavily(process.env.TAVILY_API_KEY)
  if (process.env.BRAVE_SEARCH_API_KEY) return brave(process.env.BRAVE_SEARCH_API_KEY)
  if (process.env.EXA_API_KEY) return exa(process.env.EXA_API_KEY)
  return null
}

export async function webSearch(query: string, limit = 6): Promise<SearchAnswer> {
  const provider = searchProvider()
  if (!provider) throw new Error(NO_KEY)
  return provider.search(query, Math.min(Math.max(1, Math.floor(limit) || 6), 10))
}

export async function readPage(url: string, chars = 6000): Promise<PageAnswer> {
  const provider = searchProvider()
  if (!provider) throw new Error(NO_KEY)
  if (!provider.extract) throw new Error(`${provider.name} can search but cannot read a page. Cite the snippet, or set TAVILY_API_KEY.`)
  return provider.extract(url, Math.min(Math.max(500, Math.floor(chars) || 6000), 20_000))
}
