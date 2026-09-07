// The Clerk's mail runner.
//
// Mail to govblock-clerk@agentmail.to reaches AgentMail, which posts a
// message.received event here. The fetch handler verifies the signature and
// puts the message in KV. The cron handler, every two minutes, takes what is
// pending and runs the Clerk against the app's chat route one round at a time
// — the same protocol the browser speaks on /agents and in the Agentic Inbox —
// then replies on the email thread through AgentMail, with the answer as text
// and as HTML.
//
// Why not run in the webhook handler: a Worker may keep working only briefly
// after it answers a request, and a bill read can take a few minutes across
// several rounds. A cron handler may run for up to fifteen minutes. Why not
// run inside the app: Amplify cuts any request at thirty seconds, which is why
// each round is its own request and the loop lives out here.
//
// Free-plan discipline: KV is listed at most every two minutes (the free tier
// allows a thousand lists a day), and the chat route's state — which can be
// hundreds of kilobytes of bill records — is carried between rounds as the raw
// JSON text rather than parsed, so a round costs the CPU of string slicing.

export interface Env {
  MAIL: KVNamespace
  APP_ORIGIN: string
  CLERK_INBOX: string
  AGENT: string
  MAX_ROUNDS: string
  AGENTMAIL_API_KEY: string
  AGENTMAIL_WEBHOOK_SECRET: string
}

type Pending = {
  message_id: string
  thread_id: string
  inbox_id: string
  from: string
  subject: string
  text: string
  received: string
  attempts: number
}

const AGENTMAIL = "https://api.agentmail.to/v0"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/") return new Response("govblock clerk mail runner", { status: 200 })
    if (request.method !== "POST" || url.pathname !== "/agentmail") return new Response("not found", { status: 404 })

    const body = await request.text()
    if (!(await verify(request, body, env.AGENTMAIL_WEBHOOK_SECRET))) {
      console.log("webhook: bad signature", [...request.headers.keys()].join(","))
      return new Response("bad signature", { status: 401 })
    }

    let event: { event_type?: string; message?: Record<string, unknown> }
    try {
      event = JSON.parse(body)
    } catch {
      return new Response("bad json", { status: 400 })
    }
    if (event.event_type !== "message.received" || !event.message) {
      console.log("webhook: ignored", event.event_type, body.slice(0, 300))
      return new Response("ignored", { status: 200 })
    }

    const m = event.message
    const inbox = String(m.inbox_id ?? "")
    const from = String(m.from_ ?? m.from ?? "")
    if (inbox !== env.CLERK_INBOX) {
      console.log("webhook: not the clerk", inbox)
      return new Response("not the clerk", { status: 200 })
    }
    // Never answer ourselves, a bounce, or anything a machine sent.
    if (from.toLowerCase().includes(env.CLERK_INBOX) || /mailer-daemon|postmaster|no-?reply/i.test(from)) return new Response("skipped", { status: 200 })
    const headers = (m.headers ?? {}) as Record<string, string>
    if (/auto-(generated|replied)/i.test(headers["auto-submitted"] ?? "") || /bulk|junk|list/i.test(headers["precedence"] ?? "")) return new Response("skipped", { status: 200 })

    const pending: Pending = {
      message_id: String(m.message_id ?? ""),
      thread_id: String(m.thread_id ?? ""),
      inbox_id: inbox,
      from,
      subject: String(m.subject ?? ""),
      text: String(m.text ?? m.extract?.toString() ?? "").slice(0, 20_000),
      received: String(m.timestamp ?? new Date().toISOString()),
      attempts: 0,
    }
    if (!pending.message_id) return new Response("no message id", { status: 200 })
    await env.MAIL.put(`pending:${pending.message_id}`, JSON.stringify(pending), { expirationTtl: 60 * 60 * 24 })
    console.log("webhook: queued", pending.message_id, pending.from, pending.subject)
    return new Response("queued", { status: 200 })
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("cron: tick")
    ctx.waitUntil(drain(env))
  },
}

async function drain(env: Env) {
  const list = await env.MAIL.list({ prefix: "pending:", limit: 20 })
  for (const key of list.keys) {
    const raw = await env.MAIL.get(key.name)
    if (!raw) continue
    const item = JSON.parse(raw) as Pending
    // Claim it: a second cron overlapping this one must not run it twice.
    await env.MAIL.delete(key.name)
    if (item.attempts >= 2) {
      await env.MAIL.put(`failed:${item.message_id}`, raw, { expirationTtl: 60 * 60 * 24 * 7 })
      continue
    }
    // A marker that outlives a run the platform kills, so a silent death shows.
    await env.MAIL.put(`working:${item.message_id}`, JSON.stringify({ started: new Date().toISOString(), attempt: item.attempts + 1, subject: item.subject }), { expirationTtl: 60 * 60 })
    try {
      const answer = await run(env, item)
      await reply(env, item, answer)
      await env.MAIL.delete(`working:${item.message_id}`)
      await env.MAIL.put(`done:${item.message_id}`, JSON.stringify({ ...item, text: undefined, answered: new Date().toISOString(), chars: answer.length }), { expirationTtl: 60 * 60 * 24 * 7 })
    } catch (error) {
      await env.MAIL.delete(`working:${item.message_id}`)
      item.attempts += 1
      await env.MAIL.put(`pending:${item.message_id}`, JSON.stringify(item), { expirationTtl: 60 * 60 * 24 })
      await env.MAIL.put(`error:${item.message_id}:${item.attempts}`, String(error instanceof Error ? error.stack ?? error.message : error), { expirationTtl: 60 * 60 * 24 * 7 })
    }
  }
}

