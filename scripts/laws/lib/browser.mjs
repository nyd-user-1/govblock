// A real browser, for the handful of jurisdictions that will not answer
// without one.
//
// Most of this list publishes documents. Six do not: they publish an
// application, and the statute arrives only after that application's own
// JavaScript has run — LexisNexis's viewer for Arkansas, Georgia, Mississippi
// and Tennessee, Lexum's for New Mexico, Folio's for New Jersey. Reading them
// with a fetcher means re-implementing each application; reading them with a
// browser means letting each one do its own work and taking the page it draws.
//
// Nothing here defeats a protection. No captcha is answered, no credential is
// borrowed, no login is passed: these are the free public editions the states
// themselves point their citizens at, and the only thing the browser adds is
// the JavaScript engine they assume. The user agent still says who is asking.
//
// It drives `chrome-headless-shell` over the DevTools protocol directly —
// spawn, connect, navigate, read the document — because that is a hundred
// lines and a dependency is not needed for it.
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"

import { UA, cacheDir } from "./fetch.mjs"
import { originalPath } from "./pool.mjs"

const SHELL =
  process.env.LAWS_CHROME ||
  join(homedir(), "Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell")

let chrome = null
let socket = null
let nextId = 1
const waiting = new Map()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Whether a browser can be had on this machine at all. */
export const canBrowse = () => existsSync(SHELL)

async function start() {
  if (socket) return socket
  if (!canBrowse()) throw new Error(`no headless shell at ${SHELL}`)
  const port = 9222 + Math.floor(Math.random() * 400)
  chrome = spawn(
    SHELL,
    [
      `--remote-debugging-port=${port}`,
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--disable-dev-shm-usage",
      `--user-agent=${UA}`,
      "--user-data-dir=" + join(cacheDir, "chrome-profile"),
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore"] }
  )
  // The shell prints its address on stderr, but polling the version endpoint
  // is simpler than parsing it and works the same on a restart.
  let target = null
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    await sleep(250)
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) target = (await r.json()).webSocketDebuggerUrl
    } catch {
      // not listening yet
    }
  }
  if (!target) throw new Error("the headless shell never opened its port")

  socket = new WebSocket(target)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    const pending = waiting.get(message.id)
    if (pending) {
      waiting.delete(message.id)
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result)
    }
  })
  return socket
}

async function send(method, params = {}, sessionId) {
  const ws = await start()
  const id = nextId++
  const message = JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    ws.send(message)
    setTimeout(() => {
      if (waiting.delete(id)) reject(new Error(`${method} timed out`))
    }, Number(process.env.LAWS_BROWSER_TIMEOUT ?? 90000))
  })
}

/** Close the browser. A run that forgets to leaves a process behind. */
export async function closeBrowser() {
  try {
    socket?.close()
  } catch {
    // already gone
  }
  socket = null
  chrome?.kill()
  chrome = null
}

/**
 * One page, and every request it made while drawing itself.
 *
 * Used to find out how an application asks for its own data, so the rest of a
 * jurisdiction can be read without a browser at all.
 */
export async function watch(url, { settle = 6000, match = /./, then = null, after = 4000 } = {}) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" })
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })
  const seen = []
  const listener = (event) => {
    const message = JSON.parse(event.data)
    if (message.method === "Network.requestWillBeSent" && message.sessionId === sessionId) {
      const request = message.params.request
      if (match.test(request.url)) seen.push({ method: request.method, url: request.url, body: request.postData ?? null })
    }
  }
  const ws = await start()
  ws.addEventListener("message", listener)
  try {
    await send("Network.enable", {}, sessionId)
    await send("Page.enable", {}, sessionId)
    await send("Page.navigate", { url }, sessionId)
    await sleep(settle)
    // `then` is a snippet run in the page — a click on the application's own
    // control — so that the request it makes is the one captured.
    if (then) {
      await send("Runtime.evaluate", { expression: then, awaitPromise: true }, sessionId)
      await sleep(after)
    }
    return seen
  } finally {
    ws.removeEventListener("message", listener)
    await send("Target.closeTarget", { targetId }).catch(() => {})
  }
}

/**
 * One page, opened and then worked — a snippet run against it over and over
 * until the document stops changing.
 *
 * A table of contents that loads its children on demand is read this way: the
 * snippet opens every closed node it can see, and the loop runs again until
 * there is nothing left closed. The document that comes back is the whole
 * tree, which is what a reader would have after clicking through it.
 */
export async function explore(state, url, { settle = 9000, step, rounds = 40, pause = 1500, reload = false } = {}) {
  const file = originalPath(state, url).replace(/\.body$/, ".explored")
  if (!reload && existsSync(file)) return readFileSync(file, "utf8")

  const { targetId } = await send("Target.createTarget", { url: "about:blank" })
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })
  try {
    await send("Page.enable", {}, sessionId)
    await send("Page.navigate", { url }, sessionId)
    await sleep(settle)
    let html = ""
    for (let round = 0; round < rounds; round++) {
      const { result } = await send("Runtime.evaluate", { expression: step, returnByValue: true }, sessionId)
      const opened = Number(result?.value ?? 0)
      await sleep(pause)
      const { result: got } = await send(
        "Runtime.evaluate",
        { expression: "document.documentElement.outerHTML", returnByValue: true },
        sessionId
      )
      html = String(got?.value ?? "")
      if (!opened) break
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html)
    return html
  } finally {
    await send("Target.closeTarget", { targetId }).catch(() => {})
  }
}

/**
 * One page, as the browser draws it.
 *
 * `settle` is how long to let the page's own requests finish before the
 * document is read; `until` is a test run against the document, and the page
 * is given up to `patience` to satisfy it.
 */
export async function render(state, url, { settle = 1200, until = null, patience = 20000, reload = false } = {}) {
  const file = originalPath(state, url).replace(/\.body$/, ".rendered")
  if (!reload && existsSync(file)) return readFileSync(file, "utf8")

  const { targetId } = await send("Target.createTarget", { url: "about:blank" })
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })
  try {
    await send("Page.enable", {}, sessionId)
    await send("Page.navigate", { url }, sessionId)
    await sleep(settle)
    const started = Date.now()
    let html = ""
    while (true) {
      const { result } = await send(
        "Runtime.evaluate",
        { expression: "document.documentElement.outerHTML", returnByValue: true },
        sessionId
      )
      html = String(result?.value ?? "")
      if (!until || until(html) || Date.now() - started > patience) break
      await sleep(500)
    }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html)
    return html
  } finally {
    await send("Target.closeTarget", { targetId }).catch(() => {})
  }
}
