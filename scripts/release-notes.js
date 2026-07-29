// Extracts one version's section out of CHANGELOG.md so CI can use it as the GitHub
// Release body. Without this the release publishes with an empty description.
//
//   node scripts/release-notes.js 0.1.2 > notes.md
//
// Falls back to a short pointer rather than failing the build — a release with a
// thin description is better than a release that didn't happen.
const fs = require('node:fs');
const path = require('node:path');

const version = (process.argv[2] || '').replace(/^v/, '');
const changelog = path.join(__dirname, '..', 'CHANGELOG.md');

function extract() {
  if (!version) return null;
  let text;
  try {
    text = fs.readFileSync(changelog, 'utf-8');
  } catch {
    return null;
  }

  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## v${version}`);
  if (start === -1) return null;

  // Run to the next top-level version heading, dropping any trailing `---` divider.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/\n+---\s*$/, '')
    .trim();

  return body || null;
}

const notes = extract();
process.stdout.write(
  notes || `Minerous v${version || 'unknown'}.\n\nSee CHANGELOG.md for details.\n`
);
