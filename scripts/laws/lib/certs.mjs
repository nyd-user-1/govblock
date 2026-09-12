// A host that serves an incomplete certificate chain is not a dead host.
//
// Several legislatures send only their leaf certificate and leave the client
// to find the intermediate. A browser does that quietly, from its own cache or
// from the "CA Issuers" address printed inside the certificate itself; Node
// does not, and answers `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, which reads exactly
// like the site being down. Connecticut is one (GoDaddy G2); Vermont was
// another the night the bill-text fleet ran.
//
// So the chain is completed the way the certificate says to complete it: read
// the leaf, follow its CA Issuers address, and add what comes back to the
// trust store for that run. Nothing is disabled and nothing is bypassed — the
// certificate is still verified, against the intermediate its own issuer
// publishes.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { rootCertificates } from "node:tls"

import { cacheDir } from "./fetch.mjs"

const dir = join(cacheDir, "certs")
const extra = []
const tried = new Set()

/** Whether an error is a chain that did not reach a root. */
export const isChainGap = (error) =>
  /UNABLE_TO_VERIFY_LEAF_SIGNATURE|unable to verify the first certificate|SELF_SIGNED_CERT_IN_CHAIN/i.test(
    String(error?.cause?.code ?? "") + " " + String(error?.cause?.message ?? "") + " " + String(error?.message ?? "")
  )

/** Every certificate this run trusts: the system roots and what we have fetched. */
export const trusted = () => [...rootCertificates, ...extra]

/**
 * Fetch the intermediate a host's certificate names, and add it. Returns
 * whether the trust store grew, so the caller knows a retry is worth making.
 */
export function completeChain(host, log) {
  if (tried.has(host)) return false
  tried.add(host)
  mkdirSync(dir, { recursive: true })
  const pem = join(dir, `${host}.pem`)
  if (existsSync(pem)) {
    extra.push(readFileSync(pem, "utf8"))
    return true
  }
  try {
    const leaf = execFileSync("openssl", ["s_client", "-connect", `${host}:443`, "-servername", host, "-showcerts"], {
      input: "",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 20000,
    })
    const text = execFileSync("openssl", ["x509", "-noout", "-text"], { input: leaf, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] })
    const uri = /CA Issuers - URI:(\S+)/.exec(text)?.[1]
    if (!uri) return false
    const der = join(dir, `${host}.crt`)
    execFileSync("curl", ["-fsSL", "-o", der, uri], { timeout: 30000 })
    // The issuer publishes DER as often as PEM; both convert the same way.
    const body = readFileSync(der, "utf8").includes("BEGIN CERTIFICATE")
      ? readFileSync(der, "utf8")
      : execFileSync("openssl", ["x509", "-inform", "DER", "-in", der], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] })
    writeFileSync(pem, body)
    extra.push(body)
    log?.(`${host} sent an incomplete chain; added the intermediate it names (${uri})`)
    return true
  } catch {
    return false
  }
}