/** The Clerk's whole run: rounds against the chat route until it says done. */
async function run(env: Env, item: Pending): Promise<string> {
  const maxRounds = Number(env.MAX_ROUNDS) || 12
  const ask = item.subject && item.text ? `${item.subject}\n\n${item.text}` : item.subject || item.text || "(empty message)"
  let text = ""
  let roundText = 0
  let carry: string | null = null // the raw JSON of state.messages, unparsed
  let done = false
  let failed = false

  for (let round = 0; round < maxRounds && !done; round++) {
    const body = carry
      ? `{"agent":${JSON.stringify(env.AGENT)},"subject":${JSON.stringify(item.subject)},"state":{"messages":${carry}}}`
      : JSON.stringify({ agent: env.AGENT, subject: item.subject, turns: [{ role: "user", text: ask }] })
    // Amplify answers or cuts off inside thirty seconds; forty-five is a hang.
    const response = await fetch(`${env.APP_ORIGIN}/api/agents/chat`, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(45_000) })
    if (!response.ok || !response.body) throw new Error(`chat route ${response.status}: ${(await response.text()).slice(0, 300)}`)

    roundText = 0
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    for (;;) {
      const { done: finished, value } = await reader.read()
      if (finished) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (!line) continue
        if (line.startsWith('{"t":"state"')) {
          // {"t":"state","messages":[...],"done":false} — slice, do not parse.
          const start = line.indexOf('"messages":') + '"messages":'.length
          const end = line.lastIndexOf(',"done":')
          carry = line.slice(start, end)
          done = line.endsWith('"done":true}')
          continue
        }
        let event: { t?: string; v?: string; message?: string }
        try {
          event = JSON.parse(line)
        } catch {
          continue
        }
        if (event.t === "text") {
          if (text && roundText === 0) text += "\n\n"
          roundText += 1
          text += String(event.v ?? "")
        } else if (event.t === "error") {
          failed = true
          done = true
          text += (text ? "\n\n" : "") + String(event.message ?? "The run failed.")
        }
      }
    }
  }
  if (!done && !failed) text += (text ? "\n\n" : "") + `Stopped after ${maxRounds} rounds without reaching an answer.`
  return text.trim() || "The Clerk read your message but had nothing to say. Reply with a bill number and a jurisdiction."
}

async function reply(env: Env, item: Pending, markdown: string) {
  const signature = "\n\n—\nThe Clerk · GovBlock\nReply on this thread to ask a follow-up."
  const response = await fetch(`${AGENTMAIL}/inboxes/${encodeURIComponent(item.inbox_id)}/messages/${encodeURIComponent(item.message_id)}/reply`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.AGENTMAIL_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ text: markdown + signature, html: toHtml(markdown) + `<p style="color:#666;font-size:12px;margin-top:24px">The Clerk · GovBlock<br>Reply on this thread to ask a follow-up.</p>`, labels: ["clerk"] }),
  })
  if (!response.ok) throw new Error(`agentmail reply ${response.status}: ${(await response.text()).slice(0, 300)}`)
}

/** Svix signing: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), any v1 entry may match. */
async function verify(request: Request, body: string, secret: string): Promise<boolean> {
  if (!secret) return false
  const id = request.headers.get("svix-id") ?? request.headers.get("webhook-id")
  const timestamp = request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp")
  const signatures = request.headers.get("svix-signature") ?? request.headers.get("webhook-signature")
  if (!id || !timestamp || !signatures) return false
  // Five minutes of clock skew; a replayed delivery from last week is refused.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return signatures.split(" ").some((entry) => {
    const [version, value] = entry.split(",")
    return version === "v1" && value === expected
  })
}

/** Enough markdown for a Clerk answer: headings, paragraphs, lists, bold, italics, links, code, simple tables. */
function toHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  const out: string[] = []
  const lines = md.split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = Math.min(h[1].length + 1, 4)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`), i++
      out.push(`<ul>${items.join("")}</ul>`)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ""))}</li>`), i++
      out.push(`<ol>${items.join("")}</ol>`)
      continue
    }
    if (line.startsWith("|")) {
      const rows: string[] = []
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i]), i++
      const cells = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const bodyRows = rows.filter((r) => !/^\|?\s*:?-{2,}/.test(r))
      const [head, ...rest] = bodyRows
      out.push(
        `<table style="border-collapse:collapse;font-size:13px">` +
          (head ? `<tr>${cells(head).map((c) => `<th style="text-align:left;border-bottom:1px solid #999;padding:3px 8px">${inline(c)}</th>`).join("")}</tr>` : "") +
          rest.map((r) => `<tr>${cells(r).map((c) => `<td style="border-bottom:1px solid #ddd;padding:3px 8px;vertical-align:top">${inline(c)}</td>`).join("")}</tr>`).join("") +
          `</table>`
      )
      continue
    }
    if (line.startsWith("```")) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) code.push(esc(lines[i])), i++
      i++
      out.push(`<pre style="background:#f4f4f4;padding:8px;overflow:auto">${code.join("\n")}</pre>`)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+[.)]\s|\||```)/.test(lines[i])) para.push(lines[i]), i++
    out.push(`<p>${inline(para.join(" "))}</p>`)
  }
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${out.join("\n")}</div>`
}
