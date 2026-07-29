# Releasing Minerous

Players get updates in-app via [electron-updater](https://www.electron.build/auto-update),
which polls this repo's **GitHub Releases** page. Publishing a release is the whole
distribution mechanism — nobody has to reinstall.

## Setup

Already done: the repo is `Abeyy/minerous`, it's **public**, and `build.publish` in
`package.json` points at it. Nothing else to configure — GitHub Actions provides the
`GITHUB_TOKEN` the release job needs automatically.

The repo has to stay public. electron-updater fetches releases anonymously — it sends
no credentials at all — so against a private repo every check returns 404 and the app
reports "up to date" forever, even with a newer release published. Nothing errors; the
updates just never arrive.

> A private repo wouldn't be protecting the game code anyway: Electron ships readable
> JavaScript inside `app.asar`, and unpacking an installed copy takes one command.

### If it ever needs to go private again

Two options, neither requiring app changes:

- **Split the repos.** Keep `minerous` private for source, create a public
  `minerous-releases` holding only releases, and point `build.publish` at it. CI then
  needs a fine-grained PAT (Contents: read and write, that repo only) stored as a
  secret, because the automatic `GITHUB_TOKEN` can't write to another repo.
- **Host the feed yourself.** electron-builder's `generic` provider points at any
  HTTPS server — Cloudflare R2, S3, a static host:

  ```json
  "publish": [{ "provider": "generic", "url": "https://downloads.example.com/minerous" }]
  ```

  Upload the contents of `release/` (installer, `.blockmap`, `latest.yml`) there on
  each release.

What you should *not* do is embed a GitHub token in the app to read a private repo.
Anyone who installs the game can extract it from `app.asar` in minutes, a classic PAT
grants read/write to every repo you own, and rotating it means shipping a new build to
every player.

## Cutting a release

```bash
npm version patch && git push --follow-tags
```

`npm version` bumps `package.json` and creates a `v0.1.1` tag. Pushing the tag fires
`.github/workflows/release.yml`, which builds the Windows installer and uploads it to
a GitHub Release for that tag.

Installed apps check for updates 3 seconds after launch and then whenever the player
clicks **Check for updates** in the Account modal. A new build downloads in the
background; the player chooses when to restart, or it applies on next quit.

### Version numbers matter

electron-updater compares the running app's version against the newest release. The
tag and `package.json` version must agree — `npm version` keeps them in sync, which is
why it's worth using rather than editing by hand.

## What gets uploaded

Alongside the installer, electron-builder uploads `latest.yml` (and `latest-mac.yml` /
`latest-linux.yml` if you enable those). **These manifests are what the updater reads** —
a release containing only an `.exe` will never be detected. If updates aren't landing,
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
  removes it. **This is the only platform CI currently releases.**
- **Linux (AppImage)** — auto-update works unsigned, no caveats. Add `ubuntu-latest`
  to the workflow matrix to start shipping it.
- **macOS** — updates will not install. Build locally with `npm run dist` for your own
  use (then `xattr -d com.apple.quarantine /Applications/Minerous.app`), or buy the
  certificate and add `macos-latest` to the matrix.

## Testing an update end to end

You can't test this from a dev build — `app.isPackaged` is false there and the updater
deliberately no-ops (the Account modal says so). You need two real releases:

1. Publish `v0.1.0`, install it from the release artifacts.
2. `npm version patch && git push --follow-tags` to publish `v0.1.1`.
3. Launch the installed `v0.1.0`. Within a few seconds the banner should report the
   new version downloading, then offer **Restart & update**.
