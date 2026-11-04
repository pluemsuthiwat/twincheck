import type { ChangePoint, DiffNode, DiffStatus } from "@twincheck/core";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  displayLabel,
  entryFields,
  entryRows,
  fieldRows,
  groupChanges,
  innerPath,
  isEntryList,
  isNameValuePair,
  isOrderedList,
  isTextList,
  moveText,
  pairRow,
  positionText,
  total,
  unnumbered,
  type EntryRow,
  type FieldRow,
  type ObjectChanges,
} from "../lib/tree";
import { Counts, FolderIcon, StatusBadge, StatusDot } from "./Status";

export interface ViewOptions {
  changesOnly: boolean;
  showSecrets: boolean;
  labels: { a: string; b: string };
}

type Filter = "all" | Exclude<DiffStatus, "unchanged">;

const SECTIONS: [Exclude<DiffStatus, "unchanged">, string][] = [
  ["modified", "Changed"],
  ["added", "Only in B"],
  ["removed", "Only in A"],
];

/** Landing view: categories → Changed / Only in B / Only in A → one card per object with its changes inline. */
export function Overview({
  root,
  options,
  onOpen,
}: {
  root: DiffNode;
  options: ViewOptions;
  onOpen: (objectId: string, focusId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const groups = useMemo(() => groupChanges(root), [root]);
  const all = useMemo(() => groups.flatMap((g) => g.objects.flatMap((o) => o.changes)), [groups]);

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-add-bg text-add">
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 12l5 5 9-10" />
          </svg>
        </div>
        <p className="text-lg font-semibold">No differences found</p>
        <p className="text-sm text-muted">Both configs are identical in every compared field</p>
      </div>
    );
  }

  const count = (s: DiffStatus) => all.filter((c) => c.node.status === s).length;
  const cards: [Filter, string, number, string][] = [
    ["all", "All differences", all.length, "text-ink"],
    ["modified", "Changed / moved", count("modified"), "text-mod"],
    ["added", "Only in B", count("added"), "text-add"],
    ["removed", "Only in A", count("removed"), "text-del"],
  ];
  const keep = (c: ChangePoint) => filter === "all" || c.node.status === filter;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map(([f, label, n, cls]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-lg border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
              filter === f ? "border-side-b ring-2 ring-side-b/30" : "border-line"
            }`}
          >
            <div className={`text-2xl font-bold tabular-nums ${cls}`}>{n}</div>
            <div className="text-xs text-muted">{label}</div>
          </button>
        ))}
      </div>

      {groups.map(({ category, objects }) => {
        const visible = objects
          .map((o) => ({ ...o, changes: o.changes.filter(keep) }))
          .filter((o) => o.changes.length > 0);
        if (visible.length === 0) return null;
        return (
          <section key={category.id} className="space-y-3">
            <h3 className="flex items-center gap-2 border-b border-line pb-1.5 text-base font-semibold">
              <FolderIcon />
              {category.label}
              <Counts stats={category.stats} className="text-xs" />
            </h3>
            {SECTIONS.map(([status, title]) => {
              const list = visible.filter((o) => o.object.status === status);
              if (list.length === 0) return null;
              return (
                <div key={status} className="space-y-2">
                  <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {title} · {list.length}
                  </h4>
                  {list.map((o) => (
                    <ObjectCard key={o.object.id} item={o} options={options} onOpen={onOpen} />
                  ))}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function ObjectCard({
  item: { object, changes },
  options,
  onOpen,
}: {
  item: ObjectChanges;
  options: ViewOptions;
  onOpen: (objectId: string, focusId: string) => void;
}) {
  const whole = object.status !== "modified";
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => onOpen(object.id, object.id)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
      >
        <StatusDot status={object.status} />
        <span className="min-w-0 flex-1 truncate">
          {object.kind !== object.label && <span className="text-xs text-muted">{object.kind} · </span>}
          <span className="font-semibold">{displayLabel(object, options.showSecrets)}</span>
        </span>
        {!whole && <Counts stats={object.stats} />}
        <StatusBadge status={object.status} moved={object.moved} />
        <span className="text-xs text-muted">Open ›</span>
      </button>
      {!whole && (
        <ul className="divide-y divide-line border-t border-line">
          {changes.map((c) => (
            <ChangeLine key={c.node.id} change={c} object={object} options={options} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </article>
  );
}

const MARK: Record<DiffStatus, [string, string]> = {
  added: ["+", "text-add"],
  removed: ["−", "text-del"],
  modified: ["~", "text-mod"],
  unchanged: ["", ""],
};

function ChangeLine({
  change: { node, trail },
  object,
  options,
  onOpen,
}: {
  change: ChangePoint;
  object: DiffNode;
  options: ViewOptions;
  onOpen: (objectId: string, focusId: string) => void;
}) {
  const path = innerPath(trail);
  // A name/value setting reads as one field line, like it does in the Detail table.
  const pair = isNameValuePair(node);
  const isObject = node === object || pair;
  const fields = pair
    ? [pairRow(node)]
    : node.status === "modified"
      ? fieldRows(node).filter((r) => r.status !== "unchanged")
      : [];
  const [mark, markCls] = node.moved && fields.length === 0 ? ["↕", "text-mod"] : MARK[node.status];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(object.id, node.id)}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-2"
      >
        <span className={`w-3 shrink-0 text-center font-mono text-sm font-bold ${markCls}`}>{mark}</span>
        <span className="min-w-0 flex-1 space-y-1">
          {path.length > 0 && (
            <span className="block truncate text-xs text-muted">
              {path.map((p) => displayLabel(p, options.showSecrets)).join(" › ")}
            </span>
          )}
          {!isObject && (
            <span className="block text-sm break-words">
              <span className="text-xs text-muted">{node.kind} · </span>
              {displayLabel(node, options.showSecrets)}
              {node.status === "added" && <span className="ml-2 text-xs text-add">only in B</span>}
              {node.status === "removed" && <span className="ml-2 text-xs text-del">only in A</span>}
            </span>
          )}
          {moveText(node) && (
            <span className="block text-xs">
              <span className="rounded bg-mod-bg px-1.5 py-0.5 font-semibold text-mod">Moved: {moveText(node)}</span>
            </span>
          )}
          {fields.map((f) => (
            <FieldChange key={f.name} row={f} options={options} />
          ))}
        </span>
      </button>
    </li>
  );
}

/** "field: old → new" with old/new in the remove/add colors. */
function FieldChange({ row, options }: { row: FieldRow; options: ViewOptions }) {
  const masked = row.secret && !options.showSecrets;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="font-mono text-muted">{row.name}</span>
      <Pill v={row.a} side="a" masked={masked} />
      <span className="text-muted">→</span>
      <Pill v={row.b} side="b" masked={masked} />
      {masked && <span className="text-mod">(values differ)</span>}
    </span>
  );
}

function Pill({ v, side, masked }: { v?: string; side: "a" | "b"; masked?: boolean }) {
  const cls = side === "a" ? "bg-del-bg text-del" : "bg-add-bg text-add";
  if (v === undefined) return <span className="text-muted italic">not set</span>;
  const text = masked ? "••••••" : v === "" ? "(empty)" : v;
  return <span className={`max-w-full rounded px-1.5 py-0.5 font-mono break-all ${cls}`}>{text}</span>;
}

export function Detail({
  trail,
  focusId,
  options,
  onSelect,
}: {
  trail: DiffNode[];
  focusId?: string;
  options: ViewOptions;
  onSelect: (id: string) => void;
}) {
  const node = trail[trail.length - 1];

  useEffect(() => {
    if (focusId) document.getElementById(`node-${focusId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, node.id]);

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
        <button type="button" className="hover:text-ink" onClick={() => onSelect("")}>
          Overview
        </button>
        {trail.slice(1).map((t) => (
          <span key={t.id} className="flex min-w-0 items-center gap-1">
            <span>›</span>
            <button type="button" className="max-w-64 truncate hover:text-ink" onClick={() => onSelect(t.id)}>
              {displayLabel(t, options.showSecrets)}
            </button>
          </span>
        ))}
      </nav>
      <NodeBlock node={node} depth={0} focusId={focusId} options={options} section={trail.length === 2} />
    </div>
  );
}

