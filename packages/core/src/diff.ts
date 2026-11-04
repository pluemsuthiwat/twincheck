import { Keyer, type Item } from "./keys";
import { CompiledProfile, type Profile } from "./profile";
import type { AttrDiff, DiffNode, DiffStats, DiffStatus, TNode } from "./types";

interface Pair {
  a?: Item;
  b?: Item;
  moved?: boolean;
}

/** Above this many LCS cells an ordered list falls back to positional pairing. */
const LCS_LIMIT = 4_000_000;
const LABEL_MAX = 140;

/**
 * Semantic diff of two trees: children are matched by identity (profile key, singleton,
 * `name` attribute, text) instead of position, so reordering alone never shows up as a change.
 * Lists the profile marks as ordered are compared in sequence and report moves.
 */
export function diffTrees(a: TNode, b: TNode, profile: Profile): DiffNode {
  const engine = new DiffEngine(new CompiledProfile(profile));
  const root = (node: TNode): Item => ({ node, path: node.name, key: "", idx: 0, ord: 1 });
  return engine.diff({ a: root(a), b: root(b) }, "");
}

class DiffEngine {
  private readonly keyer: Keyer;

  constructor(private readonly cp: CompiledProfile) {
    this.keyer = new Keyer(cp);
  }

  diff(pair: Pair, parentId: string): DiffNode {
    const { a, b } = pair;
    const it = (b ?? a)!;
    const id = childId(parentId, it, b ? `b${b.idx}` : `a${a!.idx}`);
    if (!a || !b) return this.snapshot(it, a ? "removed" : "added", id);

    const rule = this.cp.rule(it.path);
    const attrs = this.diffAttrs(a, b);
    const text = diffText(a.node.text, b.node.text);
    const children = this.matchChildren(a, b).map((p) => this.diff(p, id));

    // One count per change point (see collectChanges), not per attribute: a value and its
    // displayValue changing together is one change.
    const stats: DiffStats = { added: 0, removed: 0, modified: 0 };
    for (const c of children) addStats(stats, c.stats);
    if (attrs.some((x) => x.status !== "unchanged") || text?.status === "modified" || pair.moved) stats.modified++;

    const changed = stats.added + stats.removed + stats.modified > 0;
    const label = this.label(b);
    const labelA = this.label(a);
    return {
      id,
      name: b.node.name,
      label,
      labelA: labelA !== label ? labelA : undefined,
      kind: rule.kind ?? b.node.name,
      status: changed ? "modified" : "unchanged",
      moved: pair.moved || undefined,
      pos: rule.ordered ? { a: a.ord, b: b.ord } : undefined,
      attrs,
      text,
      children,
      stats,
    };
  }

  /** Whole subtree that exists on one side only. */
  private snapshot(it: Item, status: "added" | "removed", id: string): DiffNode {
    const rule = this.cp.rule(it.path);
    const side = status === "added" ? "b" : "a";
    const items = this.keyer.items(it.node.children, it.path);
    this.keyer.assignKeys(items, []);
    const text = it.node.text;
    return {
      id,
      name: it.node.name,
      label: this.label(it),
      kind: rule.kind ?? it.node.name,
      status,
      pos: rule.ordered ? { [side]: it.ord } : undefined,
      attrs: this.cp.comparableAttrs(it.node, it.path).map((name) => ({
        name,
        [side]: it.node.attrs[name],
        status,
        secret: this.cp.secret(it.node, name) || undefined,
      })),
      text: text === undefined ? undefined : { [side]: text, status },
      children: items.map((c) => this.snapshot(c, status, childId(id, c, `${side}${c.idx}`))),
      stats: { added: status === "added" ? 1 : 0, removed: status === "removed" ? 1 : 0, modified: 0 },
    };
  }

  private label(it: Item): string {
    const custom = this.cp.rule(it.path).label?.(it.node, it.ord);
    const n = it.node;
    const raw = custom ?? n.attrs.name ?? (n.children.length === 0 ? n.text : undefined) ?? n.name;
    return raw.length > LABEL_MAX ? `${raw.slice(0, LABEL_MAX - 1)}…` : raw;
  }

