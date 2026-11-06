import type { ElementRule, Profile, TNode } from "@twincheck/core";

/** Top-level containers of a ClearPass TIPS export: [container, object element, category label, object kind]. */
const CATEGORIES: [string, string, string, string][] = [
  ["RadiusEnforcementServices", "RadiusEnforcementService", "Services — RADIUS", "RADIUS Service"],
  ["TacacsEnforcementServices", "TacacsEnforcementService", "Services — TACACS+", "TACACS+ Service"],
  ["AvendaWebAuthServices", "AvendaWebAuthService", "Services — Web-based Auth", "Web Auth Service"],
  ["AvendaAppAuthServices", "AvendaAppAuthService", "Services — Application", "Application Service"],
  ["EnforcementPolicies", "EnforcementPolicy", "Enforcement Policies", "Enforcement Policy"],
  ["RadiusEnfProfiles", "RadiusEnfProfile", "Enforcement Profiles — RADIUS", "RADIUS Profile"],
  ["RadiusCoAEnfProfiles", "RadiusCoAEnfProfile", "Enforcement Profiles — RADIUS CoA", "RADIUS CoA Profile"],
  ["TacacsEnfProfiles", "TacacsEnfProfile", "Enforcement Profiles — TACACS+", "TACACS+ Profile"],
  ["PostAuthEnfProfiles", "PostAuthEnfProfile", "Enforcement Profiles — Post Authentication", "Post-Auth Profile"],
  ["AgentEnfProfiles", "AgentEnfProfile", "Enforcement Profiles — Agent", "Agent Profile"],
  ["GenericEnfProfiles", "GenericEnfProfile", "Enforcement Profiles — Generic", "Generic Profile"],
  ["RoleMappings", "RoleMapping", "Role Mappings", "Role Mapping"],
  ["Roles", "Role", "Roles", "Role"],
  ["AuthMethods", "AuthMethod", "Authentication Methods", "Auth Method"],
  ["AuthSources", "AuthSource", "Authentication Sources", "Auth Source"],
  ["AdminPrivileges", "AdminPrivilege", "Admin Privileges", "Admin Privilege"],
  ["TagDictionaries", "TagDictionary", "Attribute Dictionary", "Attribute"],
  ["InternalPostures", "InternalPosture", "Posture Policies", "Posture Policy"],
  ["Proxies", "Proxy", "Proxy Targets", "Proxy Target"],
  ["RadiusCOATemplates", "RadiusCOATemplate", "RADIUS CoA Templates", "CoA Template"],
  ["ContextServers", "ContextServer", "Endpoint Context Servers", "Context Server"],
  ["ContextServerActions", "ContextServerAction", "Context Server Actions", "Server Action"],
  ["NadClients", "NadClient", "Network Devices", "Network Device"],
  ["NadGroups", "NadGroup", "Network Device Groups", "Device Group"],
];

const ROOT = "TipsContents";
const attr = (n: TNode, k: string) => n.attrs[k] ?? "";

function descendants(n: TNode, name: string, out: TNode[] = []): TNode[] {
  for (const c of n.children) {
    if (c.name === name) out.push(c);
    descendants(c, name, out);
  }
  return out;
}

/** "Authorization:PLUEM-ZNC-AD:memberOf CONTAINS Network": the type says where the value comes from, as ClearPass shows it. */
const condition = (n: TNode) => {
  const source = n.attrs.type ? `${n.attrs.type}:` : "";
  return `${source}${attr(n, "name")} ${attr(n, "operator")} ${n.attrs.displayValue ?? attr(n, "value")}`;
};

/** "Rule 3: IF SSO-SP EQUALS q123 THEN Enforcement-Profile = [Allow Access Profile]" */
function ruleLabel(n: TNode, pos: number): string {
  const cond = n.children.find((c) => c.name === "Condition");
  const expr = cond && descendants(cond, "Expression")[0];
  const joiner = expr?.attrs.operator === "OR" ? " OR " : " AND ";
  const conds = cond ? descendants(cond, "RuleAttribute").map(condition).join(joiner) : "";
  // Each result names what it sets (Role, Enforcement-Profile, ...), as in the XML.
  const results = descendants(n, "RuleResult")
    .map((r) => `${attr(r, "name")} = ${r.attrs.displayValue ?? attr(r, "value")}`)
    .join(", ");
  return `Rule ${pos}: IF ${conds || "(always)"} THEN ${results}`;
}

