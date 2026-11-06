#!/bin/zsh
# Builds the macOS app on this Mac (Apple Silicon + Intel), signs it with the Developer ID,
# notarizes and staples the app and the .dmg, then adds both to the draft GitHub release that
# the Windows CI job created for the same version, including the darwin entries in latest.json.
#
# Run after pushing the vX.Y.Z tag, once the Windows job has created the draft release.
#
# One-time setup on this Mac:
#   - "Developer ID Application" certificate (with its private key) in the login keychain
#   - app-specific password: security add-generic-password -a "$USER" -s twincheck-notary -w
#   - Apple ID:              git config --local twincheck.appleid you@example.com
#   - updater key at ~/.tauri/twincheck.key, and `gh` logged in
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p 'require("./package.json").version')
TAG="v$VERSION"
TEAM_ID=FHJV635JGF

export APPLE_SIGNING_IDENTITY="Developer ID Application: Suthiwat Srisen ($TEAM_ID)"
export APPLE_TEAM_ID=$TEAM_ID
export APPLE_ID=$(git config --get twincheck.appleid)
export APPLE_PASSWORD=$(security find-generic-password -s twincheck-notary -w)
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/twincheck.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

if [[ $(gh release view "$TAG" --json isDraft -q .isDraft 2>/dev/null) != true ]]; then
  echo "No draft release $TAG: push the tag and wait for the Windows build first." >&2
  exit 1
fi

OUT=$(mktemp -d)
for target in aarch64 x86_64; do
  arch=${target/x86_64/x64}
  pnpm --filter @twincheck/desktop tauri build --target "$target-apple-darwin"
  bundle=apps/desktop/src-tauri/target/$target-apple-darwin/release/bundle

  # Tauri notarizes and staples the .app; the .dmg around it gets its own ticket.
  dmg=$OUT/TwinCheck_${VERSION}_$arch.dmg
  cp "$bundle/dmg/TwinCheck_${VERSION}_$arch.dmg" "$dmg"
  xcrun notarytool submit "$dmg" --apple-id "$APPLE_ID" --team-id "$TEAM_ID" --password "$APPLE_PASSWORD" --wait
  xcrun stapler staple "$dmg"
  spctl -a -t open --context context:primary-signature -vv "$dmg"

  cp "$bundle/macos/TwinCheck.app.tar.gz" "$OUT/TwinCheck_$arch.app.tar.gz"
  cp "$bundle/macos/TwinCheck.app.tar.gz.sig" "$OUT/TwinCheck_$arch.app.tar.gz.sig"
done

# Same asset names and latest.json keys tauri-action uses, so the updater finds them.
gh release download "$TAG" -p latest.json -D "$OUT" --clobber
python3 - "$OUT" "$TAG" <<'EOF'
import json, sys
out, tag = sys.argv[1:]
base = f"https://github.com/pluemsuthiwat/twincheck/releases/download/{tag}"
path = f"{out}/latest.json"
data = json.load(open(path))
for target, arch in (("aarch64", "aarch64"), ("x86_64", "x64")):
    entry = {"signature": open(f"{out}/TwinCheck_{arch}.app.tar.gz.sig").read(), "url": f"{base}/TwinCheck_{arch}.app.tar.gz"}
    data["platforms"][f"darwin-{target}"] = entry
    data["platforms"][f"darwin-{target}-app"] = entry
json.dump(data, open(path, "w"), indent=2)
EOF

gh release upload "$TAG" --clobber "$OUT"/*.dmg "$OUT"/*.app.tar.gz "$OUT"/*.app.tar.gz.sig "$OUT/latest.json"
echo "Added macOS builds to the draft release $TAG. Check it, then publish it on GitHub."
