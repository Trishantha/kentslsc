#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');
const nodeCommand = process.execPath;

const webPort = process.env.PORT || process.env.WEB_PORT || '3000';
const apiPort = process.env.API_PORT || process.env.API_PORT_NUMBER || '3001';
const host = process.env.HOST || '0.0.0.0';
const frontendUrl = process.env.FRONTEND_URL || `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${webPort}`;
const internalApiUrl = process.env.API_PROXY_TARGET || `http://127.0.0.1:${apiPort}`;
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || '';

function spawnProcess(command, args, envOverrides = {}, cwd = rootDir) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...envOverrides }
  });

  child.on('error', (error) => {
    console.error(`Failed to start ${command}:`, error);
  });

  return child;
}

async function ensureBuilt() {
  const apiBuilt = fs.existsSync(path.join(apiDir, 'dist', 'main.js'));
  const webBuilt = fs.existsSync(path.join(webDir, '.next', 'BUILD_ID'));

  if (apiBuilt && webBuilt) {
    return;
  }

  throw new Error(
    'Missing build artifacts. Ensure deployment runs the build step before starting server.js.'
  );
}

function startServices() {
  const apiEnv = {
    NODE_ENV: 'production',
    PORT: apiPort,
    FRONTEND_URL: frontendUrl
  };

  const webEnv = {
    NODE_ENV: 'production',
    PORT: webPort,
    HOSTNAME: host,
    FRONTEND_URL: frontendUrl,
    API_PROXY_TARGET: internalApiUrl,
    ...(publicApiUrl ? { NEXT_PUBLIC_API_URL: publicApiUrl } : {})
  };

  console.log(`Starting unified app on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${webPort}`);
  console.log(`Internal API target: ${internalApiUrl}`);
  if (publicApiUrl) {
    console.log(`Public API URL: ${publicApiUrl}`);
  }

  const apiProcess = spawnProcess(nodeCommand, ['dist/main.js'], apiEnv, apiDir);
  const webProcess = spawnProcess(
    nodeCommand,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', host, '--port', webPort],
    webEnv,
    webDir
  );

  const shutdown = () => {
    console.log('Stopping app services...');
    [apiProcess, webProcess].forEach((child) => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    });
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

(async () => {
  try {
    await ensureBuilt();
    startServices();
  } catch (error) {
    console.error('Unable to start the unified app:', error);
    process.exit(1);
  }
})();
