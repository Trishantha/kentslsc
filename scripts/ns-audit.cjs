#!/usr/bin/env node
/* One-off audit: walk the client-component import graph from a page entry
 * (or any TS/TSX file) under apps/web and collect every next-intl
 * useTranslations('ns') namespace referenced. Prints a sorted, deduped list.
 *
 * Usage: node scripts/ns-audit.cjs <entry-file> [more entries...]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'apps/web');

function resolveSpecifier(spec, fromFile) {
  if (spec.startsWith('@/')) {
    const rel = spec.slice(2);
    return resolveWithExt(path.join(WEB, rel));
  }
  if (spec.startsWith('.')) {
    return resolveWithExt(path.resolve(path.dirname(fromFile), spec));
  }
  return null; // package import — outside the web app source
}

function resolveWithExt(base) {
  for (const cand of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts')
  ]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

const IMPORT_RE = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
const USE_T_RE = /useTranslations\(\s*'([^']+)'/g;

const seen = new Set();
const namespaces = new Set();
const filesWithNs = {};

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  let m;
  while ((m = USE_T_RE.exec(src))) {
    namespaces.add(m[1]);
    (filesWithNs[m[1]] ??= []).push(path.relative(WEB, file));
  }
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    const resolved = resolveSpecifier(spec, file);
    if (resolved) walk(resolved);
  }
}

for (const entry of process.argv.slice(2)) {
  walk(path.resolve(entry));
}

console.log([...namespaces].sort().join('\n'));
console.error('\n--- by namespace (files) ---');
for (const ns of [...namespaces].sort()) {
  console.error(`${ns}: ${filesWithNs[ns].length} file(s)`);
}