/** No fields of its own and exactly one child: shown as a path segment instead of a nested box. */
const passThrough = (n: DiffNode) =>
  n.attrs.length === 0 &&
  n.text === undefined &&
  n.children.length === 1 &&
  !isNameValuePair(n.children[0]) &&
  !isEntryList(n);

function NodeBlock({
  node,
  depth,
  focusId,
  options,
  via = [],
  section,
  whole,
}: {
  node: DiffNode;
  depth: number;
  focusId?: string;
  options: ViewOptions;
  /** Collapsed pass-through ancestors, shown before the label. */
  via?: DiffNode[];
  /** A top-level category: styled neutrally so its color never matches a changed object's. */
  section?: boolean;
  /** Show everything inside, changed or not: an entry unfolded from a list row reads as a whole (conditions and result). */
  whole?: boolean;
}) {
  // Whole added/removed subtrees start folded: their header already says "Only in A/B".
  const [open, setOpen] = useState(whole || depth === 0 || node.status === "modified" || focusId === node.id);
  const [showSame, setShowSame] = useState(whole ?? false);

  if (depth > 0 && passThrough(node)) {
    // Keep the anchor so Overview can still scroll to this node.
    return (
      <div id={`node-${node.id}`}>
        <NodeBlock node={node.children[0]} depth={depth} focusId={focusId} options={options} via={[...via, node]} whole={whole} />
      </div>
    );
  }

  // One standard per shape: fields and name/value children → Field | A | B table; text lists
  // and ordered lists (rules) → # | A | B table, one row per entry. Only other children get boxes.
  // Categories keep their object boxes; any other list of one-line entries is a table.
  const list = !section && isEntryList(node);
  const rules = isOrderedList(node);
  const pairs = list || rules ? [] : node.children.filter(isNameValuePair);
  const boxes = list || rules ? [] : node.children.filter((c) => !isNameValuePair(c));
  const changed = boxes.filter((c) => c.status !== "unchanged");
  const same = boxes.length - changed.length;
  const kids = options.changesOnly && !showSame && node.status === "modified" ? changed : boxes;
  const focused = focusId === node.id || via.some((v) => v.id === focusId);
  const hasFields = node.attrs.length > 0 || node.text !== undefined || pairs.length > 0;

  // Only boxes with something inside get a chevron, so opening one never shows an empty body.
  const expandable = hasFields || list || rules || boxes.length > 0;

  const header = (
    <button
      type="button"
      onClick={() => expandable && setOpen(!open)}
      aria-expanded={expandable ? open : undefined}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left ${expandable ? "hover:bg-surface-2" : "cursor-default"}`}
    >
      <svg
        viewBox="0 0 16 16"
        className={`size-3 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""} ${expandable ? "" : "invisible"}`}
        fill="currentColor"
      >
        <path d="M6 3l5 5-5 5z" />
      </svg>
      <span className={`min-w-0 flex-1 ${depth === 0 ? "text-base font-semibold" : "text-sm"}`}>
        {via.length > 0 && node.label === node.name && (
          <span className="text-xs text-muted">{via.map((v) => displayLabel(v, options.showSecrets)).join(" › ")} › </span>
        )}
        {section ? <FolderIcon /> : <StatusDot status={node.status} inline />}{" "}
        {!section && node.kind !== node.label && <span className="text-xs text-muted">{node.kind} · </span>}
        <span className="break-words">{displayLabel(node, options.showSecrets)}</span>
      </span>
      {node.pos && <Position node={node} />}
      {node.status === "modified" && <Counts stats={node.stats} />}
      {!section && <StatusBadge status={node.status} moved={node.moved} />}
    </button>
  );

  const moved = node.moved && node.pos;

  const content = (
    <>
      {moved && (
        <p className="text-sm">
          Moved from position <span className="font-semibold">{node.pos!.a}</span> in A to position{" "}
          <span className="font-semibold">{node.pos!.b}</span> in B
        </p>
      )}
      {hasFields && <FieldTable node={node} pairs={pairs} focusId={focusId} options={options} />}
      {(list || rules) && <EntryTable node={node} depth={depth} focusId={focusId} options={options} />}
      {kids.length > 0 && (
        <div className="space-y-2">
          {kids.map((c) => (
            <NodeBlock key={c.id} node={c} depth={depth + 1} focusId={focusId} options={options} whole={whole} />
          ))}
        </div>
      )}
      {options.changesOnly && node.status === "modified" && same > 0 && (
        <button type="button" className="text-xs text-side-b hover:underline" onClick={() => setShowSame(!showSame)}>
          {showSame ? "Hide unchanged items" : `Show ${same} unchanged ${same === 1 ? "item" : "items"}`}
        </button>
      )}
    </>
  );

  // A wrapper without a name of its own (Policy, RuleList, AttributeList, ResultList, ...) is not
  // a box: a small caption, then its content inline in the parent box.
  if (depth > 0 && !section && node.label === node.name && !node.pos) {
    return (
      <div id={`node-${node.id}`} className={`space-y-1.5 ${focused ? "rounded ring-2 ring-accent/40" : ""}`}>
        <div className="flex items-center gap-2 border-b border-line pb-0.5 text-xs font-semibold text-muted">
          <span className="min-w-0 flex-1">{[...via, node].map((v) => v.name).join(" › ")}</span>
          {node.status === "modified" && <Counts stats={node.stats} />}
        </div>
        {content}
      </div>
    );
  }

  const body = open && (hasFields || list || rules || moved || kids.length > 0 || same > 0) && (
    <div className="space-y-2 border-t border-line px-3 py-2">{content}</div>
  );

  return (
    <div
      id={`node-${node.id}`}
      className={`overflow-hidden rounded-lg border bg-surface ${focused ? "border-accent ring-2 ring-accent/40" : "border-line"}`}
    >
      {header}
      {body}
    </div>
  );
}

/**
 * Position in an ordered list. A moved entry says where it is on each side ("#2 in A → #1 in B");
 * inside a list table it just says "Moved", since the A and B cells carry their own positions.
 */
function Position({ node, index, inTable }: { node: DiffNode; index?: number; inTable?: boolean }) {
  const move = moveText(node);
  if (move && inTable) {
    return (
      <span className="rounded bg-mod-bg px-1.5 py-0.5 text-xs font-semibold text-mod" title={`Moved: ${move}`}>
        Moved
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs">
      <span className="text-muted">{node.pos ? positionText(node) : `#${(index ?? 0) + 1}`}</span>
      {move && <span className="rounded bg-mod-bg px-1.5 py-0.5 font-sans font-semibold text-mod">Moved: {move}</span>}
    </span>
  );
}

