import { collectChanges, looksSecret, type AttrDiff, type ChangePoint, type DiffNode, type DiffStats } from "@twincheck/core";

export const total = (s: DiffStats) => s.added + s.removed + s.modified;

export interface ObjectChanges {
  object: DiffNode;
  changes: ChangePoint[];
}

export interface CategoryChanges {
  category: DiffNode;
  objects: ObjectChanges[];
}

/** Change points grouped by category (first level) and then by object (second level), in tree order. */
export function groupChanges(root: DiffNode): CategoryChanges[] {
  const cats = new Map<DiffNode, Map<DiffNode, ChangePoint[]>>();
  for (const c of collectChanges(root)) {
    const category = c.trail[0] ?? c.node;
    const object = c.trail[1] ?? c.node;
    let objects = cats.get(category);
    if (!objects) cats.set(category, (objects = new Map()));
    objects.set(object, [...(objects.get(object) ?? []), c]);
  }
  return [...cats].map(([category, objects]) => ({
    category,
    objects: [...objects].map(([object, changes]) => ({ object, changes })),
  }));
}

/** A node without a label of its own (label is just the element name) and no list position. */
const unnamed = (n: DiffNode) => n.label === n.name && !n.pos;

/** Where a change sits inside its object: the meaningful ancestors below the object. */
export function innerPath(trail: DiffNode[]): DiffNode[] {
  return trail.slice(2).filter((n) => !unnamed(n));
}

/** Label (B's, or A's with `side: "a"`) with any secret attribute value masked, since some labels embed values. */
export function displayLabel(n: DiffNode, showSecrets: boolean, side: "a" | "b" = "b"): string {
  const label = side === "a" ? (n.labelA ?? n.label) : n.label;
  if (showSecrets) return label;
  let out = label;
  for (const a of n.attrs) {
    if (!a.secret) continue;
    for (const v of [a.a, a.b]) if (v && v.length >= 3) out = out.split(v).join("••••••");
  }
  return out;
}

export interface FieldRow extends AttrDiff {
  /** Underlying raw value when the row shows a display value on top of it. */
  raw?: { a?: string; b?: string };
  /** Diff node the row stands for, when it comes from a name/value child (anchor + focus). */
  id?: string;
}

/** A list whose entries are plain text leaves, e.g. `<AuthMethodNameList><string>[PAP]</string>…`. */
export function isTextList(n: DiffNode): boolean {
  return n.children.length > 0 && n.children.every((c) => c.children.length === 0 && c.attrs.length === 0 && c.text !== undefined);
}

/**
 * A list of one-line entries: plain text (`<string>`), or leaves with a label of their own, like
 * conditions (`Zone EQUALS Lab`), results and profile attributes. Shown as one A | B table.
 * name/value leaves are excluded: they are fields of their parent, not entries.
 */
export function isEntryList(n: DiffNode): boolean {
  return (
    isTextList(n) ||
    (n.children.length > 0 &&
      n.children.every((c) => c.children.length === 0 && c.label !== c.name && !isNameValuePair(c)))
  );
}

/** A list whose order matters (every entry has a position), e.g. a policy's RuleList. */
export function isOrderedList(n: DiffNode): boolean {
  return n.children.length > 0 && n.children.every((c) => c.pos !== undefined) && !isEntryList(n);
}

export interface EntryRow {
  /** Entry shown in the A column / the B column of this row (the same node when aligned). */
  a?: DiffNode;
  b?: DiffNode;
}

/**
 * Rows for a list table. When entries were only reordered (and anything added or removed sits
 * at the end), rows follow positions, so row #2 is each side's 2nd entry and a swap shows as
 * a swap. Otherwise (something inserted or removed mid-list) rows pair each entry with itself,
 * since positional rows would misalign everything after the insert.
 */
