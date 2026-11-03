import type { DiffNode } from "@twincheck/core";
import { useMemo } from "react";
import { total, visibleIds } from "../lib/tree";
import { Counts, StatusDot } from "./Status";

interface Props {
  root: DiffNode;
  selectedId?: string;
  expanded: Set<string>;
  changesOnly: boolean;
  query: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export function TreeNav({ root, selectedId, expanded, changesOnly, query, onSelect, onToggle }: Props) {
  const visible = useMemo(() => visibleIds(root, changesOnly, query), [root, changesOnly, query]);
  const forceOpen = query.trim() !== "";

  const row = (n: DiffNode, depth: number) => {
    if (!visible.has(n.id)) return null;
    const kids = n.children.filter((c) => visible.has(c.id));
    const open = forceOpen || expanded.has(n.id);
    return (
      <li key={n.id}>
        <div
          className={`flex cursor-pointer items-center gap-1.5 rounded py-1 pr-2 text-sm hover:bg-surface-2 ${
            selectedId === n.id ? "bg-surface-2 font-semibold" : ""
          }`}
          style={{ paddingLeft: depth * 14 + 4 }}
          onClick={() => onSelect(n.id)}
          title={`${n.kind}: ${n.label}`}
        >
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            className={`flex size-4 shrink-0 items-center justify-center text-muted ${kids.length ? "" : "invisible"}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(n.id);
            }}
          >
            <svg viewBox="0 0 16 16" className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} fill="currentColor">
              <path d="M6 3l5 5-5 5z" />
            </svg>
          </button>
          <StatusDot status={n.status} />
          <span className="min-w-0 flex-1 truncate">{n.label}</span>
          {n.status === "modified" && total(n.stats) > 0 && <Counts stats={n.stats} />}
        </div>
        {open && kids.length > 0 && <ul>{kids.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  const top = root.children.filter((c) => visible.has(c.id));
  if (top.length === 0) {
    return <p className="p-4 text-sm text-muted">{query ? "No items match your search" : "No items"}</p>;
  }
  return <ul className="p-1">{top.map((c) => row(c, 0))}</ul>;
}
