import { fmtDate, fmtNumber } from "@/lib/format"
import type { Bill } from "@/lib/policy/types"

// The bill as typeset prose: the summary and the changelog rendered as HTML
// inside the `.typeset` container, so the type controls style them like any
// other document.

export function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function district(value: string | null | undefined) {
  return (value ?? "").replace(/^[A-Z]+-0*/, "")
}

function partyLabel(party: string | null | undefined) {
  return party === "D" ? "Democrat" : party === "R" ? "Republican" : party || ""
}

export function summaryHtml(bill: Bill) {
  const primes = bill.sponsors.filter((s) => s.type === 1)
  const cos = bill.sponsors.filter((s) => s.type !== 1)
  const introduced = bill.history[0]
  const last = bill.history.at(-1)
  const referrals = bill.referrals.map((r) => r.name).filter(Boolean)
  const parts: string[] = []

  parts.push(`<h1>${esc(bill.bill_number)}</h1>`)
  parts.push(
    `<p><em>${esc(bill.session_title ?? bill.session_id)}${bill.body ? ` · ${esc(bill.body)}` : ""}${bill.status_desc ? ` · ${esc(bill.status_desc)}` : ""}${bill.committee ? ` · ${esc(bill.committee)} Committee` : ""}</em></p>`
  )
  parts.push(`<p><strong>${esc(bill.title)}</strong></p>`)

  if (bill.description && bill.description.trim() !== bill.title.trim()) {
    parts.push(`<h2>Summary</h2><p>${esc(bill.description)}</p>`)
  }

  parts.push(`<h2>Sponsors</h2>`)
  if (primes.length || cos.length) {
    parts.push("<ul>")
    for (const s of primes) {
      parts.push(
        `<li><strong>${esc(s.name)}</strong> (${esc(s.party)}–${esc(district(s.district))}) — ${esc(s.chamber)}, prime sponsor</li>`
      )
    }
    for (const s of cos.slice(0, 12)) {
      parts.push(`<li>${esc(s.name)} (${esc(s.party)}–${esc(district(s.district))})</li>`)
    }
    if (cos.length > 12) {
      parts.push(`<li>… and ${fmtNumber(cos.length - 12)} more cosponsors</li>`)
    }
    parts.push("</ul>")
  } else {
    parts.push("<p>No sponsors on file.</p>")
  }

  parts.push(`<h2>Status</h2>`)
  parts.push("<table><tbody>")
  if (introduced) parts.push(`<tr><th>Introduced</th><td>${esc(fmtDate(introduced.date))}</td></tr>`)
  if (last) parts.push(`<tr><th>Last action</th><td>${esc(fmtDate(last.date))} — ${esc(last.action)}</td></tr>`)
  if (bill.status_desc) parts.push(`<tr><th>Status</th><td>${esc(bill.status_desc)}</td></tr>`)
  if (referrals.length) parts.push(`<tr><th>Referred to</th><td>${esc([...new Set(referrals)].join(", "))}</td></tr>`)
  if (bill.rollCalls.length) {
    const lastVote = bill.rollCalls.at(-1)!
    parts.push(
      `<tr><th>Last vote</th><td>${esc(fmtDate(lastVote.date))} — ${fmtNumber(lastVote.yea)} yea, ${fmtNumber(lastVote.nay)} nay (${esc(lastVote.chamber)})</td></tr>`
    )
  }
  if (bill.texts.length) {
    const text = bill.texts[0]!
    parts.push(
      `<tr><th>Text</th><td>${bill.texts.length} version${bill.texts.length === 1 ? "" : "s"} · latest ${esc(text.version ?? "")} · ${fmtNumber(text.chars)} characters</td></tr>`
    )
  }
  parts.push("</tbody></table>")

  if (bill.progress.length) {
    parts.push(`<h2>Progress</h2><ol>`)
    for (const p of bill.progress) {
      parts.push(`<li>${esc(p.event)} <em>(${esc(fmtDate(p.date))})</em></li>`)
    }
    parts.push("</ol>")
  }

  if (bill.subjects.length) {
    parts.push(`<h2>Subjects</h2><p>${bill.subjects.map(esc).join(" · ")}</p>`)
  }

  if (bill.sameAs.length) {
    parts.push(`<h2>Related</h2><ul>`)
    for (const s of bill.sameAs) {
      parts.push(`<li>${esc(s.sast_bill_number)} <em>(${esc(s.sast_type)})</em></li>`)
    }
    parts.push("</ul>")
  }

  if (bill.hearings.length) {
    parts.push(`<h2>Hearings</h2><ul>`)
    for (const h of bill.hearings.slice(0, 8)) {
      parts.push(`<li>${esc(fmtDate(h.date))} — ${esc(h.description)}${h.location ? `, ${esc(h.location)}` : ""}</li>`)
    }
    parts.push("</ul>")
  }

  const links: string[] = []
  if (bill.state_link) links.push(`<a href="${esc(bill.state_link)}">The legislature's page</a>`)
  if (bill.url) links.push(`<a href="${esc(bill.url)}">LegiScan</a>`)
  if (links.length) parts.push(`<h2>Links</h2><p>${links.join(" · ")}</p>`)

  return parts.join("\n")
}