export function entryRows(n: DiffNode): { rows: EntryRow[]; byPosition: boolean } {
  const kids = n.children;
  if (kids.length > 0 && kids.every((c) => c.pos)) {
    const both = kids.filter((c) => c.pos!.a !== undefined && c.pos!.b !== undefined);
    const maxA = Math.max(0, ...both.map((c) => c.pos!.a!));
    const maxB = Math.max(0, ...both.map((c) => c.pos!.b!));
    const tailOnly = kids.every((c) =>
      c.status === "added" ? c.pos!.b! > maxB : c.status === "removed" ? c.pos!.a! > maxA : true,
    );
    if (tailOnly) {
      const side = (s: "a" | "b") => kids.filter((c) => c.pos![s] !== undefined).sort((x, y) => x.pos![s]! - y.pos![s]!);
      const as = side("a");
      const bs = side("b");
      return { byPosition: true, rows: Array.from({ length: Math.max(as.length, bs.length) }, (_, i) => ({ a: as[i], b: bs[i] })) };
    }
  }
  return {
    byPosition: false,
    rows: kids.map((c) => ({ a: c.status === "added" ? undefined : c, b: c.status === "removed" ? undefined : c })),
  };
}

/** The entry's position: B's, or A's for an entry only in A. */
export function positionText(n: DiffNode): string {
  return `#${n.pos?.b ?? n.pos?.a}`;
}

/**
 * "#2 in A → #1 in B" for an entry that was actually moved. Entries that only shifted because
 * another entry moved, or one was added/removed before them, get nothing: they did not change.
 */
export function moveText(n: DiffNode): string | undefined {
  const { a, b } = n.pos ?? {};
  if (!n.moved || a === undefined || b === undefined) return undefined;
  return `#${a} in A → #${b} in B`;
}

/** A label without its leading "Rule 3: " style position, which differs between A and B. */
export function unnumbered(label: string, kind: string): string {
  return label.startsWith(`${kind} `) ? label.replace(/^\S+ \d+: /, "") : label;
}

/** One side of an entry: everything in it except what exists only on the other side. */
function onSide(n: DiffNode, side: "a" | "b"): DiffNode[] {
  return n.children.filter((c) => c.status !== (side === "a" ? "added" : "removed"));
}

export interface RuleParts {
  /** Conditions in document order, joined by `joiner` ("AND" / "OR"). */
  conditions: DiffNode[];
  joiner: string;
  results: DiffNode[];
}

/**
 * One side of a rule split into its conditions and results (found by kind, at any depth), so a
 * rule row lists each condition's fields and then what the rule sets. Undefined when the entry
 * has neither, e.g. a list entry that is not a rule.
 */
export function ruleParts(n: DiffNode, side: "a" | "b"): RuleParts | undefined {
  const conditions: DiffNode[] = [];
  const results: DiffNode[] = [];
  let joiner = "AND";
  const walk = (x: DiffNode) => {
    for (const c of onSide(x, side)) {
      // Leaves only: a <Condition> wrapper element has that kind too.
      if (c.children.length === 0 && c.kind === "Condition") conditions.push(c);
      else if (c.children.length === 0 && c.kind === "Result") results.push(c);
      else {
        const op = c.attrs.find((a) => a.name === "operator")?.[side];
        if (op?.toUpperCase() === "OR") joiner = "OR";
        walk(c);
      }
    }
  };
  walk(n);
  return conditions.length + results.length > 0 ? { conditions, joiner, results } : undefined;
}

/**
 * One side of a rule result as what it sets and its items, one per line:
 * `Enforcement-Profile = "Tar-1010-network, Palo Alto User-ID"` (value "3002,3015") gives two
 * items. The display value is split only when its parts match the raw IDs one for one, so a name
 * that itself contains ", " stays whole; without raw IDs (ignored by the profile) it is split as is.
 */
export function resultItems(n: DiffNode, side: "a" | "b"): { name: string; items: string[] } {
  const get = (k: string) => n.attrs.find((x) => x.name === k)?.[side];
  const raw = get("value");
  const shown = get("displayValue") ?? raw ?? "";
  const parts = shown.split(", ");
  const fits = raw === undefined || raw.split(",").length === parts.length;
  return { name: get("name") ?? n.label, items: fits ? parts : [shown] };
}

/** Entries of a list field value: "a, b, c" → ["a", "b", "c"]. */
export function listItems(v: string | undefined): string[] {
  return (v ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "");
}

