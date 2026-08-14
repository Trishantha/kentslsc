#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const https = require('https');

const rootDir = __dirname;
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');
const nodeCommand = process.execPath;

function parseDotEnvValue(rawValue) {
  const value = rawValue.trim();
  if (!value || value === '""' || value === "''") {
    return '';
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, '').trim();
}

function loadDotEnvFile(filePath, { override = false } = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  for (const line of fileContents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/) || trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (override || typeof process.env[key] === 'undefined') {
      process.env[key] = parseDotEnvValue(rawValue);
    }
  }
}

function loadEnvironmentFiles() {
  const envFiles = [
    process.env.ENV_FILE,
    process.env.NODE_ENV === 'production' ? path.join(rootDir, '.env.hostinger.production') : null,
    path.join(rootDir, '.env'),
    path.join(rootDir, 'apps', 'web', '.env.local')
  ].filter(Boolean);

  for (const filePath of envFiles) {
    loadDotEnvFile(filePath, { override: false });
  }
}

loadEnvironmentFiles();

function runMigrations() {
  if (!process.env.DATABASE_URL || process.env.SKIP_MIGRATIONS === 'true') {
    console.log(
      process.env.DATABASE_URL
        ? 'Skipping database migrations (SKIP_MIGRATIONS=true).'
        : 'DATABASE_URL is not set; skipping database migrations.'
    );
    return;
  }

  const prismaBinaryCandidates = [
    path.join(rootDir, 'packages', 'database', 'node_modules', '.bin', 'prisma'),
    path.join(rootDir, 'node_modules', '.pnpm', 'node_modules', '.bin', 'prisma'),
    path.join(rootDir, 'node_modules', '.bin', 'prisma')
  ];
  const prismaBinary = prismaBinaryCandidates.find((candidate) => fs.existsSync(candidate));
  if (!prismaBinary) {
    console.warn(
      `Prisma CLI not found in any of: ${prismaBinaryCandidates.join(', ')}; skipping migrations.`
    );
    return;
  }
  console.log(`Using Prisma CLI at: ${prismaBinary}`);

  // Prefer the copied prisma artifacts from the database package build so the
  // runtime image does not need the source prisma folder.
  const distSchemaPath = path.join(rootDir, 'packages', 'database', 'dist', 'prisma', 'schema.prisma');
  const sourceSchemaPath = path.join(rootDir, 'packages', 'database', 'prisma', 'schema.prisma');
  const schemaPath = fs.existsSync(distSchemaPath) ? distSchemaPath : sourceSchemaPath;

  if (!fs.existsSync(schemaPath)) {
    console.warn(`Prisma schema not found at ${schemaPath}; skipping migrations.`);
    return;
  }
  console.log(`Using Prisma schema at: ${schemaPath}`);

  // Verify the Prisma binary can execute before running migrations.
  const versionResult = spawnSync(prismaBinary, ['--version'], {
    cwd: rootDir,
    stdio: 'pipe',
    env: process.env
  });
  if (versionResult.status !== 0) {
    console.error('Prisma --version failed:', versionResult.error ? versionResult.error.message : '');
    if (versionResult.stderr) console.error(versionResult.stderr.toString());
    if (versionResult.stdout) console.log(versionResult.stdout.toString());
    throw new Error(
      `Prisma CLI at ${prismaBinary} could not execute (exit code ${versionResult.status ?? 'unknown'}). ` +
        'Set SKIP_MIGRATIONS=true to start without applying migrations (not recommended in production).'
    );
  }
  console.log('Prisma CLI is executable.');

  console.log('Running database migrations...');
  const result = spawnSync(prismaBinary, ['migrate', 'deploy', '--schema', schemaPath], {
    cwd: rootDir,
    stdio: 'pipe',
    env: process.env
  });

  if (result.stdout) {
    console.log(result.stdout.toString());
  }
  if (result.stderr) {
    console.error(result.stderr.toString());
  }
  if (result.error) {
    console.error('Migration spawn error:', result.error.message);
  }

  if (result.status !== 0) {
    throw new Error(
      `Database migration failed with exit code ${result.status ?? 'unknown'}` +
        (result.signal ? ` (signal: ${result.signal})` : '') +
        '. Set SKIP_MIGRATIONS=true to start without applying migrations (not recommended in production).'
    );
  }

  console.log('Database migrations applied successfully.');
}

