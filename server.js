#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const webPort = process.env.PORT || process.env.WEB_PORT || '3000';
const apiPort = process.env.API_PORT || process.env.API_PORT_NUMBER || '3001';
const host = process.env.HOST || '0.0.0.0';
const frontendUrl = process.env.FRONTEND_URL || `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${webPort}`;
const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_PROXY_TARGET || `http://127.0.0.1:${apiPort}`;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ...options }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...options }
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

  console.log('Building the web app and API before starting them...');
  await runCommand(pnpmCommand, ['build']);
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
    NEXT_PUBLIC_API_URL: apiUrl,
    API_PROXY_TARGET: apiUrl
  };

  console.log(`Starting unified app on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${webPort}`);

  const apiProcess = spawnProcess(pnpmCommand, ['--dir', 'apps/api', 'exec', 'node', 'dist/main.js'], apiEnv);
  const webProcess = spawnProcess(pnpmCommand, ['--dir', 'apps/web', 'exec', 'next', 'start', '--hostname', host, '--port', webPort], webEnv);

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
