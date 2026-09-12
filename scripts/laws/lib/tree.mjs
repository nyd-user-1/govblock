// Document order, for an adapter that learns a law's tree before its text.

/**
 * Depth-first from the root, so the runner's `sequence_no` is the order a
 * reader reads in rather than the order the source happened to be parsed in —
 * which is what makes `?text=1` page a law from its first section to its last
 * and the crumbs climb.
 *
 * `depth` is rewritten from the walk, so an adapter that guessed it wrong on
 * the way in is corrected here.
 */
export function inOrder(nodes) {
  const children = new Map()
  for (const node of nodes) {
    const key = node.parent_location_id ?? ""
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(node)
  }
  const root = nodes.find((n) => !n.parent_location_id)
  if (!root) return nodes
  const out = [{ ...root, depth: 0 }]
  const walk = (id, depth) => {
    for (const node of children.get(id) ?? []) {
      out.push({ ...node, depth })
      walk(node.location_id, depth + 1)
    }
  }
  walk(root.location_id, 1)
  return out
}
