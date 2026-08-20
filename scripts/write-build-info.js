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

function gitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim() || 'detached';
    const tag = execSync('git describe --tags --exact-match HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim() || null;
    return { commit, branch, tag, builtAt: new Date().toISOString() };
  } catch {
    return {
      commit: process.env.GIT_COMMIT || 'unknown',
      branch: process.env.GIT_BRANCH || 'unknown',
      tag: process.env.GIT_TAG || null,
      builtAt: new Date().toISOString()
    };
  }
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