const rules: ElementRule[] = [
  { match: `${ROOT}/TipsHeader`, kind: "Export Header", label: () => "Export Header" },
  ...CATEGORIES.flatMap(([container, child, label, kind]): ElementRule[] => [
    { match: `${ROOT}/${container}`, kind: "Category", label: () => label },
    { match: `${ROOT}/${container}/${child}`, kind },
  ]),
  { match: `${ROOT}/TagDictionaries/TagDictionary`, key: (n) => `${attr(n, "entityName")}.${attr(n, "attributeName")}`, label: (n) => `${attr(n, "entityName")}.${attr(n, "attributeName")}` },
  { match: `${ROOT}/ContextServers/ContextServer`, key: (n) => `${attr(n, "type")}:${attr(n, "server")}`, label: (n) => `${attr(n, "server")} (${attr(n, "type")})` },
  // ClearPass's Device Group form opens with Name and Description; the XML puts them last.
  { match: `${ROOT}/NadGroups/NadGroup`, listAttrs: ["members"], leadAttrs: ["name", "description"] },
  { match: `${ROOT}/ContextServerActions/ContextServerAction`, key: (n) => `${attr(n, "type")}:${attr(n, "action")}`, label: (n) => `${attr(n, "action")} (${attr(n, "type")})` },

  // Rule lists are evaluated in order (first-applicable / evaluate-all), so position matters.
  { match: "**/RuleList/Rule", ordered: true, kind: "Rule", label: ruleLabel },
  // Auth method / auth source / policy references: order is lookup order.
  { match: "**/*NameList/string", ordered: true, kind: "Item", key: (n) => n.text },
  { match: "**/InnerMethodNames/string", ordered: true, kind: "Inner Method", key: (n) => n.text },

  { match: "**/RuleExpression", kind: "Service Rule", label: (n) => `Service Rule (${attr(n, "displayOperator") || attr(n, "operator")})` },
  // A policy rule's conditions: the same shape as a service rule's, so they are named alike.
  { match: "**/Rule/Condition/Expression", kind: "Rule Condition", label: (n) => `Rule Condition (${attr(n, "displayOperator") || attr(n, "operator")})` },
  { match: "**/RuleAttribute", kind: "Condition", label: condition },
  { match: "**/RulesCondition", kind: "Condition", label: (n) => `${attr(n, "name")} ${attr(n, "oper")} ${n.attrs.valueDispName ?? attr(n, "value")}` },
  {
    match: "**/RuleResult",
    kind: "Result",
    label: (n) => `${attr(n, "name")} = ${n.attrs.displayValue ?? attr(n, "value")}`,
    // `value` holds internal object IDs that differ between ClearPass instances; compare by name instead.
    ignoreAttrs: (n) => (n.attrs.displayValue !== undefined ? ["value"] : []),
  },
  { match: "**/AttributeList/Attribute", kind: "Attribute", label: (n) => `${attr(n, "type")}:${attr(n, "name")} = ${n.attrs.displayValue ?? attr(n, "value")}` },
  { match: "**/ProfileParams", kind: "Parameter", label: (n) => `${attr(n, "name")} = ${n.attrs.displayValue ?? attr(n, "value")}` },
  { match: "**/NVPair", kind: "Setting" },
  { match: "**/Filters/Filter", kind: "Filter", key: (n) => n.attrs.filterName, label: (n) => attr(n, "filterName") },
  { match: "**/Filter/Attributes/Attribute", kind: "Filter Attribute", key: (n) => n.attrs.attrName, label: (n) => `${attr(n, "attrName")} → ${attr(n, "aliasName")}` },
  { match: "**/AdminTask", kind: "Admin Task", key: (n) => n.attrs.taskid, label: (n) => attr(n, "taskid") },
  { match: "**/InsightTask", kind: "Insight Task", key: (n) => n.attrs.taskId, label: (n) => attr(n, "taskId") },
  { match: "**/ServiceCertificate", kind: "Service Certificate", label: () => "Service Certificate" },
];

export const clearpassProfile: Profile = {
  id: "clearpass",
  name: "Aruba ClearPass (Policy Manager export)",
  detect: (root) => root.name === ROOT,
  ignore: [`${ROOT}/TipsHeader/@exportTime`],
  rules,
};