/**
 * The one table for lists: text lists and ordered lists (rules) alike. Rows follow positions when
 * the list was only reordered, so a swap reads as a swap (see entryRows).
 * Colors: A red = old / only in A, B green = new / only in B, amber = a different entry sits here
 * on the other side (reordered). Rule rows unfold to the rules' full detail.
 */
function EntryTable({
  node,
  depth,
  focusId,
  options,
}: {
  node: DiffNode;
  depth: number;
  focusId?: string;
  options: ViewOptions;
}) {
  const textList = isTextList(node);
  const { rows, byPosition } = useMemo(() => entryRows(node), [node]);
  const key = (r: EntryRow) => `${r.a?.id ?? ""}|${r.b?.id ?? ""}`;
  const inside = (c?: DiffNode) => c !== undefined && focusId !== undefined && focusId.startsWith(`${c.id}/`);
  const [unfolded, setUnfolded] = useState<Set<string>>(
    () => new Set(rows.filter((r) => inside(r.a) || inside(r.b)).map(key)),
  );
  const toggle = (k: string) =>
    setUnfolded((s) => {
      const next = new Set(s);
      if (!next.delete(k)) next.add(k);
      return next;
    });
  // One-line entries with fields (conditions, results, profile attributes) list their fields,
  // like a Field table; rules (entries with parts) show their IF … THEN summary.
  const fielded = !textList && node.children.every((c) => c.children.length === 0);
  const text = (c: DiffNode | undefined, s: "a" | "b") => {
    if (!c) return undefined;
    if (textList) return c.text?.[s];
    if (fielded) {
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          {entryFields(c, s).map((f) => (
            <Fragment key={f.name}>
              <dt className="font-mono text-muted">{f.name}</dt>
              <dd className={`font-mono break-all ${c.status === "modified" && f.changed ? "font-semibold" : ""}`}>
                {f.secret && !options.showSecrets ? "••••••" : f.value === "" ? <span className="text-muted italic">(empty)</span> : f.value}
              </dd>
            </Fragment>
          ))}
        </dl>
      );
    }
    return unnumbered(displayLabel(c, options.showSecrets, s), c.kind);
  };
  // Changed content (not just a new position).
  const content = (c?: DiffNode) => c?.status === "modified" && total(c.stats) - (c.moved ? 1 : 0) > 0;
  const cellColor = (c: DiffNode | undefined, aligned: boolean, s: "a" | "b") => {
    if (!c) return "";
    if (c.status === (s === "a" ? "removed" : "added")) return s === "a" ? "bg-del-bg" : "bg-add-bg";
    if (content(c)) return s === "a" ? "bg-del-bg" : "bg-add-bg";
    return aligned && !c.moved ? "" : "bg-mod-bg";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-44" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-2 font-medium">Field</th>
            <th className="truncate px-2 py-1 font-medium">
              <span className="font-semibold text-side-a">A</span> · {options.labels.a}
            </th>
            <th className="truncate px-2 py-1 font-medium">
              <span className="font-semibold text-side-b">B</span> · {options.labels.b}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const k = key(r);
            const aligned = r.a === r.b;
            const isOpen = unfolded.has(k);
            const font = textList ? "font-mono" : "";
            // Row number; an entry-aligned row whose entry moved says "Moved" (its cells carry each side's position).
            const movedEntry = !byPosition && (r.b ?? r.a)!.moved;
            const label = movedEntry ? (
              <Position node={(r.b ?? r.a)!} index={i} inTable />
            ) : (
              <span className="font-mono text-xs text-muted">#{i + 1}</span>
            );
            // In entry-aligned rows a moved entry shows its own position on each side.
            const sidePos = (s: "a" | "b") => {
              const c = r[s];
              return !byPosition && c?.moved && c.pos?.[s] !== undefined ? (
                <span className="mr-1.5 font-mono font-semibold">#{c.pos[s]}</span>
              ) : null;
            };
            const details = [...new Set([r.a, r.b])].filter((c): c is DiffNode => c !== undefined);
            const focused = focusId !== undefined && (r.a?.id === focusId || r.b?.id === focusId);
            return (
              <Fragment key={k}>
                <tr
                  id={`node-${(r.b ?? r.a)!.id}`}
                  className={`align-top ${focused ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
                >
                  <td className="py-1 pr-2 pl-1">
                    {textList || fielded ? (
                      label
                    ) : (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggle(k)}
                        className="flex items-center gap-1 text-left"
                        title="Show details"
                      >
                        <svg viewBox="0 0 16 16" className={`size-3 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} fill="currentColor">
                          <path d="M6 3l5 5-5 5z" />
                        </svg>
                        {label}
                      </button>
                    )}
                  </td>
                  <td className={`px-2 py-1 text-xs break-words ${font} ${cellColor(r.a, aligned, "a")}`}>
                    {r.a && r.a.status === "removed" && r.b && <span id={`node-${r.a.id}`} />}
                    {sidePos("a")}
                    {text(r.a, "a")}
                  </td>
                  <td className={`px-2 py-1 text-xs break-words ${font} ${cellColor(r.b, aligned, "b")}`}>
                    {sidePos("b")}
                    {text(r.b, "b")}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={3} className="space-y-2 pt-1 pb-2">
                      {details.map((c) => (
                        <NodeBlock key={c.id} node={c} depth={depth + 1} focusId={focusId} options={options} whole />
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ROW_BG: Record<DiffStatus, string> = {
  added: "bg-add-bg",
  removed: "bg-del-bg",
  modified: "",
  unchanged: "",
};

function FieldTable({
  node,
  pairs,
  focusId,
  options,
}: {
  node: DiffNode;
  pairs: DiffNode[];
  focusId?: string;
  options: ViewOptions;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = [...fieldRows(node), ...pairs.map(pairRow)];
  const changed = rows.filter((r) => r.status !== "unchanged");
  const unchanged = rows.filter((r) => r.status === "unchanged");
  const collapsible = node.status === "modified" && options.changesOnly && unchanged.length > 0;
  // Always in document order, so fields read the same as the XML.
  const shown = collapsible && !showAll ? changed : rows;
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      {shown.length > 0 && (
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-44" />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 pr-2 font-medium">Field</th>
              <th className="truncate px-2 py-1 font-medium">
                <span className="font-semibold text-side-a">A</span> · {options.labels.a}
              </th>
              <th className="truncate px-2 py-1 font-medium">
                <span className="font-semibold text-side-b">B</span> · {options.labels.b}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const masked = r.secret && !options.showSecrets;
              const mod = r.status === "modified";
              return (
                <tr
                  key={r.id ?? r.name}
                  id={r.id ? `node-${r.id}` : undefined}
                  className={`align-top ${ROW_BG[r.status]} ${r.status === "unchanged" ? "text-muted" : ""} ${
                    r.id && r.id === focusId ? "outline-2 -outline-offset-2 outline-accent" : ""
                  }`}
                >
                  <td className="truncate py-1 pr-2 pl-1 font-mono text-xs text-muted" title={r.name}>
                    {r.name}
                  </td>
                  <td className={`px-2 py-1 ${mod ? "bg-del-bg" : ""}`}>
                    <Value v={r.a} raw={r.raw?.a} secret={masked} />
                  </td>
                  <td className={`px-2 py-1 ${mod ? "bg-add-bg" : ""}`}>
                    <Value v={r.b} raw={r.raw?.b} secret={masked} />
                    {masked && mod && <span className="ml-1 text-xs text-mod">(values differ)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {collapsible && (
        <button type="button" className="mt-1 text-xs text-side-b hover:underline" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Hide unchanged fields" : `Show ${unchanged.length} unchanged ${unchanged.length === 1 ? "field" : "fields"}`}
        </button>
      )}
    </div>
  );
}

function Value({ v, raw, secret }: { v?: string; raw?: string; secret?: boolean }) {
  if (v === undefined) return <span className="text-muted">—</span>;
  if (secret) return <span className="font-mono text-xs tracking-widest text-muted">••••••</span>;
  if (v === "") return <span className="text-xs text-muted italic">(empty)</span>;
  return (
    <div className="max-h-32 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">
      {v}
      {raw !== undefined && raw !== v && <span className="ml-1 text-muted">({raw})</span>}
    </div>
  );
}
