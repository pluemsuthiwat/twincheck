# Changelog

## 1.0.0 — 2026-11-06

First release as a desktop app.

### Diff view
- Overview groups changes by category → Changed / Only in B / Only in A, one card per object with `old → new` inline; the summary cards at the top act as filters
- One display standard everywhere: `Field | A | B` and `# | A | B` tables (see "Reading the diff view" in the README)
- Auth Source: NVPair values (timeout, server, port, …) form a single A | B table
- Auth Methods / Auth Sources / Authorization Sources in a service: an A | B table, one row per item
- Conditions, results and profile attributes show as fields (type / name / operator / value)
- Conditions show where a value comes from, e.g. `Authorization:PLUEM-ZNC-AD:memberOf`, `Endpoint:Zone`
- Rule rows in a RuleList (Enforcement Policy, Role Mapping) show each condition as type / name / operator / value fields joined by AND/OR, then `THEN` with the Enforcement-Profile / Role and one `#1`, `#2` item per line; rows show the whole rule, and a single Rule is still a `# | A | B` table
- Clicking a rule in the Overview scrolls to its row and outlines it
- A changed rule, condition or attribute highlights only the values that changed (A red, B green); entries on one side only are colored as a whole
- Swapped rules line up by their position in each file (crosswise) and are marked amber
- A rule's conditions are named "Rule Condition (MATCHES_ALL)", like a service's "Service Rule (MATCHES_ALL)"
- Role Mapping / Enforcement Policy read as one "Policy" section: the object's fields (dftRoleName, name, …) and then the rule table, with no separate RuleList caption
- Unnamed wrapper elements render as captions instead of nested boxes
- Fields keep their XML order (except Device Groups, which show `name` and `description` first, as in ClearPass)
- Comma-separated list fields (e.g. a Device Group's `members`) show one `#1`, `#2` item per line, marking only items missing on the other side; the Overview lists removed → added items
- Network Devices (`NadClients`) and Network Device Groups (`NadGroups`) use ClearPass's names instead of the XML tag names
- Categories use a blue folder icon, separate from status colors; boxes have no colored side bars
- Secrets are masked by default, including values embedded in entry names (sidebar, Overview, details) and SNMP community strings, in both the diff view and Raw XML

### Counting and engine
- `+ − ~` counts work the same everywhere: every change point inside, a parent equals the sum of its children, Only in A/B rows show `−1` / `+1`
- Several changed fields in one element (e.g. `value` + `displayValue`) count as 1
- Rules that only moved are detected as "Moved", not removed + added
- The engine keeps A's name (`labelA`) when it differs from B's
- Profiles can declare comma-separated list fields (`listAttrs`) and fields shown first (`leadAttrs`)

### App
- `npm run dev` / `pnpm dev` opens the desktop app (Tauri); the browser version is `pnpm web:dev`
- The version lives in the root `package.json` only (the app and installers read it from there)
- About dialog: version, copyright, full MIT License text, Check for updates
- Automatic update checks against GitHub Releases (Tauri updater, signed update files) with an "Update & restart" prompt
- Releases: a `v*` tag builds the Windows installer in GitHub Actions into a draft release with `latest.json`; `scripts/release-mac.sh` adds the macOS builds
- The macOS app and .dmg are signed with a Developer ID and notarized by Apple (the Windows installer is not signed yet)
- MIT License
