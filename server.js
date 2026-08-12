#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const https = require('https');

const rootDir = __dirname;
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');
const nodeCommand = process.execPath;

const publicPort = Number(process.env.PORT || process.env.WEB_PORT || 3000);
const preferredInternalWebPort = Number(process.env.INTERNAL_WEB_PORT || 3100);
const preferredApiPort = Number(process.env.API_PORT || process.env.API_PORT_NUMBER || 3001);
const host = process.env.HOST || '0.0.0.0';
const frontendUrl = process.env.FRONTEND_URL || `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`;
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || '';

let internalWebPort = preferredInternalWebPort;
let apiPort = preferredApiPort;
let internalWebUrl = `http://127.0.0.1:${internalWebPort}`;
let internalApiUrl = `http://127.0.0.1:${apiPort}`;

let apiProcess;
let webProcess;

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

function findAvailableLocalPort(startPort) {
  const maxAttempts = 50;

  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > startPort + maxAttempts) {
        reject(new Error(`Unable to find a free port starting at ${startPort}`));
        return;
      }

      const server = net.createServer();
      server.unref();
      server.on('error', (error) => {
        server.close();
        if (error && error.code === 'EADDRINUSE') {
          tryPort(port + 1);
          return;
        }
        reject(error);
      });
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        const resolvedPort = typeof address === 'object' && address ? address.port : port;
        server.close(() => resolve(resolvedPort));
      });
    };

    tryPort(startPort);
  });
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

function proxyRequest(req, res, targetBaseUrl) {
  const target = new URL(targetBaseUrl);
  const client = target.protocol === 'https:' ? https : http;
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host || target.host;
  const forwardedProto = req.headers['x-forwarded-proto'] || 'http';
  const forwardedPort = req.headers['x-forwarded-port'] || String(publicPort);

  const request = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: forwardedHost,
        'x-forwarded-host': forwardedHost,
        'x-forwarded-proto': forwardedProto,
        'x-forwarded-port': forwardedPort,
        connection: 'close'
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  request.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = req.url?.startsWith('/api') ? 503 : 502;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Upstream service unavailable', detail: message }));
  });

  req.pipe(request);
}

function startProxyServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    const toApi = url.startsWith('/api') || url.startsWith('/uploads') || url.startsWith('/socket.io');
    proxyRequest(req, res, toApi ? internalApiUrl : internalWebUrl);
  });

  server.listen(publicPort, host, () => {
    console.log(`Public listener ready on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
  });

  return server;
}

async function startServices() {
  apiPort = await findAvailableLocalPort(preferredApiPort);
  internalWebPort = await findAvailableLocalPort(preferredInternalWebPort);
  internalApiUrl = `http://127.0.0.1:${apiPort}`;
  internalWebUrl = `http://127.0.0.1:${internalWebPort}`;

  const apiEnv = {
    NODE_ENV: 'production',
    PORT: apiPort,
    HOST: '127.0.0.1',
    FRONTEND_URL: frontendUrl
  };

  const webEnv = {
    NODE_ENV: 'production',
    PORT: internalWebPort,
    HOSTNAME: '127.0.0.1',
    FRONTEND_URL: frontendUrl,
    API_PROXY_TARGET: internalApiUrl,
    ...(publicApiUrl ? { NEXT_PUBLIC_API_URL: publicApiUrl } : {})
  };

  console.log(`Starting unified app on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
  console.log(`Internal API target: ${internalApiUrl}`);
  console.log(`Internal web target: ${internalWebUrl}`);
  if (publicApiUrl) {
    console.log(`Public API URL: ${publicApiUrl}`);
  }

  apiProcess = spawnProcess(nodeCommand, ['dist/main.js'], apiEnv, apiDir);
  webProcess = spawnProcess(
    nodeCommand,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(internalWebPort)],
    webEnv,
    webDir
  );

  const proxyServer = startProxyServer();

  const shutdown = () => {
    console.log('Stopping app services...');
    proxyServer.close();
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
    await startServices();
  } catch (error) {
    console.error('Unable to start the unified app:', error);
    process.exit(1);
  }
})();
