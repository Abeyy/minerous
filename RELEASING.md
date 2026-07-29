# Releasing Minerous

Players get updates in-app via [electron-updater](https://www.electron.build/auto-update),
which polls the **GitHub Releases** page of this repo. Publishing a release is the whole
distribution mechanism — nobody has to reinstall.

## One-time setup

1. **Create the GitHub repo** and push this project to it.

2. **Fill in the publish target.** In `package.json`, replace the placeholder:

   ```json
   "publish": [{ "provider": "github", "owner": "YOUR_USERNAME", "repo": "minerous" }]
   ```

   The owner must match the repo exactly, or the app will poll the wrong URL and
   silently never find updates.

3. **Keep the repo public.** electron-updater fetches releases anonymously. A private
   repo would require shipping a GitHub token inside the app, where any user could
   extract it — don't.

## Cutting a release

```bash
npm version patch && git push --follow-tags
```

`npm version` bumps `package.json` and creates a `v0.1.1` tag. Pushing the tag fires
`.github/workflows/release.yml`, which builds on macOS, Windows and Linux runners and
uploads to a GitHub Release.

Installed apps check for updates 3 seconds after launch and then whenever the player
clicks **Check for updates** in the Account modal. A new build downloads in the
background; the player chooses when to restart, or it applies on next quit.

### Version numbers matter

electron-updater compares the running app's version against the newest release. The
tag and `package.json` version must agree — `npm version` keeps them in sync, which is
why it's worth using rather than editing by hand.

## What gets uploaded

Alongside the installers, electron-builder uploads `latest.yml`, `latest-mac.yml` and
`latest-linux.yml`. **These manifests are what the updater actually reads** — a release
containing only a `.dmg` and `.exe` will never be detected. If updates aren't landing,
check the manifests are attached to the release first.

macOS needs both a `.dmg` (first install) and a `.zip` (updates — Squirrel.Mac only
knows how to swap in a zip). Both are configured in `package.json`.

## macOS code signing — read this

**Auto-update does not work on macOS without a signed, notarized app.** Squirrel.Mac
verifies the signature of the downloaded build and refuses anything unsigned, so the
download will succeed and the install will silently fail.

This is the same reason a fresh `.dmg` currently opens with *"Minerous is damaged and
can't be opened"* and needs:

```bash
xattr -d com.apple.quarantine /Applications/Minerous.app
```

To fix both properly you need an **Apple Developer Program membership (~$99/year)**,
then set these repository secrets and electron-builder handles the rest:

| Secret | What it is |
| --- | --- |
| `CSC_LINK` | base64 of your Developer ID Application `.p12` |
| `CSC_KEY_PASSWORD` | password for that `.p12` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password for notarization |
| `APPLE_TEAM_ID` | your team ID |

Until then:

- **Windows** — auto-update works unsigned. Users see a SmartScreen warning on first
  install, which fades as the app gains reputation. Code signing (~$100–400/year)
  removes it.
- **Linux (AppImage)** — auto-update works unsigned, no caveats.
- **macOS** — updates will not install. Ship the `.dmg` and tell users to reinstall,
  or buy the certificate.

## Testing an update end to end

You can't test this from a dev build — `app.isPackaged` is false there and the updater
deliberately no-ops (the Account modal says so). You need two real releases:

1. Publish `v0.1.0`, install it from the release artifacts.
2. `npm version patch && git push --follow-tags` to publish `v0.1.1`.
3. Launch the installed `v0.1.0`. Within a few seconds the banner should report the
   new version downloading, then offer **Restart & update**.