  private diffAttrs(a: Item, b: Item): AttrDiff[] {
    const names = this.cp.comparableAttrs(a.node, a.path);
    for (const k of this.cp.comparableAttrs(b.node, b.path)) if (!names.includes(k)) names.push(k);
    return names.map((name) => {
      const av = a.node.attrs[name];
      const bv = b.node.attrs[name];
      const status: DiffStatus =
        av === undefined ? "added" : bv === undefined ? "removed" : av === bv ? "unchanged" : "modified";
      const secret = this.cp.secret(a.node, name) || this.cp.secret(b.node, name);
      return { name, a: av, b: bv, status, secret: secret || undefined };
    });
  }

  private matchChildren(a: Item, b: Item): Pair[] {
    const as = this.keyer.items(a.node.children, a.path);
    const bs = this.keyer.items(b.node.children, b.path);
    this.keyer.assignKeys(as, bs);

    const pairs: Pair[] = [];
    const aByKey = new Map<string, Item>();
    for (const it of as) if (it.key !== undefined) aByKey.set(scopedKey(it), it);
    const matched = new Set<Item>();
    for (const it of bs) {
      if (it.key === undefined) continue;
      const partner = aByKey.get(scopedKey(it));
      if (partner) matched.add(partner);
      pairs.push({ a: partner, b: it });
    }
    for (const it of as) if (it.key !== undefined && !matched.has(it)) pairs.push({ a: it });

    // Elements without identity: match by content, per element name.
    const unkeyed = new Map<string, { a: Item[]; b: Item[] }>();
    const group = (it: Item) => {
      let g = unkeyed.get(it.node.name);
      if (!g) unkeyed.set(it.node.name, (g = { a: [], b: [] }));
      return g;
    };
    for (const it of as) if (it.key === undefined) group(it).a.push(it);
    for (const it of bs) if (it.key === undefined) group(it).b.push(it);
    for (const g of unkeyed.values()) {
      const path = (g.a[0] ?? g.b[0]).path;
      const fp = (it: Item) => this.keyer.fingerprint(it.node, it.path);
      pairs.push(...(this.cp.rule(path).ordered ? sequencePairs(g.a, g.b, fp) : bagPairs(g.a, g.b, fp)));
    }

    markMoves(pairs, (path) => this.cp.rule(path).ordered);
    return displayOrder(pairs);
  }
}

function childId(parentId: string, it: Item, fallback: string): string {
  const seg =
    it.key === undefined ? `${it.node.name}@${fallback}` : it.key === "" ? it.node.name : `${it.node.name}[${it.key}]`;
  return parentId ? `${parentId}/${seg}` : seg;
}

const scopedKey = (it: Item) => `${it.node.name}\0${it.key}`;

function diffText(a?: string, b?: string): DiffNode["text"] {
  if (a === undefined && b === undefined) return undefined;
  const status: DiffStatus = a === undefined ? "added" : b === undefined ? "removed" : a === b ? "unchanged" : "modified";
  return { a, b, status: status === "unchanged" ? status : "modified" };
}

function addStats(into: DiffStats, s: DiffStats) {
  into.added += s.added;
  into.removed += s.removed;
  into.modified += s.modified;
}

/** Unordered: identical content pairs first, the rest pair up in document order. */
function bagPairs(as: Item[], bs: Item[], fp: (it: Item) => string): Pair[] {
  const pool = new Map<string, Item[]>();
  for (const it of as) {
    const k = fp(it);
    pool.set(k, [...(pool.get(k) ?? []), it]);
  }
  const pairs: Pair[] = [];
  const leftB: Item[] = [];
  for (const it of bs) {
    const partner = pool.get(fp(it))?.shift();
    if (partner) pairs.push({ a: partner, b: it });
    else leftB.push(it);
  }
  const leftA = [...pool.values()].flat().sort((x, y) => x.idx - y.idx);
  return pairs.concat(zipRest(leftA, leftB));
}

