import type { DiffNode } from "./types";

export interface ChangePoint {
  node: DiffNode;
  /** Ancestors from the root's child down to the parent of `node`. */
  trail: DiffNode[];
}

/** Changes carried by the node itself, not by its descendants. */
export function ownChangeCount(n: DiffNode): number {
  if (n.status === "added" || n.status === "removed") return 1;
  let count = n.attrs.filter((a) => a.status !== "unchanged").length;
  if (n.text && n.text.status !== "unchanged") count++;
  if (n.moved) count++;
  return count;
}

/** Every place where something actually changed: added/removed subtrees and nodes with own changes. */
export function collectChanges(root: DiffNode): ChangePoint[] {
  const out: ChangePoint[] = [];
  const walk = (n: DiffNode, trail: DiffNode[]) => {
    if (n.status === "unchanged") return;
    if (ownChangeCount(n) > 0) out.push({ node: n, trail });
    if (n.status === "added" || n.status === "removed") return;
    for (const c of n.children) walk(c, [...trail, n]);
  };
  if (ownChangeCount(root) > 0) out.push({ node: root, trail: [] });
  for (const c of root.children) walk(c, []);
  return out;
}
