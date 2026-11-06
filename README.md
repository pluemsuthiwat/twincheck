# TwinCheck

Compare two configuration files by meaning (semantic diff), starting with XML / Aruba ClearPass Policy Manager exports.
Everything is processed locally; no file ever leaves your machine.

## Usage

```sh
pnpm install
pnpm dev        # open the desktop app (Tauri)
pnpm web:dev    # run in the browser at http://localhost:5173
pnpm test       # unit tests (core, ClearPass profile, UI helpers)
pnpm typecheck
pnpm build      # apps/web/dist (static, opens without a server)
```

## Layout

| Package | Purpose |
|---|---|
| `packages/core` | Format-neutral tree diff engine: matches objects by key, LCS for order-sensitive lists, canonicalize, Profile |
| `packages/format-xml` | Converts XML to the shared tree (`parseXml`) and back to XML (`serializeXml`) |
| `packages/profile-clearpass` | ClearPass rules: categories, each object's key, ordered Rules, skips `exportTime` and internal IDs |
| `apps/web` | React + Vite + Tailwind UI, diff runs in a Web Worker, Monaco for Raw XML |
| `apps/desktop` | Tauri 2 shell around `apps/web` + updater (checks GitHub Releases for updates) |
| `fixtures/clearpass` | Sample exports for tests |

## Reading the diff view

**The `+N −N ~N` counts** (sidebar, category headers, top bar) count every change point inside; a parent's count is the sum of its children's.
- `+` only in B (an added block counts as 1) · `−` only in A · `~` changed value or moved position (several changed fields in one element count as 1)
- The total in the top bar equals "All differences" on the Overview page

**Colors** follow one rule in every table: A cell red = old value / only in A · B cell green = new value / only in B · amber = moved.
A changed entry with fields highlights only the values that changed; the whole cell is colored only when the entry exists on one side.
Categories use a blue folder icon, not a status color.

**Display standard** (applies to every object, not tied to element names)

| Data in the XML | Shown as |
|---|---|
| An element's attributes and `name`/`value` children (e.g. an Auth Source's NVPairs) | A `Field \| A \| B` table in XML order; unchanged values are folded under "Show unchanged fields" |
| A list of text values (`<string>` in AuthMethodNameList, …) | A `# \| A \| B` table, one row per item |
| A list of one-line entries (conditions, results, profile attributes) | A `# \| A \| B` table; each cell shows the fields (type / name / operator / value) |
| An order-sensitive list (RuleList) | A `# \| A \| B` table, one row per Rule: each condition as fields (type / name / operator / value) joined by AND/OR, then `THEN` with the result name (e.g. Role, Enforcement-Profile) in the value column and one `#1`, `#2` item per line under it. Rows show the whole rule, so they have no expand button; a single Rule is still a table |
| A comma-separated list field (e.g. a Device Group's `members`) | One `#1`, `#2` item per line, marking only items missing on the other side |
| Unnamed wrappers (Policy, RuleList, AttributeList, ResultList) | A caption inside the parent box, not a separate box |
| Any other object | A nested box |

**Order-sensitive lists:** when entries were only swapped, or added/removed at the end, row #n is the n-th entry of each file (a swap reads crosswise, `1|2, 2|1`).
When entries are added or removed in the middle, the same entry stays on one row so the rows after it don't all shift.

## Adding a format / profile

- **New format** (JSON, YAML, …): write an adapter that returns a `TNode` like `format-xml` does; the existing engine works with it as is
- **New profile**: create a `Profile` with `detect`, `ignore`, `rules` (`key`, `ordered`, `label`, `kind`, `ignoreAttrs`, `listAttrs`, `leadAttrs`) and add it to `PROFILES` in `apps/web/src/engine.ts`

## Releasing / auto-update

The desktop app checks GitHub Releases for updates when it starts (silently) and when you click **Check for updates** in the About dialog.
An update installs only if its signature matches the `pubkey` in `tauri.conf.json`.

One-time setup (the repo must be public):
- GitHub → Settings → Secrets and variables → Actions:
  - `TAURI_SIGNING_PRIVATE_KEY` (contents of `~/.tauri/twincheck.key`); `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` only if the key has a password
  - macOS signing and notarization: `APPLE_CERTIFICATE` (base64 of the Developer ID Application `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `KEYCHAIN_PASSWORD` (any value)
- **Back up `~/.tauri/twincheck.key`.** If it is lost, installed apps can no longer accept new updates.

For every release:

```sh
npm version minor --no-git-tag-version    # bumps "version" in the root package.json
git commit -am "Release v1.1.0"
git tag v1.1.0 && git push && git push --tags
```

The `.github/workflows/release.yml` workflow builds macOS (Apple Silicon + Intel, signed and notarized) and Windows, then creates a **draft release**.
Publish it in GitHub Releases when ready; installed apps see the update after that.

## Security notes

ClearPass exports contain plaintext secrets (Proxy secret, LDAP bind password, privateKeyPassword, SNMP community strings, …).
The UI masks them by default. The files in `fixtures/` come from a lab and have their secrets replaced with `REDACTED`; do the same before committing any new export.

## License

MIT — see [LICENSE](LICENSE)
