import { looksSecret, type DiffNode, type DiffStats } from "@twincheck/core";

export const total = (s: DiffStats) => s.added + s.removed + s.modified;

/** Nodes from the root down to `id`, or undefined if not found. */
export function findTrail(root: DiffNode, id: string): DiffNode[] | undefined {
  if (root.id === id) return [root];
  if (!id.startsWith(root.id)) return undefined;
  for (const c of root.children) {
    const t = findTrail(c, id);
    if (t) return [root, ...t];
  }
  return undefined;
}

/** How many direct child objects were added / removed / modified. */
export function objectCounts(n: DiffNode): DiffStats {
  const out = { added: 0, removed: 0, modified: 0 };
  for (const c of n.children) if (c.status !== "unchanged") out[c.status]++;
  return out;
}

/** Ids of nodes that should appear in the navigator for the given filters. */
export function visibleIds(root: DiffNode, changesOnly: boolean, query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const out = new Set<string>();
  const walk = (n: DiffNode): boolean => {
    if (changesOnly && n.status === "unchanged") return false;
    let show = !q || n.label.toLowerCase().includes(q) || n.kind.toLowerCase().includes(q);
    for (const c of n.children) if (walk(c)) show = true;
    if (show) out.add(n.id);
    return show;
  };
  root.children.forEach(walk);
  return out;
}

const SECRET_ATTR = /(\s)([\w:.-]+)="([^"]*)"/g;
const SECRET_PAIR = /(name="([^"]*)"\s+value=")([^"]*)"/g;

/** Masks secret-looking attribute values in raw XML text. */
export function maskXml(xml: string): string {
  return xml
    .replace(SECRET_ATTR, (m, sp, name) => (looksSecret(name) ? `${sp}${name}="••••••"` : m))
    .replace(SECRET_PAIR, (m, head, name) => (looksSecret(name) ? `${head}••••••"` : m));
}