export interface EntryField {
  name: string;
  value: string;
  changed: boolean;
  secret?: boolean;
}

/**
 * One side of a one-line entry (e.g. a condition) as labeled fields in document order:
 * type, name, operator, value. A display value replaces its raw value (raw kept in parentheses
 * when it differs), so `value` reads "Wireless-802.11 (19)" rather than appearing twice.
 */
export function entryFields(n: DiffNode, side: "a" | "b"): EntryField[] {
  const present = n.attrs.filter((x) => x[side] !== undefined);
  const byName = new Map(present.map((x) => [x.name, x]));
  const shownAs = new Map<string, string>(); // raw attr name -> its display attr name
  for (const x of present) {
    const base = displayBase(x.name);
    if (base && byName.has(base)) shownAs.set(base, x.name);
  }
  const display = new Set(shownAs.values());
  return present
    .filter((x) => !display.has(x.name))
    .map((x) => {
      // A display value whose raw value is not compared (e.g. an internal ID) is the value.
      const base = displayBase(x.name);
      if (base && !byName.has(base)) {
        return { name: base, value: x[side]!, changed: x.status !== "unchanged", secret: x.secret };
      }
      const d = shownAs.get(x.name);
      const dx = d ? byName.get(d)! : undefined;
      const raw = x[side]!;
      const shown = dx ? dx[side]! : raw;
      return {
        name: x.name,
        // "Wireless-802.11 (19)" already carries its raw "19".
        value: dx && shown !== raw && !shown.includes(raw) ? `${shown} (${raw})` : shown,
        changed: x.status !== "unchanged" || (dx?.status ?? "unchanged") !== "unchanged",
        secret: x.secret || dx?.secret,
      };
    });
}

/** A leaf like `<NVPair name="server" value="..."/>`: shown as a row of its parent's field table. */
export function isNameValuePair(n: DiffNode): boolean {
  const names = n.attrs.map((a) => a.name);
  return (
    n.children.length === 0 &&
    n.text === undefined &&
    names.includes("name") &&
    names.includes("value") &&
    names.every((x) => x === "name" || x === "value")
  );
}

/** The field-table row for a name/value child: field = its name, A/B = its value on each side. */
export function pairRow(n: DiffNode): FieldRow {
  const v = n.attrs.find((a) => a.name === "value")!;
  return {
    id: n.id,
    name: n.label,
    a: n.status === "added" ? undefined : v.a,
    b: n.status === "removed" ? undefined : v.b,
    status: n.status === "modified" ? v.status : n.status,
    secret: v.secret,
  };
}

const DISPLAY_OF = [/^display(.)(.*)$/, /^(.+)DispName$/];

function displayBase(name: string): string | undefined {
  const d = DISPLAY_OF[0].exec(name);
  if (d) return d[1].toLowerCase() + d[2];
  return DISPLAY_OF[1].exec(name)?.[1];
}

/**
 * Attribute rows with a display/raw pair (displayValue + value) folded into one row when both
 * changed, so one edit reads as one change. A pair where only one side changed stays as two rows.
 */
export function fieldRows(n: DiffNode): FieldRow[] {
  const rows: FieldRow[] = [...n.attrs];
  if (n.text) rows.push({ name: "(text)", ...n.text });
  const byName = new Map(rows.map((r) => [r.name, r]));
  // display row name -> raw row it absorbs
  const pairs = new Map<string, FieldRow>();
  for (const r of rows) {
    const base = displayBase(r.name);
    const raw = base ? byName.get(base) : undefined;
    if (raw && r.status !== "unchanged" && raw.status !== "unchanged" && !r.secret && !raw.secret) pairs.set(r.name, raw);
  }
  const absorbed = new Set([...pairs.values()].map((r) => r.name));
  return rows
    .filter((r) => !absorbed.has(r.name))
    .map((r) => {
      const raw = pairs.get(r.name);
      if (!raw) return r;
      const same = raw.a === r.a && raw.b === r.b;
      return { ...r, name: raw.name, raw: same ? undefined : { a: raw.a, b: raw.b } };
    });
}

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
