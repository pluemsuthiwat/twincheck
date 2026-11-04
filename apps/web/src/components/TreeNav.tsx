import type { DiffNode } from "@twincheck/core";
import { useMemo } from "react";
import { displayLabel, total, visibleIds } from "../lib/tree";
import { Counts, FolderIcon, StatusDot } from "./Status";

interface Props {
  root: DiffNode;
  selectedId?: string;
  expanded: Set<string>;
  changesOnly: boolean;
  query: string;
  showSecrets: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export function TreeNav({ root, selectedId, expanded, changesOnly, query, showSecrets, onSelect, onToggle }: Props) {
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
          } ${depth === 0 ? "mt-1" : ""}`}
          style={{ paddingLeft: depth * 14 + 4 }}
          onClick={() => onSelect(n.id)}
          title={`${n.kind}: ${displayLabel(n, showSecrets)}`}
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
          {depth === 0 ? <FolderIcon /> : <StatusDot status={n.status} />}
          <span className={`min-w-0 flex-1 truncate ${depth === 0 ? "font-semibold" : ""}`}>
            {displayLabel(n, showSecrets)}
          </span>
          {total(n.stats) > 0 && (
            <Counts
              stats={n.stats}
              title={
                n.status === "modified"
                  ? "All changes inside, at any depth: only in B / only in A / changed or moved"
                  : `Only in ${n.status === "added" ? "B" : "A"}: counts as one change, including everything inside`
              }
            />
          )}
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