export function changelogHtml(bill: Bill) {
  const parts: string[] = []
  parts.push(`<h1>${esc(bill.bill_number)} — Changelog</h1>`)
  parts.push(`<p><em>${esc(bill.title)}</em></p>`)

  type Entry = { date: string; kind: "action" | "vote" | "hearing"; html: string }
  const entries: Entry[] = []
  for (const h of bill.history) {
    entries.push({
      date: h.date,
      kind: "action",
      html: `<li>${h.chamber ? `<strong>${esc(h.chamber)}</strong> — ` : ""}${esc(h.action)}</li>`,
    })
  }
  for (const r of bill.rollCalls) {
    entries.push({
      date: r.date,
      kind: "vote",
      html: `<li><strong>Roll call</strong> — ${esc(r.description)}: ${fmtNumber(r.yea)} yea, ${fmtNumber(r.nay)} nay${r.nv ? `, ${fmtNumber(r.nv)} not voting` : ""}${r.absent ? `, ${fmtNumber(r.absent)} absent` : ""}${r.chamber ? ` (${esc(r.chamber)})` : ""}</li>`,
    })
  }
  for (const h of bill.hearings) {
    entries.push({
      date: h.date,
      kind: "hearing",
      html: `<li><strong>Hearing</strong> — ${esc(h.description)}${h.time && h.time !== "00:00" ? ` at ${esc(h.time)}` : ""}${h.location ? `, ${esc(h.location)}` : ""}</li>`,
    })
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  if (!entries.length) {
    parts.push("<p>No actions recorded yet.</p>")
    return parts.join("\n")
  }

  let current = ""
  for (const entry of entries) {
    if (entry.date !== current) {
      if (current) parts.push("</ul>")
      current = entry.date
      parts.push(`<h2>${esc(fmtDate(entry.date))}</h2><ul>`)
    }
    parts.push(entry.html)
  }
  parts.push("</ul>")
  return parts.join("\n")
}

// What the assistant is told about the bill on screen.
export function billSystemPrompt(bill: Bill | null, state: string) {
  if (!bill) {
    return `You are Livingston, a legislative assistant for the ${state} legislature. Answer plainly, cite what you know, and say when you don't.`
  }
  const primes = bill.sponsors.filter((s) => s.type === 1).map((s) => `${s.name} (${s.party}-${district(s.district)})`)
  const last = bill.history.at(-1)
  return [
    `You are Livingston, a legislative assistant. The user is looking at ${bill.bill_number} in the ${bill.state} legislature (${bill.session_title ?? bill.session_id}).`,
    `Title: ${bill.title}`,
    bill.description && bill.description !== bill.title ? `Summary: ${bill.description}` : "",
    `Status: ${bill.status_desc ?? "unknown"}${bill.committee ? `, in the ${bill.committee} Committee` : ""}.`,
    primes.length ? `Prime sponsor(s): ${primes.join(", ")}${bill.sponsors.length > primes.length ? `; ${bill.sponsors.length - primes.length} cosponsors` : ""}.` : "",
    last ? `Last action ${last.date}: ${last.action}` : "",
    bill.rollCalls.length ? `Roll calls: ${bill.rollCalls.map((r) => `${r.date} ${r.chamber} ${r.yea}-${r.nay}`).join("; ")}.` : "",
    bill.sameAs.length ? `Related bills: ${bill.sameAs.map((s) => `${s.sast_bill_number} (${s.sast_type})`).join(", ")}.` : "",
    `Answer about this bill unless asked otherwise. Be concrete, short, and honest about what the record does not show. ${partyLabel(bill.sponsor_party) ? `The lead sponsor is a ${partyLabel(bill.sponsor_party)}.` : ""}`,
  ]
    .filter(Boolean)
    .join("\n")
}
