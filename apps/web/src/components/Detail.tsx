import { collectChanges, type AttrDiff, type DiffNode, type DiffStatus } from "@twincheck/core";
import { useEffect, useMemo, useState } from "react";
import { objectCounts } from "../lib/tree";
import { Counts, StatusBadge } from "./Status";

export interface ViewOptions {
  changesOnly: boolean;
  showSecrets: boolean;
  labels: { a: string; b: string };
}

const ROW_BG: Record<DiffStatus, string> = {
  added: "bg-add-bg",
  removed: "bg-del-bg",
  modified: "bg-mod-bg",
  unchanged: "",
};

/** Landing view: every change point, grouped by ClearPass category. */
export function Overview({ root, onOpen }: { root: DiffNode; onOpen: (objectId: string, focusId: string) => void }) {
  const groups = useMemo(() => {
    const map = new Map<DiffNode, ReturnType<typeof collectChanges>>();
    for (const c of collectChanges(root)) {
      const cat = c.trail[0] ?? c.node;
      map.set(cat, [...(map.get(cat) ?? []), c]);
    }
    return [...map];
  }, [root]);

  if (groups.length === 0) {
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

  const all = groups.flatMap(([, c]) => c);
  const cards: [string, number, string][] = [
    ["Total differences", all.length, "text-ink"],
    ["Only in A", all.filter((c) => c.node.status === "removed").length, "text-del"],
    ["Only in B", all.filter((c) => c.node.status === "added").length, "text-add"],
    ["Changed / moved", all.filter((c) => c.node.status === "modified").length, "text-mod"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map(([label, n, cls]) => (
          <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2">
            <div className={`text-2xl font-bold tabular-nums ${cls}`}>{n}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>
      {groups.map(([cat, changes]) => (
        <section key={cat.id}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            {cat.label}
            <Counts stats={cat.children.length ? objectCounts(cat) : cat.stats} />
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {changes.map(({ node, trail }) => {
              const object = trail[1] ?? node;
              const path = trail.slice(1).map((t) => t.label);
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-surface-2"
                    onClick={() => onOpen(object.id, node.id)}
                  >
                    <StatusBadge status={node.status} moved={node.moved} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        <span className="text-muted">{node.kind} · </span>
                        {node.label}
                      </span>
                      {path.length > 0 && <span className="block truncate text-xs text-muted">{path.join(" › ")}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
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
    <div>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
        <button type="button" className="hover:text-ink" onClick={() => onSelect("")}>
          Overview
        </button>
        {trail.slice(1).map((t) => (
          <span key={t.id} className="flex min-w-0 items-center gap-1">
            <span>›</span>
            <button type="button" className="max-w-64 truncate hover:text-ink" onClick={() => onSelect(t.id)}>
              {t.label}
            </button>
          </span>
        ))}
      </nav>
      <NodeBlock node={node} depth={0} focusId={focusId} options={options} />
    </div>
  );
}

function NodeBlock({ node, depth, focusId, options }: { node: DiffNode; depth: number; focusId?: string; options: ViewOptions }) {
  const [open, setOpen] = useState(depth === 0 || node.status !== "unchanged" || !options.changesOnly);
  const [showSame, setShowSame] = useState(false);
  const container = node.attrs.length === 0 && node.text === undefined;
  const changed = node.children.filter((c) => c.status !== "unchanged");
  const same = node.children.length - changed.length;
  const kids = options.changesOnly && !showSame && node.status === "modified" ? changed : node.children;
  const focused = focusId === node.id;

  const header = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex w-full items-center gap-2 text-left ${container && depth > 0 ? "py-1" : "px-3 py-2"}`}
    >
      <svg viewBox="0 0 16 16" className={`size-3 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} fill="currentColor">
        <path d="M6 3l5 5-5 5z" />
      </svg>
      <span className={`min-w-0 flex-1 ${depth === 0 ? "text-base font-semibold" : "text-sm"}`}>
        {node.kind !== node.label && <span className="text-muted">{node.kind} · </span>}
        <span className="break-words">{node.label}</span>
      </span>
      {node.pos && (node.pos.a !== node.pos.b || node.status !== "modified") && (
        <span className="shrink-0 font-mono text-xs text-muted">
          {node.pos.a !== undefined && <span className="text-side-a">A#{node.pos.a}</span>}
          {node.pos.a !== undefined && node.pos.b !== undefined && " → "}
          {node.pos.b !== undefined && <span className="text-side-b">B#{node.pos.b}</span>}
        </span>
      )}
      <StatusBadge status={node.status} moved={node.moved} />
    </button>
  );

  const body = open && (
    <div className={container && depth > 0 ? "" : "border-t border-line px-3 py-2"}>
      {!container && <AttrTable node={node} options={options} />}
      {kids.length > 0 && (
        <div className={`space-y-2 ${container ? "" : "mt-2"} border-l-2 border-line pl-3`}>
          {kids.map((c) => (
            <NodeBlock key={c.id} node={c} depth={depth + 1} focusId={focusId} options={options} />
          ))}
        </div>
      )}
      {options.changesOnly && node.status === "modified" && same > 0 && (
        <button type="button" className="mt-2 text-xs text-side-b hover:underline" onClick={() => setShowSame(!showSame)}>
          {showSame ? "Hide unchanged items" : `Show ${same} unchanged ${same === 1 ? "item" : "items"}`}
        </button>
      )}
    </div>
  );

  return (
    <div
      id={`node-${node.id}`}
      className={
        container && depth > 0
          ? ""
          : `rounded-lg border bg-surface ${focused ? "border-accent ring-2 ring-accent/40" : "border-line"}`
      }
    >
      {header}
      {body}
    </div>
  );
}

function AttrTable({ node, options }: { node: DiffNode; options: ViewOptions }) {
  const rows: AttrDiff[] = [...node.attrs];
  if (node.text) rows.push({ name: "(text)", ...node.text });
  if (rows.length === 0) return null;
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
            <th className="px-2 py-1 font-medium">
              <span className="text-side-a">A</span> · {options.labels.a}
            </th>
            <th className="px-2 py-1 font-medium">
              <span className="text-side-b">B</span> · {options.labels.b}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={`align-top ${ROW_BG[r.status]}`}>
              <td className="truncate py-1 pr-2 pl-1 font-mono text-xs text-muted" title={r.name}>
                {r.name}
              </td>
              <td className="px-2 py-1">
                <Value v={r.a} secret={r.secret && !options.showSecrets} />
              </td>
              <td className="px-2 py-1">
                <Value v={r.b} secret={r.secret && !options.showSecrets} />
                {r.secret && !options.showSecrets && r.status === "modified" && (
                  <span className="ml-1 text-xs text-mod">(values differ)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Value({ v, secret }: { v?: string; secret?: boolean }) {
  if (v === undefined) return <span className="text-muted">—</span>;
  if (secret) return <span className="font-mono text-xs tracking-widest text-muted">••••••</span>;
  if (v === "") return <span className="text-xs text-muted italic">(empty)</span>;
  return <div className="max-h-32 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">{v}</div>;
}
