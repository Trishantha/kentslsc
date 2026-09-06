#!/usr/bin/env node
/**
 * Writes build metadata (git commit, branch, timestamp) into the build output
 * directories. This lets the runtime detect stale builds where the deployed
 * `apps/api/dist` or `apps/web/.next` artifacts were produced from an older
 * commit than the current source tree.
 *
 * Usage:
 *   node scripts/write-build-info.js [apps/api/dist] [apps/web/.next]
 *
 * With no arguments it writes to both default locations when they exist.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runGit(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function gitInfo() {
  // Resolve each value independently: a missing tag or detached head must not
  // blank out the commit, and hosts that build from a source tarball without
  // a git binary fall back to CI-provided environment variables.
  const commit = runGit('git rev-parse HEAD') || process.env.GIT_COMMIT || process.env.GITHUB_SHA || 'unknown';
  const branch =
    runGit('git branch --show-current') || process.env.GIT_BRANCH || process.env.GITHUB_REF_NAME || 'unknown';
  const tag = runGit('git describe --tags --exact-match HEAD') || process.env.GIT_TAG || null;
  return { commit, branch, tag, builtAt: new Date().toISOString() };
}

function writeBuildInfo(targetDir, info) {
  const parentDir = path.dirname(targetDir);
  if (!fs.existsSync(parentDir)) {
    console.warn(`Skipping ${targetDir}: parent directory does not exist`);
    return;
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filePath = path.join(targetDir, 'BUILD_INFO');
  fs.writeFileSync(filePath, JSON.stringify(info, null, 2), 'utf8');
  console.log(`Wrote build info to ${filePath}`);
}

const info = gitInfo();
const rootDir = path.resolve(__dirname, '..');

const targets = process.argv.slice(2);
if (targets.length === 0) {
  targets.push(path.join(rootDir, 'apps', 'api', 'dist'));
  targets.push(path.join(rootDir, 'apps', 'web', '.next'));
}

for (const target of targets) {
  const resolved = path.resolve(target);
  writeBuildInfo(resolved, info);
}