const publicPort = Number(process.env.PORT || process.env.WEB_PORT || 3000);
const preferredInternalWebPort = Number(process.env.INTERNAL_WEB_PORT || 3100);
const host = process.env.HOST || '0.0.0.0';
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || '';
const apiMode = process.env.API_MODE || 'in-process';
const webMode = process.env.WEB_MODE || 'in-process';
const apiSocketPath = process.env.API_SOCKET_PATH || '/tmp/kslsc-api.sock';

// How long the public proxy waits for an upstream response (ms).
const proxyRequestTimeoutMs = Number(process.env.PROXY_REQUEST_TIMEOUT_MS || 30000);

// Memory ceilings for child processes. Keep these conservative for shared hosting.
const apiMemoryLimitMb = Number(process.env.API_MEMORY_LIMIT_MB || 1024);
const webMemoryLimitMb = Number(process.env.WEB_MEMORY_LIMIT_MB || 1024);

const isLocalHostname = (value) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(value);

function parsePublicOriginCandidate(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (isLocalHostname(parsed.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const frontendOrigin =
  parsePublicOriginCandidate(process.env.FRONTEND_URL) ||
  parsePublicOriginCandidate(process.env.NEXT_PUBLIC_FRONTEND_URL) ||
  parsePublicOriginCandidate(publicApiUrl) ||
  new URL(`http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
const frontendUrl = frontendOrigin.toString();

let internalWebPort = preferredInternalWebPort;
let internalWebUrl = `http://127.0.0.1:${internalWebPort}`;

let apiProcess;
let webProcess;
let apiServer;
let apiApp;
let webHandler;
let isShuttingDown = false;
let isUpstreamReady = false;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

function checkBuildArtifacts() {
  return {
    apiBuilt: fs.existsSync(path.join(apiDir, 'dist', 'main.js')),
    webBuilt: fs.existsSync(path.join(webDir, '.next', 'BUILD_ID'))
  };
}

async function ensureBuilt() {
  const { apiBuilt, webBuilt } = checkBuildArtifacts();

  if (apiBuilt && webBuilt) {
    return;
  }

  const skipAutoBuild = process.env.SKIP_AUTO_BUILD === 'true' || process.env.SKIP_AUTO_BUILD === '1';
  const isProduction = process.env.NODE_ENV === 'production';

  if (skipAutoBuild || isProduction) {
    const missing = [!apiBuilt && 'apps/api/dist/main.js', !webBuilt && 'apps/web/.next/BUILD_ID']
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `Missing required build artifacts: ${missing}. ` +
      'Run the build step before starting server.js in production, or set SKIP_AUTO_BUILD=false to build on startup.'
    );
  }

  console.log('Missing build artifacts. Running project build before startup...');

  const corepackCommand = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  const result = spawnSync(corepackCommand, ['pnpm', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(
      `Build failed while preparing the app for startup with exit code ${result.status ?? 'unknown'}.`
    );
  }

  const { apiBuilt: apiBuiltAfterBuild, webBuilt: webBuiltAfterBuild } = checkBuildArtifacts();

  if (!apiBuiltAfterBuild || !webBuiltAfterBuild) {
    throw new Error(
      'Build completed but required artifacts are still missing. Check the app build output.'
    );
  }
}

function getHeaderValue(value) {
  if (Array.isArray(value)) {
    return getHeaderValue(value[0]);
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.split(',')[0].trim();
}

function resolveProxyProtocol(targetBaseUrl, req = {}) {
  const target = new URL(targetBaseUrl);
  const incomingHost = Array.isArray(req.headers?.host) ? req.headers.host[0] : req.headers?.host;
  const incomingProto = getHeaderValue(req.headers?.['x-forwarded-proto']);
  const isLocalHost = (value) => Boolean(value) && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(value);

  if (isLocalHost(incomingHost) || target.hostname === '127.0.0.1' || target.hostname === 'localhost') {
    return target.protocol === 'https:' ? 'https' : 'http';
  }

  return incomingProto === 'https' ? 'https' : target.protocol === 'https:' ? 'https' : 'http';
}

function resolveForwardedProto(req, targetBaseUrl, origin = frontendOrigin) {
  const target = new URL(targetBaseUrl);
  const incomingHost = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const incomingProto = getHeaderValue(req.headers['x-forwarded-proto']);
  const isLocalHost = (value) => Boolean(value) && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(value);

  if (isLocalHost(incomingHost) || target.hostname === '127.0.0.1' || target.hostname === 'localhost') {
    return target.protocol.slice(0, -1);
  }

  return incomingProto || origin.protocol.slice(0, -1);
}

function proxyRequest(req, res, targetBaseUrl) {
  const isUnixSocket = targetBaseUrl.startsWith('unix:');
  const socketPath = isUnixSocket ? targetBaseUrl.slice(5) : undefined;
  const target = isUnixSocket ? new URL('http://localhost') : new URL(targetBaseUrl);
  const client = isUnixSocket ? http : resolveProxyProtocol(targetBaseUrl, req) === 'https' ? https : http;
  const requestPath = normalizeRequestPath(req.url || '/');
  const incomingHost = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const incomingForwardedHost = Array.isArray(req.headers['x-forwarded-host'])
    ? req.headers['x-forwarded-host'][0]
    : req.headers['x-forwarded-host'];
  const isLocalHost = (value) => Boolean(value) && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(value);
  const forwardedHost =
    (incomingForwardedHost && !isLocalHost(incomingForwardedHost) && incomingForwardedHost) ||
    (incomingHost && !isLocalHost(incomingHost) && incomingHost) ||
    frontendOrigin.host;
  const forwardedProto = resolveForwardedProto(req, targetBaseUrl, frontendOrigin);
  const forwardedPort =
    (Array.isArray(req.headers['x-forwarded-port'])
      ? req.headers['x-forwarded-port'][0]
      : req.headers['x-forwarded-port']) ||
    frontendOrigin.port ||
    (frontendOrigin.protocol === 'https:' ? '443' : '80');

  const rewritePublicOriginHeader = (headerValue, baseUrl) => {
    const singleValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!singleValue) return headerValue;

    try {
      const resolved = new URL(singleValue, baseUrl);
      const isInternalRedirect = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(resolved.hostname);

      if (!isInternalRedirect) {
        return headerValue;
      }

      resolved.protocol = frontendOrigin.protocol;
      resolved.host = frontendOrigin.host;
      resolved.port = frontendOrigin.port;
      return resolved.toString();
    } catch {
      return headerValue;
    }
  };

  let responded = false;

  const failRequest = (message, status) => {
    if (responded) return;
    responded = true;
    try {
      if (!res.headersSent) {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'Upstream service unavailable', detail: message }));
    } catch (writeError) {
      console.error(`Failed to write error response: ${writeError.message}`);
    }
    console.error(`Failed to proxy ${req.url || '/'} -> ${targetBaseUrl}: ${message}`);
  };

  const requestOptions = isUnixSocket
    ? {
        socketPath,
        method: req.method,
        path: requestPath,
        headers: {
          ...req.headers,
          host: forwardedHost,
          'x-forwarded-host': forwardedHost,
          'x-forwarded-proto': forwardedProto,
          'x-forwarded-port': forwardedPort,
          connection: 'close'
        }
      }
    : {
        protocol: client === https ? 'https:' : 'http:',
        hostname: target.hostname,
        port: target.port || (client === https ? 443 : 80),
        method: req.method,
        path: requestPath,
        headers: {
          ...req.headers,
          host: forwardedHost,
          'x-forwarded-host': forwardedHost,
          'x-forwarded-proto': forwardedProto,
          'x-forwarded-port': forwardedPort,
          connection: 'close'
        }
      };

  const request = client.request(
    requestOptions,
    (proxyRes) => {
      if (responded) {
        // Upstream was slow to respond after we already timed out / aborted.
        proxyRes.resume();
        return;
      }

      const headers = { ...proxyRes.headers };
      if (headers.location) {
        headers.location = rewritePublicOriginHeader(headers.location, targetBaseUrl);
      }
      if (headers['x-middleware-rewrite']) {
        headers['x-middleware-rewrite'] = rewritePublicOriginHeader(
          headers['x-middleware-rewrite'],
          targetBaseUrl
        );
      }

      res.writeHead(proxyRes.statusCode || 502, headers);
      proxyRes.pipe(res);

      proxyRes.on('error', (error) => {
        failRequest(`upstream response error: ${error.message}`, 502);
      });

      proxyRes.on('aborted', () => {
        failRequest('upstream aborted response', 502);
      });

      proxyRes.on('close', () => {
        if (!res.writableEnded) {
          res.end();
        }
      });
    }
  );

  request.setTimeout(proxyRequestTimeoutMs, () => {
    request.destroy();
    failRequest(`upstream request timed out after ${proxyRequestTimeoutMs}ms`, 504);
  });

  request.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = requestPath.startsWith('/api') ? 503 : 502;
    failRequest(message, status);
  });

  req.on('aborted', () => {
    request.destroy();
  });

  req.on('error', (error) => {
    request.destroy();
    failRequest(`client request error: ${error.message}`, 502);
  });

  req.pipe(request);
}

