// Verifies that the installer named inside latest.yml actually exists on disk under
// exactly that name.
//
//   node scripts/check-release-assets.js
//
// Why this exists: electron-updater downloads whatever `latest.yml` names. If the
// built file is called something else, the release looks perfectly healthy — assets
// attached, CI green — and every update attempt 404s.
//
// The classic cause is a space in the filename. GitHub rewrites spaces to dots when
// an asset is uploaded, while electron-builder writes hyphens into latest.yml, so a
// file called "Minerous Setup 1.0.0.exe" ends up as three different names. `nsis.
// artifactName` in package.json keeps spaces out of it; this check keeps it that way.
const fs = require('node:fs');
const path = require('node:path');

const releaseDir = path.join(__dirname, '..', 'release');
const manifest = path.join(releaseDir, 'latest.yml');

if (!fs.existsSync(manifest)) {
  console.error('✗ release/latest.yml is missing — the updater has nothing to read.');
  process.exit(1);
}

const yml = fs.readFileSync(manifest, 'utf-8');
// Small hand-rolled parse: the only fields that matter are `path:` and any `url:`.
const named = new Set();
for (const line of yml.split('\n')) {
  const match = line.match(/^\s*-?\s*(?:url|path):\s*(.+?)\s*$/);
  if (match) named.add(match[1]);
}

if (named.size === 0) {
  console.error('✗ latest.yml names no files.');
  process.exit(1);
}

const problems = [];
for (const name of named) {
  if (!fs.existsSync(path.join(releaseDir, name))) {
    problems.push(name);
  }
  if (/\s/.test(name)) {
    problems.push(`${name} (contains a space — GitHub will rename it on upload)`);
  }
}

if (problems.length) {
  console.error('✗ latest.yml references files that will not resolve:\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error('\nOn disk:');
  fs.readdirSync(releaseDir)
    .filter((f) => !f.endsWith('.yml') && !fs.statSync(path.join(releaseDir, f)).isDirectory())
    .forEach((f) => console.error('  ' + f));
  process.exit(1);
}

console.log(`✓ latest.yml and the built files agree (${[...named].join(', ')})`);
