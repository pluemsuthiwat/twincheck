import { describe, expect, it } from "vitest";
import { diffTrees, type Profile, type TNode } from "@twincheck/core";
import { displayLabel, entryFields, entryRows, fieldRows, groupChanges, innerPath, isEntryList, isNameValuePair, isOrderedList, isTextList, moveText, pairRow, positionText, unnumbered } from "../src/lib/tree";

const el = (name: string, attrs: Record<string, string> = {}, ...children: TNode[]): TNode => ({ name, attrs, children });

const profile: Profile = {
  id: "t",
  name: "t",
  rules: [
    { match: "Root/Cat", label: () => "Category" },
    { match: "**/Rule", ordered: true, label: (n, ord) => `Rule ${ord}` },
  ],
};

const a = el(
  "Root",
  {},
  el(
    "Cat",
    {},
    el("Obj", { name: "svc", enabled: "true" }, el("List", {}, el("Rule", {}, el("Cond", { value: "Lab", displayValue: "Lab" })))),
    el("Obj", { name: "gone" }),
  ),
);
const b = el(
  "Root",
  {},
  el(
    "Cat",
    {},
    el("Obj", { name: "svc", enabled: "false" }, el("List", {}, el("Rule", {}, el("Cond", { value: "Lab-2", displayValue: "Lab-2" })))),
    el("Obj", { name: "new" }),
  ),
);

