// Named entries out of a remote ZIP, over HTTP range requests.
//
// California publishes its codes inside pubinfo_2025.zip, which is 1.28 GB
// because it also holds every bill, every vote and every lobbying filing of
// the session. The three tables that are the law weigh 12 MB. A ZIP's central
// directory is at the end of the file and says where every entry starts, so
// the tables can be read without pulling the other 1.27 GB — faster here and
// a great deal cheaper for them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { inflateRawSync } from "node:zlib"
import { join } from "node:path"

import { UA, cacheDir } from "./fetch.mjs"

const range = async (url, from, to) => {
  const response = await fetch(url, { headers: { "user-agent": UA, range: `bytes=${from}-${to}` } })
  if (!response.ok && response.status !== 206) throw new Error(`${response.status} range ${from}-${to} of ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

/** Every entry in the archive: name, where it starts, how big it is, how it is packed. */
export async function directory(url) {
  const head = await fetch(url, { method: "HEAD", headers: { "user-agent": UA } })
  const size = Number(head.headers.get("content-length"))
  if (!size) throw new Error(`no content-length for ${url} — the server will not say how big it is`)
  const tail = await range(url, Math.max(0, size - 70000), size - 1)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--)
    if (tail.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  if (eocd < 0) throw new Error(`no end-of-central-directory in the last 70 KB of ${url}`)
  let cdSize = tail.readUInt32LE(eocd + 12)
  let cdOffset = tail.readUInt32LE(eocd + 16)
  // Over 4 GB, or over 65,535 entries, the real numbers are in the ZIP64 record.
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    for (let i = eocd - 20; i >= 0; i--)
      if (tail.readUInt32LE(i) === 0x07064b50) {
        const at = Number(tail.readBigUInt64LE(i + 8))
        const record = await range(url, at, at + 56)
        cdSize = Number(record.readBigUInt64LE(40))
        cdOffset = Number(record.readBigUInt64LE(48))
        break
      }
  }
  const cd = await range(url, cdOffset, cdOffset + cdSize - 1)
  const entries = []
  let p = 0
  while (p < cd.length && cd.readUInt32LE(p) === 0x02014b50) {
    const nameLength = cd.readUInt16LE(p + 28)
    const extraLength = cd.readUInt16LE(p + 30)
    const commentLength = cd.readUInt16LE(p + 32)
    entries.push({
      name: cd.toString("utf8", p + 46, p + 46 + nameLength),
      method: cd.readUInt16LE(p + 10),
      compressed: cd.readUInt32LE(p + 20),
      size: cd.readUInt32LE(p + 24),
      offset: cd.readUInt32LE(p + 42),
    })
    p += 46 + nameLength + extraLength + commentLength
  }
  return { size, entries }
}

/** One entry's bytes, inflated, cached on disk under its archive and name. */
export async function entry(url, record, cacheKey) {
  const file = join(cacheDir, "zip", cacheKey, record.name)
  if (existsSync(file)) return readFileSync(file)
  // The local header repeats the name and carries its own extra field, whose
  // length is not the central directory's, so it has to be read to know where
  // the data starts.
  const header = await range(url, record.offset, record.offset + 29)
  const nameLength = header.readUInt16LE(26)
  const extraLength = header.readUInt16LE(28)
  const from = record.offset + 30 + nameLength + extraLength
  const packed = await range(url, from, from + record.compressed - 1)
  const bytes = record.method === 0 ? packed : inflateRawSync(packed)
  mkdirSync(join(cacheDir, "zip", cacheKey), { recursive: true })
  writeFileSync(file, bytes)
  return bytes
}

/** Every entry whose name matches, inflated. */
export async function entries(url, match, cacheKey) {
  const { entries: all } = await directory(url)
  const wanted = all.filter((e) => match(e.name))
  const out = new Map()
  for (const record of wanted) out.set(record.name, await entry(url, record, cacheKey))
  return out
}

// Apache answers a multi-range request with the whole resource — here, 1.28 GB
// — rather than an error whenever it dislikes the ranges: more than `MaxRanges`
// (200) of them, more than `MaxRangeOverlaps` (20) that overlap, or more than
// `MaxRangeReversals` (20) that run backwards. So the ranges below are sorted,
// merged and kept well under the count, and the status is checked before the
// body is read rather than after.
const RANGES_PER_REQUEST = 100

function splitMultipart(body, boundary) {
  const parts = []
  const marker = Buffer.from(`--${boundary}`)
  let at = body.indexOf(marker)
  while (at >= 0) {
    const headEnd = body.indexOf("\r\n\r\n", at)
    if (headEnd < 0) break
    const head = body.toString("latin1", at, headEnd)
    const next = body.indexOf(marker, headEnd)
    const end = next < 0 ? body.length : next - 2
    const where = /content-range:\s*bytes\s+(\d+)-(\d+)/i.exec(head)
    if (where) parts.push({ from: Number(where[1]), bytes: body.subarray(headEnd + 4, end) })
    if (next < 0) break
    at = next
  }
  return parts
}

/**
 * Many small entries at once, asked for in one request each time rather than
 * one request each. California's 162,432 section texts are each their own
 * entry inside the archive and scattered through 1.24 GB of bills, so this
 * pulls the 89 MB that is law and leaves the rest where it is.
 */
export async function manyEntries(url, records, cacheKey, onProgress) {
  const dir = join(cacheDir, "zip", cacheKey)
  mkdirSync(dir, { recursive: true })
  const out = new Map()
  const missing = []
  for (const record of records) {
    const file = join(dir, record.name)
    if (existsSync(file)) out.set(record.name, readFileSync(file))
    else missing.push(record)
  }
  // The local header's extra field can differ in length from the central
  // directory's, so a little slack is read ahead of every entry and the real
  // start worked out from the header that comes back.
  const SLACK = 200
  // Ascending, so no range runs backwards, and merged, so none overlaps.
  missing.sort((a, b) => a.offset - b.offset)
  const wanted = missing.map((r) => ({ from: r.offset, to: r.offset + SLACK + r.compressed - 1 }))
  const merged = []
  for (const span of wanted) {
    const last = merged[merged.length - 1]
    if (last && span.from <= last.to + 1) last.to = Math.max(last.to, span.to)
    else merged.push({ ...span })
  }

  let done = 0
  let at = 0
  for (let i = 0; i < merged.length; i += RANGES_PER_REQUEST) {
    const batch = merged.slice(i, i + RANGES_PER_REQUEST)
    const spec = batch.map((r) => `${r.from}-${r.to}`).join(", ")
    const response = await fetch(url, { headers: { "user-agent": UA, range: `bytes=${spec}` } })
    if (response.status !== 206) {
      // Reading the body here would pull the whole archive. Say so instead.
      response.body?.cancel?.()
      throw new Error(`${response.status} for a ${batch.length}-range request — the server would not split it`)
    }
    const type = response.headers.get("content-type") ?? ""
    const body = Buffer.from(await response.arrayBuffer())
    const parts = /boundary=/.test(type)
      ? splitMultipart(body, /boundary="?([^";]+)"?/.exec(type)[1])
      : [{ from: batch[0].from, bytes: body }]
    parts.sort((a, b) => a.from - b.from)
    const covering = (offset) => {
      let lo = 0
      let hi = parts.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const part = parts[mid]
        if (offset < part.from) hi = mid - 1
        else if (offset >= part.from + part.bytes.length) lo = mid + 1
        else return part
      }
      return null
    }
    // Every record whose bytes are inside the spans just fetched.
    const last = batch[batch.length - 1].to
    while (at < missing.length && missing[at].offset <= last) {
      const record = missing[at]
      const part = covering(record.offset)
      if (!part) throw new Error(`the server did not return the range for ${record.name}`)
      const chunk = part.bytes.subarray(record.offset - part.from)
      const nameLength = chunk.readUInt16LE(26)
      const extraLength = chunk.readUInt16LE(28)
      const from = 30 + nameLength + extraLength
      const packed = chunk.subarray(from, from + record.compressed)
      const bytes = record.method === 0 ? packed : inflateRawSync(packed)
      writeFileSync(join(dir, record.name), bytes)
      out.set(record.name, bytes)
      at += 1
      done += 1
    }
    onProgress?.(done, missing.length)
  }
  return out
}
