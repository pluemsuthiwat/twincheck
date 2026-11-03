import { Keyer } from "./keys";
import { CompiledProfile, type Profile } from "./profile";
import type { TNode } from "./types";

/**
 * Normalised copy of a tree for the raw text view: ignored fields removed and unordered
 * siblings sorted by identity, so a plain line diff of two canonical trees shows real changes only.
 */
export function canonicalize(root: TNode, profile: Profile): TNode {
  const cp = new CompiledProfile(profile);
  const keyer = new Keyer(cp);

  const visit = (n: TNode, path: string): TNode => {
    const items = keyer.items(n.children, path);
    keyer.assignKeys(items, []);
    const sortKey = new Map(
      items.map((it) => [
        it,
        cp.rule(it.path).ordered ? it.node.name : `${it.node.name}\0${it.key ?? keyer.fingerprint(it.node, it.path)}`,
      ]),
    );
    items.sort((x, y) => {
      const kx = sortKey.get(x)!;
      const ky = sortKey.get(y)!;
      return kx < ky ? -1 : kx > ky ? 1 : x.idx - y.idx;
    });
    const attrs: Record<string, string> = {};
    for (const k of cp.comparableAttrs(n, path)) attrs[k] = n.attrs[k];
    return { name: n.name, attrs, text: n.text, children: items.map((it) => visit(it.node, it.path)) };
  };

  return visit(root, root.name);
}