describe("overview helpers", () => {
  const root = diffTrees(a, b, profile);

  it("groups change points by category, then object", () => {
    const [cat] = groupChanges(root);
    expect(cat.category.label).toBe("Category");
    expect(cat.objects.map((o) => `${o.object.status} ${o.object.label} ×${o.changes.length}`)).toEqual([
      "modified svc ×2",
      "added new ×1",
      "removed gone ×1",
    ]);
  });

  it("drops unnamed containers from the path inside an object", () => {
    const svc = groupChanges(root)[0].objects[0];
    const deep = svc.changes.find((c) => c.node.name === "Cond")!;
    expect(innerPath(deep.trail).map((n) => n.label)).toEqual(["Rule 1"]);
  });

  it("folds value + displayValue into one row when both changed", () => {
    const cond = groupChanges(root)[0].objects[0].changes.find((c) => c.node.name === "Cond")!.node;
    expect(fieldRows(cond).map((r) => `${r.name}: ${r.a} → ${r.b}`)).toEqual(["value: Lab → Lab-2"]);
  });

  it("keeps both rows when only one of the pair changed, and shows raw values that differ", () => {
    const one = diffTrees(
      el("R", {}, el("C", { value: "19", displayValue: "Wireless (19)" })),
      el("R", {}, el("C", { value: "19", displayValue: "Wi-Fi (19)" })),
      profile,
    ).children[0];
    expect(fieldRows(one).map((r) => r.name)).toEqual(["value", "displayValue"]);
    const both = diffTrees(
      el("R", {}, el("C", { value: "19", displayValue: "Wireless (19)" })),
      el("R", {}, el("C", { value: "15", displayValue: "Ethernet (15)" })),
      profile,
    ).children[0];
    expect(fieldRows(both)).toEqual([expect.objectContaining({ name: "value", a: "Wireless (19)", raw: { a: "19", b: "15" } })]);
  });

  it("masks secret values embedded in labels", () => {
    const n = diffTrees(el("R", {}, el("P", { name: "secret-thing", secret: "hunter22" })), el("R", {}, el("P", { name: "secret-thing", secret: "hunter22" })), {
      id: "t",
      name: "t",
      rules: [{ match: "**/P", label: (x) => `${x.attrs.name} = ${x.attrs.secret}` }],
    }).children[0];
    expect(displayLabel(n, false)).toBe("secret-thing = ••••••");
    expect(displayLabel(n, true)).toBe("secret-thing = hunter22");
  });

  it("turns name/value leaves into field rows of their parent", () => {
    const src = (port: string, extra?: TNode) =>
      el("R", {}, el("Src", { name: "ldap" }, el("NVPair", { name: "port", value: port }), el("NVPair", { name: "password", value: "x" }), ...(extra ? [extra] : [])));
    const d = diffTrees(src("1636"), src("636", el("NVPair", { name: "timeout", value: "30" })), profile).children[0];
    const [port, password, timeout] = d.children;
    expect(d.children.every(isNameValuePair)).toBe(true);
    expect(pairRow(port)).toMatchObject({ name: "port", a: "1636", b: "636", status: "modified" });
    expect(pairRow(password)).toMatchObject({ name: "password", status: "unchanged", secret: true });
    expect(pairRow(timeout)).toMatchObject({ name: "timeout", a: undefined, b: "30", status: "added" });
    expect(isNameValuePair(d)).toBe(false);
  });

  it("tells text lists and ordered rule lists apart, and labels positions", () => {
    const list = (...xs: string[]) => el("R", {}, el("List", {}, ...xs.map((x) => ({ name: "string", attrs: {}, text: x, children: [] }))));
    const texts = diffTrees(list("pap", "fast"), list("pap", "mschap"), profile).children[0];
    expect(isTextList(texts)).toBe(true);
    expect(isOrderedList(texts)).toBe(false);

    const rules = (...vs: string[]) => el("R", {}, el("List", {}, ...vs.map((v) => el("Rule", {}, el("Cond", { v })))));
    const moved = diffTrees(rules("android", "windows", "mac"), rules("windows", "android", "mac"), profile).children[0];
    expect(isOrderedList(moved)).toBe(true);
    // Only the rule that was actually moved says so; the one it pushed down does not.
    expect(moved.children.map((c) => [positionText(c), moveText(c)])).toEqual([
      ["#1", "#2 in A → #1 in B"],
      ["#2", undefined],
      ["#3", undefined],
    ]);
    expect(unnumbered("Rule 2: Device-Name BEGINS_WITH Windows", "Rule")).toBe("Device-Name BEGINS_WITH Windows");
    expect(unnumbered("Rule 2: x", "Condition")).toBe("Rule 2: x");
  });

  it("lays out a pure reorder by position, so a swap reads 1|2, 2|1", () => {
    const rules = (...vs: string[]) => el("R", {}, el("List", {}, ...vs.map((v) => el("Rule", {}, el("Cond", { v })))));
    const v = (n?: { children: { attrs: { name: string; a?: string; b?: string }[] }[] }, s: "a" | "b" = "b") =>
      n?.children[0].attrs[0][s] ?? "-";
    const swap = entryRows(diffTrees(rules("1", "2", "3", "4"), rules("2", "1", "3", "4"), profile).children[0]);
    expect(swap.byPosition).toBe(true);
    expect(swap.rows.map((r) => `${v(r.a, "a")} | ${v(r.b)}`)).toEqual(["1 | 2", "2 | 1", "3 | 3", "4 | 4"]);

    // Something added at the end keeps the positional layout.
    const tail = entryRows(diffTrees(rules("1", "2"), rules("2", "1", "new"), profile).children[0]);
    expect(tail.rows.map((r) => `${v(r.a, "a")} | ${v(r.b)}`)).toEqual(["1 | 2", "2 | 1", "- | new"]);

    // Inserted mid-list: positional rows would misalign everything after it, so pair entries.
    const mid = entryRows(diffTrees(rules("1", "2", "3"), rules("1", "new", "2", "3"), profile).children[0]);
    expect(mid.byPosition).toBe(false);
    expect(mid.rows.map((r) => `${v(r.a, "a")} | ${v(r.b)}`)).toEqual(["1 | 1", "- | new", "2 | 2", "3 | 3"]);
  });

  it("treats a list of labeled leaves (conditions) as one entry list, but not name/value settings", () => {
    const p: Profile = { id: "t", name: "t", rules: [{ match: "**/Cond", label: (n) => `${n.attrs.name} EQUALS ${n.attrs.value}` }] };
    const conds = (zone: string) => el("R", {}, el("List", {}, el("Cond", { name: "memberOf", value: "Network", op: "c" }), el("Cond", { name: "Zone", value: zone, op: "e" })));
    const d = diffTrees(conds("Lab"), conds("Lab-2"), p).children[0];
    expect(isEntryList(d)).toBe(true);
    const zone = d.children.find((c) => c.status === "modified")!;
    expect([displayLabel(zone, false, "a"), displayLabel(zone, false, "b")]).toEqual(["Zone EQUALS Lab", "Zone EQUALS Lab-2"]);
    const settings = diffTrees(el("R", {}, el("S", {}, el("NVPair", { name: "port", value: "1" }))), el("R", {}, el("S", {}, el("NVPair", { name: "port", value: "2" }))), p).children[0];
    expect(isEntryList(settings)).toBe(false);
  });

  it("lists an entry's fields in order, with the display value standing in for the raw one", () => {
    const c = (zone: string) => el("R", {}, el("Cond", { type: "Endpoint", name: "Zone", operator: "EQUALS", value: zone, displayValue: zone }));
    const zone = diffTrees(c("Lab"), c("Lab-2"), profile).children[0];
    expect(entryFields(zone, "a").map((f) => `${f.name}=${f.value}${f.changed ? "*" : ""}`)).toEqual([
      "type=Endpoint",
      "name=Zone",
      "operator=EQUALS",
      "value=Lab*",
    ]);
    const nas = el("R", {}, el("Cond", { name: "NAS-Port-Type", value: "19", displayValue: "Wireless-802.11 (19)" }));
    expect(entryFields(diffTrees(nas, nas, profile).children[0], "b").map((f) => f.value)).toEqual(["NAS-Port-Type", "Wireless-802.11 (19)"]);
    const result = el("R", {}, el("Res", { type: "Tips", name: "Role", displayValue: "Lab_User" }));
    expect(entryFields(diffTrees(result, result, profile).children[0], "a").map((f) => `${f.name}=${f.value}`)).toEqual([
      "type=Tips",
      "name=Role",
      "value=Lab_User",
    ]);
  });
});