function normalizeRequestPath(rawUrl) {
  try {
    const absolute = new URL(rawUrl);
    return `${absolute.pathname}${absolute.search}` || '/';
  } catch {
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  }
}

async function waitForSocket(socketPath, serviceName, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await fs.promises.access(socketPath, fs.constants.F_OK);
      console.log(`${serviceName} is accepting connections at ${socketPath}`);
      return;
    } catch {
      // Socket file not ready yet.
    }
    await delay(500);
  }

  throw new Error(`${serviceName} socket did not appear at ${socketPath} within ${timeoutMs}ms`);
}

async function waitForService(baseUrl, serviceName, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  const target = new URL(baseUrl);

  while (Date.now() < deadline) {
    const isReady = await new Promise((resolve) => {
      const socket = net.connect(
        {
          host: target.hostname,
          port: Number(target.port || (target.protocol === 'https:' ? 443 : 80))
        },
        () => {
          socket.end();
          resolve(true);
        }
      );

      socket.setTimeout(2000);
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        resolve(false);
      });
    });

    if (isReady) {
      console.log(`${serviceName} is accepting connections at ${baseUrl}`);
      return;
    }

    await delay(500);
  }

  throw new Error(`${serviceName} did not become ready at ${baseUrl} within ${timeoutMs}ms`);
}

