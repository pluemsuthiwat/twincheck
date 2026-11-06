import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalize, collectChanges, diffTrees, pickProfile } from "@twincheck/core";
import { parseXml, serializeXml } from "@twincheck/format-xml";
import { clearpassProfile } from "../src";

const fixture = (name: string) =>
  parseXml(readFileSync(fileURLToPath(new URL(`../../../fixtures/clearpass/${name}`, import.meta.url)), "utf8"));

const base = fixture("service-export-base.xml");
const ruleAdded = fixture("service-export-rule-added.xml");

describe("ClearPass profile", () => {
  it("is detected from the TIPS root element", () => {
    expect(pickProfile([clearpassProfile], base, ruleAdded).id).toBe("clearpass");
  });

  it("reports an identical export as unchanged", () => {
    expect(diffTrees(base, base, clearpassProfile).status).toBe("unchanged");
  });

  it("finds exactly the one added rule despite reordered services and profiles", () => {
    const changes = collectChanges(diffTrees(base, ruleAdded, clearpassProfile));
    expect(changes).toHaveLength(1);
    const [{ node, trail }] = changes;
    expect(node).toMatchObject({ status: "added", kind: "Rule", pos: { b: 3 } });
    expect(node.label).toBe("Rule 3: IF Application:SSO-SP EQUALS q123 THEN Enforcement-Profile = [Allow Access Profile]");
    expect(trail.map((t) => t.label)).toEqual([
      "Enforcement Policies",
      "SUTHIWAT-DOT1X-ENFORCEMENT-POLICY",
      "Policy",
      "RuleList",
    ]);
  });

  it("masks known secret fields", () => {
    const d = diffTrees(base, base, clearpassProfile);
    const secrets = new Set<string>();
    const walk = (n: typeof d) => {
      for (const a of n.attrs) if (a.secret) secrets.add(`${n.name}@${a.name}`);
      n.children.forEach(walk);
    };
    walk(d);
    expect([...secrets].sort()).toEqual(
      expect.arrayContaining([
        "ContextServer@password",
        "NVPair@value",
        "Proxy@secret",
        "ServiceCertificate@privateKey",
        "ServiceCertificate@privateKeyPassword",
      ]),
    );
    expect(secrets.has("AdminPrivilege@allowPasswords")).toBe(false);
  });

  it("canonical text differs only by the added rule", () => {
    const lines = (t: typeof base) => serializeXml(canonicalize(t, clearpassProfile)).split("\n");
    const a = lines(base);
    const b = lines(ruleAdded);
    expect(b.length - a.length).toBe(12);
    const extra = b.filter((l, i) => l !== a[i]);
    expect(extra.join("\n")).toContain('value="q123"');
  });

  it("marks a NAD group's members as a list field", () => {
    const tips = (members: string) =>
      parseXml(`<TipsContents><NadGroups><NadGroup members="${members}" name="G" description=""/></NadGroups></TipsContents>`);
    const group = diffTrees(tips("10.0.0.1, 10.0.0.2"), tips("10.0.0.1, 10.0.0.3"), clearpassProfile).children[0].children[0];
    expect(group.attrs.find((a) => a.name === "members")).toMatchObject({ status: "modified", list: true });
    expect(group.attrs.find((a) => a.name === "description")?.list).toBeUndefined();
  });
});
