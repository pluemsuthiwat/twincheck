/** Format-neutral tree. Every format adapter (XML, JSON, ...) converts its input into this shape. */
export interface TNode {
  name: string;
  attrs: Record<string, string>;
  text?: string;
  children: TNode[];
}

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface AttrDiff {
  name: string;
  a?: string;
  b?: string;
  status: DiffStatus;
  /** Value should be masked when displayed. */
  secret?: boolean;
}

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
}

export interface DiffNode {
  /** Path of identity keys; unique within one diff result. */
  id: string;
  /** Element name, e.g. "EnforcementPolicy". */
  name: string;
  /** Human-readable label, e.g. the object's configured name. */
  label: string;
  /** A's label, only when it differs from `label` (which is B's for matched nodes). */
  labelA?: string;
  /** Human-readable type, e.g. "Enforcement Policy". */
  kind: string;
  status: DiffStatus;
  /** Position changed inside an ordered list. */
  moved?: boolean;
  /** 1-based position among same-name siblings, only for ordered lists. */
  pos?: { a?: number; b?: number };
  attrs: AttrDiff[];
  text?: { a?: string; b?: string; status: DiffStatus };
  children: DiffNode[];
  stats: DiffStats;
}