function startProxyServer() {
  const server = http.createServer((req, res) => {
    const urlPath = normalizeRequestPath(req.url || '/');

    // Respond to platform/health probes immediately so the host does not
    // restart the process while the API and web handlers are still warming up.
    if (urlPath === '/health' || urlPath === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: isUpstreamReady ? 'up' : 'warming_up',
          uptime: process.uptime(),
          ready: isUpstreamReady
        })
      );
      return;
    }

    if (!isUpstreamReady) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Service warming up', detail: 'Upstreams are still starting' }));
      return;
    }

    const toApi = urlPath.startsWith('/api') || urlPath.startsWith('/uploads') || urlPath.startsWith('/socket.io');

    if (toApi && apiServer) {
      // API runs in-process; hand the request directly to the NestJS HTTP server.
      apiServer.emit('request', req, res);
      return;
    }

    if (!toApi && webHandler) {
      // Web runs in-process; hand the request directly to Next.js.
      webHandler(req, res);
      return;
    }

    const targetBaseUrl = toApi ? `unix:${apiSocketPath}` : internalWebUrl;
    proxyRequest(req, res, targetBaseUrl);
  });

  server.listen(publicPort, host, () => {
    console.log(`Public listener ready on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
  });

  // Route Socket.io WebSocket upgrades to the in-process API.
  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/socket.io') && apiServer) {
      apiServer.emit('upgrade', req, socket, head);
    } else {
      socket.destroy();
    }
  });

  return server;
}

async function startInProcessApi() {
  console.log('Starting API in-process (no secondary child process)');
  // Tell the API module not to auto-bootstrap; we will call createApiApp() ourselves.
  process.env.UNIFIED_MODE = 'true';
  const handlerPath = path.join(apiDir, 'dist', 'handler.js');
  const apiModule = await import(handlerPath);
  if (typeof apiModule.createApiApp !== 'function') {
    throw new Error(`Expected ${handlerPath} to export createApiApp`);
  }
  apiApp = await apiModule.createApiApp();
  apiServer = apiApp.getHttpServer();
  console.log('API initialized in-process');
}

async function startInProcessWeb() {
  console.log('Starting web handler in-process (no secondary child process)');
  const handlerPath = path.join(webDir, 'server-handler.js');
  // eslint-disable-next-line import/no-dynamic-require
  const webModule = require(handlerPath);
  if (typeof webModule.init !== 'function') {
    throw new Error(`Expected ${handlerPath} to export init()`);
  }
  webHandler = await webModule.init();
  console.log('Web handler initialized in-process');
}

async function startApiAsChild(socketPath) {
  // Clean up any stale socket file from a previous run.
  try {
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  } catch (cleanupError) {
    console.warn(`Unable to remove stale socket file ${socketPath}:`, cleanupError.message);
  }

  const apiEnv = {
    NODE_ENV: 'production',
    NODE_OPTIONS: `--max-old-space-size=${apiMemoryLimitMb}`,
    SOCKET_PATH: socketPath,
    FRONTEND_URL: frontendUrl
  };

  apiProcess = spawnProcess(nodeCommand, ['dist/main.js'], apiEnv, apiDir);

  apiProcess.on('exit', (code, signal) => {
    const details = ['API process exited'];
    if (typeof code === 'number') {
      details.push(`code=${code}`);
    }
    if (signal) {
      details.push(`signal=${signal}`);
    }
    console.error(details.join(' '));

    if (!isShuttingDown) {
      process.exit(1);
    }
  });

  await waitForSocket(socketPath, 'API service');
}

async function startWebChild() {
  const webEnv = {
    NODE_ENV: 'production',
    NODE_OPTIONS: `--max-old-space-size=${webMemoryLimitMb}`,
    PORT: internalWebPort,
    HOSTNAME: '127.0.0.1',
    FRONTEND_URL: frontendUrl,
    NEXT_PUBLIC_FRONTEND_URL: frontendUrl,
    NEXT_PUBLIC_SOCKET_URL: publicApiUrl || frontendUrl,
    API_PROXY_TARGET: `http://127.0.0.1:${publicPort}`,
    ...(publicApiUrl ? { NEXT_PUBLIC_API_URL: publicApiUrl } : {})
  };

  webProcess = spawnProcess(
    nodeCommand,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(internalWebPort)],
    webEnv,
    webDir
  );

  webProcess.on('exit', (code, signal) => {
    const details = ['Web process exited'];
    if (typeof code === 'number') {
      details.push(`code=${code}`);
    }
    if (signal) {
      details.push(`signal=${signal}`);
    }
    console.error(details.join(' '));

    if (!isShuttingDown) {
      process.exit(1);
    }
  });

  await waitForService(internalWebUrl, 'Web service');
}

