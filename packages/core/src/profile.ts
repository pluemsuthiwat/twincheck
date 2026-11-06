import { attrPath, compilePattern } from "./path";
import type { TNode } from "./types";

/** How to treat elements whose path matches `match`. Later matching rules override earlier ones. */
export interface ElementRule {
  /** Element path pattern, e.g. `**\/RuleList/Rule`. */
  match: string;
  /** Identity among siblings. Return undefined to fall back to the default heuristics. */
  key?: (n: TNode) => string | undefined;
  /** Sibling order is meaningful (e.g. first-applicable rules, auth source lookup order). */
  ordered?: boolean;
  /** `pos` is the 1-based position among same-name siblings. */
  label?: (n: TNode, pos: number) => string;
  kind?: string;
  /** Attributes left out of the comparison for this element, e.g. instance-specific IDs. */
  ignoreAttrs?: (n: TNode) => string[];
  /** Attributes holding a comma-separated list, e.g. a NAD group's `members`. */
  listAttrs?: string[];
}

export interface Profile {
  id: string;
  name: string;
  detect?: (root: TNode) => boolean;
  /** Element or attribute path patterns excluded from the comparison, e.g. `**\/@exportTime`. */
  ignore?: string[];
  /** Extra secret detection on top of {@link looksSecret}. */
  isSecret?: (n: TNode, attr: string) => boolean;
  rules?: ElementRule[];
}

export interface ResolvedRule {
  key?: (n: TNode) => string | undefined;
  ordered: boolean;
  label?: (n: TNode, pos: number) => string;
  kind?: string;
  ignoreAttrs?: (n: TNode) => string[];
  listAttrs?: string[];
}

const SECRET_NAME = /(^|[-_.])(password|passwd|secret|private_?key)$/i;
const SECRET_CAMEL = /[a-z](Password|Passwd|Secret|PrivateKey)$/;

/** Name heuristics for secret fields: `password`, `client_secret`, `privateKeyPassword`, ... */
export function looksSecret(name: string): boolean {
  return SECRET_NAME.test(name) || SECRET_CAMEL.test(name);
}

export class CompiledProfile {
  private readonly ignorePatterns: RegExp[];
  private readonly rules: { re: RegExp; rule: ElementRule }[];
  private readonly cache = new Map<string, ResolvedRule>();

  constructor(readonly profile: Profile) {
    this.ignorePatterns = (profile.ignore ?? []).map(compilePattern);
    this.rules = (profile.rules ?? []).map((rule) => ({ re: compilePattern(rule.match), rule }));
  }

  rule(path: string): ResolvedRule {
    let resolved = this.cache.get(path);
    if (!resolved) {
      resolved = { ordered: false };
      for (const { re, rule } of this.rules) {
        if (re.test(path)) resolved = { ...resolved, ...rule };
      }
      this.cache.set(path, resolved);
    }
    return resolved;
  }

  ignored(path: string): boolean {
    return this.ignorePatterns.some((re) => re.test(path));
  }

  /** Attributes that take part in the comparison, in document order. */
  comparableAttrs(n: TNode, path: string): string[] {
    const skip = this.rule(path).ignoreAttrs?.(n) ?? [];
    return Object.keys(n.attrs).filter((k) => !skip.includes(k) && !this.ignored(attrPath(path, k)));
  }

  list(path: string, attr: string): boolean {
    return this.rule(path).listAttrs?.includes(attr) ?? false;
  }

  secret(n: TNode, attr: string): boolean {
    if (looksSecret(attr)) return true;
    // name/value pair style: <NVPair name="password" value="..."/>
    if (attr === "value" && n.attrs.name !== undefined && looksSecret(n.attrs.name)) return true;
    return this.profile.isSecret?.(n, attr) ?? false;
  }
}

export const genericProfile: Profile = {
  id: "generic",
  name: "Generic XML",
};

/** First profile that recognises both documents, otherwise the generic one. */
export function pickProfile(profiles: Profile[], a: TNode, b: TNode): Profile {
  return profiles.find((p) => p.detect?.(a) && p.detect?.(b)) ?? genericProfile;
}
