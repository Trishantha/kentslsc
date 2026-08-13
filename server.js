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
const host = process.env.HOST || '0.0.0.0';
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || '';

// Unix socket used for internal API communication. Avoids the API child binding
// to a localhost TCP port, which shared-hosting supervisors often kill.
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

function resolveProxyProtocol(targetBaseUrl, req = {}) {
  const target = new URL(targetBaseUrl);
  const incomingHost = Array.isArray(req.headers?.host) ? req.headers.host[0] : req.headers?.host;
  const incomingProto = Array.isArray(req.headers?.['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers?.['x-forwarded-proto'];
  const isLocalHost = (value) => Boolean(value) && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(value);

  if (isLocalHost(incomingHost) || target.hostname === '127.0.0.1' || target.hostname === 'localhost') {
    return target.protocol === 'https:' ? 'https' : 'http';
  }

  return incomingProto === 'https' ? 'https' : target.protocol === 'https:' ? 'https' : 'http';
}

function resolveForwardedProto(req, targetBaseUrl, origin = frontendOrigin) {
  const target = new URL(targetBaseUrl);
  const incomingHost = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const incomingProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
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

    if (!isUpstreamReady) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Service warming up', detail: 'Upstreams are still starting' }));
      return;
    }

    const toApi = urlPath.startsWith('/api') || urlPath.startsWith('/uploads') || urlPath.startsWith('/socket.io');
    proxyRequest(req, res, toApi ? `unix:${apiSocketPath}` : internalWebUrl);
  });

  server.listen(publicPort, host, () => {
    console.log(`Public listener ready on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
  });

  return server;
}

async function startServices() {
  internalWebPort = await findAvailableLocalPort(preferredInternalWebPort);
  internalWebUrl = `http://127.0.0.1:${internalWebPort}`;

  // Clean up any stale socket file from a previous run.
  try {
    if (fs.existsSync(apiSocketPath)) {
      fs.unlinkSync(apiSocketPath);
    }
  } catch (cleanupError) {
    console.warn(`Unable to remove stale socket file ${apiSocketPath}:`, cleanupError.message);
  }

  console.log(`Starting unified app on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${publicPort}`);
  console.log(`Internal API target: ${apiSocketPath}`);
  console.log(`Internal web target: ${internalWebUrl}`);
  if (publicApiUrl) {
    console.log(`Public API URL: ${publicApiUrl}`);
  }

  // Start the public listener immediately so platforms like Hostinger see
  // server.listen() within their startup window. Requests arriving before the
  // upstreams are ready receive a clear 503 instead of a connection failure.
  const proxyServer = startProxyServer();

  const apiEnv = {
    NODE_ENV: 'production',
    NODE_OPTIONS: `--max-old-space-size=${apiMemoryLimitMb}`,
    SOCKET_PATH: apiSocketPath,
    FRONTEND_URL: frontendUrl
  };

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

  await waitForSocket(apiSocketPath, 'API service');
  await waitForService(internalWebUrl, 'Web service');
  isUpstreamReady = true;
  console.log('Upstreams are ready; proxy is now accepting traffic');

  const shutdown = () => {
    isShuttingDown = true;
    console.log('Stopping app services...');
    proxyServer.close();
    [apiProcess, webProcess].forEach((child) => {
      if (!child.killed) {
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
  normalizeRequestPath,
  resolveProxyProtocol,
  resolveForwardedProto
};

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
