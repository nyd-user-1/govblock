/**
 * Production stand-in for the inspector. `next.config.ts` aliases the real
 * module to this one whenever NODE_ENV is not development, so none of the
 * inspector — not its fiber walking, not its dev-server fetch, not its strings
 * — reaches a user. A `process.env` guard alone does NOT achieve this: it kills
 * the component BODY while the module still ships. Measured in 44b, where its
 * strings survived into two production chunks.
 */
export function DevInspector() {
  return null
}