async function startServices() {
  internalWebPort = await findAvailableLocalPort(preferredInternalWebPort);
  internalWebUrl = `http://127.0.0.1:${internalWebPort}`;

  console.log(`Starting unified app on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
  console.log(`API mode: ${apiMode}`);
  console.log(`Web mode: ${webMode}`);
  if (webMode === 'child') {
    console.log(`Internal web target: ${internalWebUrl}`);
  }
  if (publicApiUrl) {
    console.log(`Public API URL: ${publicApiUrl}`);
  }

  // Start the public listener immediately so platforms like Hostinger see
  // server.listen() within their startup window. Requests arriving before the
  // upstreams are ready receive a clear 503 instead of a connection failure.
  const proxyServer = startProxyServer();

  // Apply any pending database migrations before the API starts handling
  // requests. This prevents runtime errors caused by missing columns (e.g. the
  // contact form failing because the consent column has not been added yet).
  runMigrations();

  if (apiMode === 'in-process') {
    await startInProcessApi();
  } else if (apiMode === 'unix') {
    await startApiAsChild(apiSocketPath);
  } else {
    throw new Error(`Unsupported API_MODE: ${apiMode}. Use 'in-process' or 'unix'.`);
  }

  if (webMode === 'in-process') {
    await startInProcessWeb();
  } else if (webMode === 'child') {
    internalWebPort = await findAvailableLocalPort(preferredInternalWebPort);
    internalWebUrl = `http://127.0.0.1:${internalWebPort}`;
    await startWebChild();
  } else {
    throw new Error(`Unsupported WEB_MODE: ${webMode}. Use 'in-process' or 'child'.`);
  }
  isUpstreamReady = true;
  console.log('Upstreams are ready; proxy is now accepting traffic');

  const shutdown = () => {
    isShuttingDown = true;
    console.log('Stopping app services...');
    proxyServer.close();
    if (apiApp) {
      apiApp.close().catch((error) => {
        console.error('Error closing in-process API:', error);
      });
    }
    [apiProcess, webProcess].forEach((child) => {
      if (child && !child.killed) {
        child.kill('SIGTERM');
      }
    });
    try {
      if (fs.existsSync(apiSocketPath)) {
        fs.unlinkSync(apiSocketPath);
      }
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  loadDotEnvFile,
  loadEnvironmentFiles,
  normalizeRequestPath,
  resolveProxyProtocol,
  resolveForwardedProto,
  runMigrations,
  startProxyServer
};

// Start the server immediately when this file is loaded. Hostinger's Node.js
// hosting does not support guards like "if (require.main === module)"; it
// expects the entry file to call server.listen() without such conditions.
// Tests can prevent auto-start by setting NODE_ENV=test before requiring this file.
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await ensureBuilt();
      await startServices();
    } catch (error) {
      console.error('Unable to start the unified app:', error);
      process.exit(1);
    }
  })();
}