/**
 * Ordered: LCS on content; identical items left outside it pair up as moves, the rest
 * pair up positionally within their gap (= modified).
 */
function sequencePairs(as: Item[], bs: Item[], fp: (it: Item) => string): Pair[] {
  const n = as.length;
  const m = bs.length;
  if (n * m > LCS_LIMIT) return zipRest(as, bs);
  const fa = as.map(fp);
  const fb = bs.map(fp);
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = fa[i] === fb[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const pairs: Pair[] = [];
  const gaps: { a: Item[]; b: Item[] }[] = [{ a: [], b: [] }];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (fa[i] === fb[j]) {
      pairs.push({ a: as[i++], b: bs[j++] });
      gaps.push({ a: [], b: [] });
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      gaps[gaps.length - 1].a.push(as[i++]);
    } else {
      gaps[gaps.length - 1].b.push(bs[j++]);
    }
  }
  gaps[gaps.length - 1].a.push(...as.slice(i));
  gaps[gaps.length - 1].b.push(...bs.slice(j));

  // The same content removed in one gap and added in another moved; markMoves flags it.
  const pool = new Map<string, Item[]>();
  for (const g of gaps) for (const it of g.a) pool.set(fp(it), [...(pool.get(fp(it)) ?? []), it]);
  const relocated = new Set<Item>();
  for (const g of gaps) {
    for (const it of g.b) {
      const partner = pool.get(fp(it))?.shift();
      if (!partner) continue;
      pairs.push({ a: partner, b: it });
      relocated.add(partner).add(it);
    }
  }
  const rest = (xs: Item[]) => xs.filter((x) => !relocated.has(x));
  return pairs.concat(gaps.flatMap((g) => zipRest(rest(g.a), rest(g.b))));
}

function zipRest(as: Item[], bs: Item[]): Pair[] {
  const pairs: Pair[] = [];
  for (let k = 0; k < Math.max(as.length, bs.length); k++) pairs.push({ a: as[k], b: bs[k] });
  return pairs;
}

/** In ordered lists, matched items outside the longest increasing run of positions have moved. */
function markMoves(pairs: Pair[], ordered: (path: string) => boolean) {
  const byName = new Map<string, Pair[]>();
  for (const p of pairs) {
    if (!p.a || !p.b || !ordered(p.b.path)) continue;
    byName.set(p.b.node.name, [...(byName.get(p.b.node.name) ?? []), p]);
  }
  for (const list of byName.values()) {
    list.sort((x, y) => x.b!.idx - y.b!.idx);
    const keep = longestIncreasing(list.map((p) => p.a!.idx));
    list.forEach((p, k) => {
      if (!keep.has(k)) p.moved = true;
    });
  }
}

/** Indexes of one longest strictly increasing subsequence. */
function longestIncreasing(xs: number[]): Set<number> {
  const tails: number[] = [];
  const prev = new Array<number>(xs.length).fill(-1);
  for (let k = 0; k < xs.length; k++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[tails[mid]] < xs[k]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[k] = tails[lo - 1];
    tails[lo] = k;
  }
  const out = new Set<number>();
  for (let k = tails.length ? tails[tails.length - 1] : -1; k >= 0; k = prev[k]) out.add(k);
  return out;
}

/** B's order, with items that only exist in A slotted in next to where they used to be. */
function displayOrder(pairs: Pair[]): Pair[] {
  const withB = pairs.filter((p) => p.b).sort((x, y) => x.b!.idx - y.b!.idx);
  const onlyA = pairs.filter((p) => !p.b).sort((x, y) => x.a!.idx - y.a!.idx);
  const out: Pair[] = [];
  let r = 0;
  for (const p of withB) {
    if (p.a) while (r < onlyA.length && onlyA[r].a!.idx < p.a.idx) out.push(onlyA[r++]);
    out.push(p);
  }
  return out.concat(onlyA.slice(r));
}
