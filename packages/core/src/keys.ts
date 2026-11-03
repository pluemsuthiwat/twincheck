import type { CompiledProfile } from "./profile";
import type { TNode } from "./types";

/** A child element together with what the diff needs to know about it. */
export interface Item {
  node: TNode;
  path: string;
  /** Identity among siblings; undefined means "match by content". `""` means singleton. */
  key?: string;
  /** Index among all kept siblings. */
  idx: number;
  /** 1-based position among same-name siblings. */
  ord: number;
}

export class Keyer {
  private readonly fpCache = new WeakMap<TNode, string>();

  constructor(readonly cp: CompiledProfile) {}

  items(children: TNode[], parentPath: string): Item[] {
    const ords = new Map<string, number>();
    const out: Item[] = [];
    for (const node of children) {
      const path = `${parentPath}/${node.name}`;
      if (this.cp.ignored(path)) continue;
      const ord = (ords.get(node.name) ?? 0) + 1;
      ords.set(node.name, ord);
      out.push({ node, path, idx: out.length, ord });
    }
    return out;
  }

  /**
   * Assigns identity keys to both sibling lists at once, so that the singleton heuristic
   * ("only one element with this name") gives the same answer on both sides.
   */
  assignKeys(as: Item[], bs: Item[]): void {
    const counts = new Map<string, number>();
    for (const list of [as, bs]) {
      const local = new Map<string, number>();
      for (const it of list) local.set(it.node.name, (local.get(it.node.name) ?? 0) + 1);
      for (const [name, n] of local) counts.set(name, Math.max(counts.get(name) ?? 0, n));
    }
    for (const list of [as, bs]) {
      const seen = new Map<string, number>();
      for (const it of list) {
        const key = this.identity(it, counts.get(it.node.name) ?? 0);
        if (key === undefined) continue;
        const scoped = `${it.node.name}\0${key}`;
        const n = (seen.get(scoped) ?? 0) + 1;
        seen.set(scoped, n);
        it.key = n === 1 ? key : `${key}#${n}`;
      }
    }
  }

  private identity(it: Item, nameCount: number): string | undefined {
    const n = it.node;
    const custom = this.cp.rule(it.path).key?.(n);
    if (custom !== undefined) return custom;
    if (nameCount === 1) return "";
    if (n.attrs.name !== undefined) {
      return n.attrs.type !== undefined ? `${n.attrs.type}:${n.attrs.name}` : n.attrs.name;
    }
    if (n.children.length === 0 && Object.keys(n.attrs).length === 0 && n.text !== undefined) {
      return n.text;
    }
    return undefined;
  }

  /** Content hash that ignores excluded fields and the order of unordered children. */
  fingerprint(n: TNode, path: string): string {
    const cached = this.fpCache.get(n);
    if (cached !== undefined) return cached;
    const attrs = this.cp
      .comparableAttrs(n, path)
      .sort()
      .map((k) => `${k}=${n.attrs[k]}`);
    const ordered: string[] = [];
    const unordered: string[] = [];
    for (const child of this.items(n.children, path)) {
      const fp = this.fingerprint(child.node, child.path);
      (this.cp.rule(child.path).ordered ? ordered : unordered).push(fp);
    }
    unordered.sort();
    const fp = hash(
      [n.name, attrs.join("\u0001"), n.text ?? "", ordered.join(","), unordered.join(",")].join("\u0002"),
    );
    this.fpCache.set(n, fp);
    return fp;
  }
}

/** cyrb53: fast 53-bit string hash. Collisions are harmless here (they only affect pairing). */
function hash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
