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
const frontendOrigin = new URL(frontendUrl);
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || '';

let internalWebPort = preferredInternalWebPort;
let apiPort = preferredApiPort;
let internalWebUrl = `http://127.0.0.1:${internalWebPort}`;
let internalApiUrl = `http://127.0.0.1:${apiPort}`;

let apiProcess;
let webProcess;
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
  const client = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(target.hostname) ? http : (target.protocol === 'https:' ? https : http);
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
  const forwardedProto =
    (Array.isArray(req.headers['x-forwarded-proto'])
      ? req.headers['x-forwarded-proto'][0]
      : req.headers['x-forwarded-proto']) || frontendOrigin.protocol.slice(0, -1);
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

  const request = client.request(
    {
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
    },
    (proxyRes) => {
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
    }
  );

  request.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = requestPath.startsWith('/api') ? 503 : 502;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Upstream service unavailable', detail: message }));
    console.error(`Failed to proxy ${req.url || '/'} -> ${targetBaseUrl}: ${message}`);
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

    if (!isUpstreamReady) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Service warming up', detail: 'Upstreams are still starting' }));
      return;
    }

    const toApi = urlPath.startsWith('/api') || urlPath.startsWith('/uploads') || urlPath.startsWith('/socket.io');
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

  const onChildExit = (name, code, signal) => {
    const details = [`${name} exited`];
    if (typeof code === 'number') {
      details.push(`code=${code}`);
    }
    if (signal) {
      details.push(`signal=${signal}`);
    }
    console.error(details.join(' '));

    if (!isShuttingDown) {
      // Exit fast so the platform can restart the whole stack instead of serving stale 503 responses.
      process.exit(1);
    }
  };

  apiProcess.on('exit', (code, signal) => onChildExit('API process', code, signal));
  webProcess.on('exit', (code, signal) => onChildExit('Web process', code, signal));

  const proxyServer = startProxyServer();

  await waitForService(internalApiUrl, 'API service');
  await waitForService(internalWebUrl, 'Web service');
  isUpstreamReady = true;

  const shutdown = () => {
    isShuttingDown = true;
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
