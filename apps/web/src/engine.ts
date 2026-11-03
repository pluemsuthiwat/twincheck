import { canonicalize, diffTrees, genericProfile, pickProfile, type DiffNode, type Profile } from "@twincheck/core";
import { parseXml, serializeXml } from "@twincheck/format-xml";
import { clearpassProfile } from "@twincheck/profile-clearpass";

export const PROFILES: Profile[] = [clearpassProfile, genericProfile];

export interface CompareRequest {
  a: string;
  b: string;
  /** Profile id, or "auto" to detect from the documents. */
  profile: string;
}

export interface CompareResult {
  profile: { id: string; name: string };
  root: DiffNode;
  /** Canonical XML (sorted, ignored fields removed) for the raw view. */
  normalized: { a: string; b: string };
  ms: number;
}

export class CompareError extends Error {
  constructor(
    message: string,
    readonly side?: "a" | "b",
  ) {
    super(message);
  }
}

function parseSide(text: string, side: "a" | "b") {
  try {
    return parseXml(text);
  } catch (e) {
    throw new CompareError((e as Error).message, side);
  }
}

export function compare(req: CompareRequest): CompareResult {
  const started = performance.now();
  const a = parseSide(req.a, "a");
  const b = parseSide(req.b, "b");
  const profile =
    req.profile === "auto"
      ? pickProfile(PROFILES, a, b)
      : (PROFILES.find((p) => p.id === req.profile) ?? genericProfile);
  const root = diffTrees(a, b, profile);
  const normalized = {
    a: serializeXml(canonicalize(a, profile)),
    b: serializeXml(canonicalize(b, profile)),
  };
  return { profile: { id: profile.id, name: profile.name }, root, normalized, ms: performance.now() - started };
}
