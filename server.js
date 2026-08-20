#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const https = require('https');
const v8 = require('v8');

const rootDir = __dirname;
const apiDir = path.join(rootDir, 'apps', 'api');
const webDir = path.join(rootDir, 'apps', 'web');
const nodeCommand = process.execPath;

// Shared-hosting process/thread limits are tight. Force conservative defaults for
// libraries that spawn helper threads/processes, unless the operator overrides them.
process.env.SHARP_NUM_THREADS = process.env.SHARP_NUM_THREADS || '1';
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1';

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

function redactDatabaseUrl(url) {
  if (!url) return '(not set)';
  try {
    const parsed = new URL(url);
    // Mask password if present; keep host/port/database for diagnostics.
    parsed.password = parsed.password ? '***' : '';
    return parsed.toString();
  } catch {
    return '(invalid URL)';
  }
}

async function runMigrations() {
  if (!process.env.DATABASE_URL || process.env.SKIP_MIGRATIONS === 'true') {
    console.log(
      process.env.DATABASE_URL
        ? 'Skipping database migrations (SKIP_MIGRATIONS=true).'
        : 'DATABASE_URL is not set; skipping database migrations.'
    );
    return;
  }

  console.log(`DATABASE_URL target: ${redactDatabaseUrl(process.env.DATABASE_URL)}`);

  // Prefer the actual Prisma Node entry point over the .bin shell shim, because
  // Hostinger's build environment sometimes strips execute permission from the
  // shim (EACCES). Running it via Node avoids that entirely.
  const prismaEntryCandidates = [
    path.join(rootDir, 'packages', 'database', 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js')
  ];
  let prismaEntry = prismaEntryCandidates.find((candidate) => fs.existsSync(candidate));

  if (!prismaEntry) {
    const pnpmPrismaDir = path.join(rootDir, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmPrismaDir)) {
      const prismaPkgDir = fs
        .readdirSync(pnpmPrismaDir)
        .find((name) => name.startsWith('prisma@'));
      if (prismaPkgDir) {
        const candidate = path.join(
          pnpmPrismaDir,
          prismaPkgDir,
          'node_modules',
          'prisma',
          'build',
          'index.js'
        );
        if (fs.existsSync(candidate)) {
          prismaEntry = candidate;
        }
      }
    }
  }

  if (!prismaEntry) {
    console.warn(
      `Prisma CLI entry not found in any of: ${prismaEntryCandidates.join(', ')}; skipping migrations.`
    );
    return;
  }
  console.log(`Using Prisma CLI entry at: ${prismaEntry}`);

  // Hostinger's build environment strips execute permission from Prisma's native
  // engine binaries. Find them and chmod +x before Prisma tries to spawn them.
  const chmodPrismaEngines = () => {
    const searchRoots = [
      path.join(rootDir, 'node_modules', '.pnpm'),
      path.join(rootDir, 'packages', 'database', 'node_modules', '.pnpm')
    ];
    for (const searchRoot of searchRoots) {
      if (!fs.existsSync(searchRoot)) continue;
      try {
        const entries = fs.readdirSync(searchRoot);
        for (const entry of entries) {
          if (!entry.startsWith('@prisma+engines@')) continue;
          const enginesDir = path.join(searchRoot, entry, 'node_modules', '@prisma', 'engines');
          if (!fs.existsSync(enginesDir)) continue;
          const engineFiles = fs.readdirSync(enginesDir);
          for (const engineFile of engineFiles) {
            if (engineFile.startsWith('schema-engine-') || engineFile.startsWith('query-engine-')) {
              const enginePath = path.join(enginesDir, engineFile);
              try {
                fs.chmodSync(enginePath, 0o755);
                console.log(`Made executable: ${enginePath}`);
              } catch (chmodErr) {
                console.warn(`Could not chmod ${enginePath}: ${chmodErr.message}`);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Could not chmod Prisma engines under ${searchRoot}: ${err.message}`);
      }
    }
  };
  chmodPrismaEngines();

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

  // Verify the Prisma CLI can execute via Node before running migrations.
  // This check spawns a child process; on shared hosts with tight process caps
  // it can exhaust the account budget and delay startup. Skip it when the
  // operator has already opted out or when migrations are disabled entirely.
  if (process.env.SKIP_PRISMA_VERSION_CHECK === 'true' || process.env.SKIP_MIGRATIONS === 'true') {
    console.log('Skipping Prisma --version check (SKIP_PRISMA_VERSION_CHECK or SKIP_MIGRATIONS set).');
  } else {
    const versionResult = await spawnWithRetry(
      nodeCommand,
      [prismaEntry, '--version'],
      { cwd: rootDir, stdio: 'pipe', env: process.env },
      { label: 'Prisma --version', maxAttempts: 5 }
    );
    if (versionResult.status !== 0) {
      console.error('Prisma --version failed:', versionResult.error ? versionResult.error.message : '');
      if (versionResult.stderr) console.error(versionResult.stderr.toString());
      if (versionResult.stdout) console.log(versionResult.stdout.toString());
      // When the process limit is exhausted we may not be able to spawn Prisma at
      // all. Rather than crash the whole unified server, log loudly and continue.
      // Migrations are idempotent, so a skipped check here is safer than a startup
      // death spiral. Operators can set SKIP_MIGRATIONS=true to silence this.
      if (isResourceError(versionResult.error)) {
        console.warn(
          `WARNING: Prisma CLI could not be spawned due to a resource limit (${versionResult.error.code}). ` +
            'Skipping database migrations and continuing startup. Set SKIP_MIGRATIONS=true to silence this warning.'
        );
        return;
      }
      console.warn(
        'WARNING: Could not verify Prisma CLI executability. Continuing anyway; ' +
          'if migrate deploy fails below, increase available processes or set SKIP_MIGRATIONS=true.'
      );
    } else {
      console.log('Prisma CLI is executable.');
    }
  }

  // Some migrations were previously run against a database that already had the
  // target schema objects, leaving them in a failed state. If `migrate deploy`
  // hits P3009 for a specific migration, resolve that migration as applied and
  // retry so the rest of the pending migrations can continue.
  const runMigrateDeploy = async () =>
    spawnWithRetry(
      nodeCommand,
      [prismaEntry, 'migrate', 'deploy', '--schema', schemaPath],
      { cwd: rootDir, stdio: 'pipe', env: process.env },
      { label: 'prisma migrate deploy', maxAttempts: 5 }
    );

  let remainingAttempts = 10;
  let result = await runMigrateDeploy();
  while (result.status !== 0 && remainingAttempts > 0) {
    const output = (result.stdout ? result.stdout.toString() : '') + (result.stderr ? result.stderr.toString() : '');

    if (result.stdout) {
      console.log(result.stdout.toString());
    }
    if (result.stderr) {
      console.error(result.stderr.toString());
    }
    if (result.error) {
      console.error('Migration spawn error:', result.error.message);
    }

    const failedMatch = output.match(/The `([^`]+)` migration started at/);
    if (!failedMatch) {
      break;
    }

    const failedMigration = failedMatch[1];
    console.log(`Resolving failed migration ${failedMigration} as applied...`);
    const resolveResult = spawnSync(
      nodeCommand,
      [prismaEntry, 'migrate', 'resolve', '--applied', failedMigration, '--schema', schemaPath],
      {
        cwd: rootDir,
        stdio: 'pipe',
        env: process.env
      }
    );
    if (resolveResult.stdout) {
      console.log(resolveResult.stdout.toString());
    }
    if (resolveResult.stderr) {
      console.error(resolveResult.stderr.toString());
    }

    remainingAttempts -= 1;
    result = await runMigrateDeploy();
  }

  if (result.stdout) {
    console.log(result.stdout.toString());
  }
  if (result.stderr) {
    console.error(result.stderr.toString());
  }
  if (result.error) {
    console.error('Migration spawn error:', result.error.message);
  }

  // Prisma P1001 means the database server is unreachable. This is usually a
  // transient network or Supabase IP-restriction issue, not a migration problem.
  // Crashing the unified server in a tight loop produces a 503 for every visitor
  // and prevents the health endpoint from reporting status. Continue startup so
  // the proxy can serve traffic; the API will surface its own DB errors at
  // runtime and the operator can address the connectivity issue separately.
  const isDbUnreachableError = (stdout, stderr) => {
    const combined = `${stdout || ''}${stderr || ''}`;
    return /\bP1001\b/.test(combined) || /Can't reach database server/.test(combined);
  };

  // Prisma P3005 means the database schema is not empty. This happens when an
  // existing database is connected to a fresh migration history. The app can usually
  // still serve traffic because the schema objects already exist, but new migrations
  // will not be applied automatically until the baseline is resolved.
  const isBaselineError = (stdout, stderr) => {
    const combined = `${stdout || ''}${stderr || ''}`;
    return /\bP3005\b/.test(combined) || /database schema is not empty/.test(combined);
  };

  if (result.status !== 0) {
    // If the migration command could not be spawned due to resource limits, do not
    // crash the unified server in a loop. On shared hosts the account process cap
    // is sometimes exhausted during startup. Skipping migrations lets the app serve
    // traffic; migrations are idempotent and can be applied manually or on the
    // next deploy when resources are available.
    if (isResourceError(result.error)) {
      console.warn(
        `WARNING: Database migration could not run due to a resource limit (${result.error.code}). ` +
          'Skipping migrations and continuing startup. Set SKIP_MIGRATIONS=true to silence this warning.'
      );
      return;
    }

    if (isDbUnreachableError(result.stdout, result.stderr)) {
      console.warn(
        'WARNING: Database is unreachable during migrations (Prisma P1001). ' +
          'The unified server will continue starting so the proxy and health endpoint are available. ' +
          'Investigate the DATABASE_URL network path / Supabase IP allow-list; ' +
          'set SKIP_MIGRATIONS=true to silence this warning.'
      );
      return;
    }

    if (isBaselineError(result.stdout, result.stderr)) {
      console.warn(
        'WARNING: Database migration failed with Prisma P3005 (database schema is not empty). ' +
          'This usually means the production database already contains the schema but the migration ' +
          'history has not been baselined. The unified server will continue starting so the site ' +
          'remains available, but new migrations will NOT run automatically until this is resolved. ' +
          'Baseline the database by running: pnpm --filter @kentslsc/database exec prisma migrate resolve --applied <first-migration-name> ' +
          'Or set SKIP_MIGRATIONS=true to silence this warning.'
      );
      return;
    }

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

// When running the API/web in-process (or child mode on the same host), the
// public origin may be unreachable from inside the container and the build may
// have baked in a different default (e.g. http://localhost:3001). Set the
// internal API origin before any Next.js module is loaded so server-side fetches
// and rewrites target the local unified proxy.
//
// In webMode === 'in-process' the Next.js runtime lives inside this process, so
// we always route internal server-to-API calls through the local listener.
// webMode === 'child' gets the same variables explicitly when spawned below.
const localApiOrigin = `http://127.0.0.1:${publicPort}`;
if (webMode === 'in-process') {
  process.env.API_PROXY_TARGET = localApiOrigin;
  process.env.INTERNAL_API_URL = localApiOrigin;
} else {
  process.env.API_PROXY_TARGET = process.env.API_PROXY_TARGET || localApiOrigin;
  process.env.INTERNAL_API_URL = process.env.INTERNAL_API_URL || localApiOrigin;
}

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

// Hostinger's shared Node.js plans cap the number of processes/threads. Spawning
// the Prisma CLI during startup can fail with EAGAIN when the account is near that
// cap. Retry transient resource errors with a short backoff instead of crashing.
const isResourceError = (error) =>
  error && ['EAGAIN', 'EMFILE', 'ENOMEM', 'EBUSY'].includes(error.code);

async function spawnWithRetry(command, args, options, { label, maxAttempts = 5 } = {}) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    const result = spawnSync(command, args, options);

    if (!result.error || !isResourceError(result.error)) {
      return result;
    }

    console.warn(
      `${label || 'spawn'} failed with ${result.error.code} (attempt ${attempt}/${maxAttempts}); ` +
        'retrying after short delay...'
    );

    if (attempt < maxAttempts) {
      await delay(1000 * 2 ** (attempt - 1));
    }
  }

  // Return the last failed result so the caller can decide what to do.
  return spawnSync(command, args, options);
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

function logStartupDiagnostics() {
  const heapStats = v8.getHeapStatistics();
  const memory = process.memoryUsage();
  const heapLimitMb = Math.round(heapStats.heap_size_limit / 1024 / 1024);
  const rssMb = Math.round(memory.rss / 1024 / 1024);

  // Count this process's threads from /proc on Linux. Hostinger's process limit
  // counts threads, so this is a useful diagnostic on shared hosting.
  let threadCount = null;
  try {
    const status = fs.readFileSync('/proc/self/status', 'utf8');
    const match = status.match(/^Threads:\s*(\d+)/m);
    if (match) {
      threadCount = Number(match[1]);
    }
  } catch {
    // Non-Linux or no /proc access.
  }

  console.log(`Node options: ${process.env.NODE_OPTIONS || '(none)'}`);
  console.log(`Process memory limit (heap): ${heapLimitMb} MB`);
  console.log(`Process RSS at startup: ${rssMb} MB`);
  if (threadCount !== null) {
    console.log(`Threads in this process: ${threadCount}`);
  }

  if (apiMode === 'in-process' && webMode === 'in-process' && heapLimitMb < 1536) {
    console.warn(
      'WARNING: API and web handlers are both running in-process. ' +
      'This loads NestJS, Prisma, and Next.js in a single Node process and can exceed ' +
      'shared-hosting memory limits. Consider increasing NODE_OPTIONS (e.g. ' +
      "--max-old-space-size=2048) or using API_MODE=unix / WEB_MODE=child."
    );
  }
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
    console.error(`Upstream connection error for ${requestPath} -> ${targetBaseUrl}: ${message}`);
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

function getStaticMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon'
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Serve Next.js static assets directly from the filesystem.
 *
 * On some shared-hosting/reverse-proxy setups the in-process Next.js handler
 * does not receive or cannot serve `/_next/static/*` requests. Serving them
 * here guarantees the CSS/JS chunks that hydrate the page are delivered with
 * correct MIME types and long-term caching headers.
 *
 * If the file is missing from the build output we fall back to the in-process
 * Next.js handler. This covers builds where chunk hashes differ between the HTML
 * and the static manifest, and it keeps the request inside the process instead
 * of returning a plain 404.
 */
function serveNextStaticFile(req, res, fallback) {
  const url = new URL(req.url || '/', 'http://localhost');
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/_next\/static\//, '');
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(webDir, '.next', 'static', safePath);

  if (!filePath.startsWith(path.join(webDir, '.next', 'static'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (typeof fallback === 'function') {
        fallback();
        return;
      }
      console.error(`Static file not found: ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const contentType = getStaticMimeType(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(data);
  });
}

function startProxyServer() {
  const server = http.createServer((req, res) => {
    const urlPath = normalizeRequestPath(req.url || '/');

    // Respond to platform/health probes immediately so the host does not
    // restart the process while the API and web handlers are still warming up.
    if (urlPath === '/health' || urlPath === '/api/health') {
      if (!isUpstreamReady) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            status: 'warming_up',
            uptime: process.uptime(),
            ready: false
          })
        );
        return;
      }

      // Once the API is up, the readiness endpoint reflects real dependency health
      // (database, email, payments, storage). Rewrite the path and proxy to the API.
      req.url = '/api/health/ready';
      const toApi = true;
      if (apiServer) {
        apiServer.emit('request', req, res);
      } else {
        proxyRequest(req, res, `unix:${apiSocketPath}`);
      }
      return;
    }

    if (!isUpstreamReady) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Service warming up', detail: 'Upstreams are still starting' }));
      return;
    }

    // Serve Next.js static assets directly from the build output. This
    // bypasses any reverse-proxy or in-process handler issues that can otherwise
    // return 404 / text-plain responses for CSS and JS chunks.
    if (urlPath.startsWith('/_next/static/')) {
      serveNextStaticFile(req, res, () => {
        if (webHandler) {
          webHandler(req, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
        }
      });
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
  // Make sure Next.js server-side fetches and rewrites target the local proxy
  // instead of relying on a public origin that may not be reachable from the host.
  const localApiOrigin = `http://127.0.0.1:${publicPort}`;
  process.env.API_PROXY_TARGET = process.env.API_PROXY_TARGET || localApiOrigin;
  // Force server-to-API calls inside this process to use the local in-process
  // listener, even if the env file points API_PROXY_TARGET at a public URL.
  process.env.INTERNAL_API_URL = localApiOrigin;
  console.log(`Server-side API origin forced to local: ${localApiOrigin}`);
  const handlerPath = path.join(webDir, 'server-handler.js');
  // eslint-disable-next-line import/no-dynamic-require
  const webModule = require(handlerPath);
  if (typeof webModule.init !== 'function') {
    throw new Error(`Expected ${handlerPath} to export init()`);
  }
  webHandler = await webModule.init();
  console.log('Web handler initialized in-process');
}

/**
 * Verify that critical API routes are reachable through the in-process listener.
 *
 * This catches stale or corrupted API builds where controllers are missing and
 * routes return 404. We do not crash the whole process on shared hosts (the host
 * would just restart it in a tight loop), but we keep the proxy in warming_up
 * state and log the failure loudly so the operator knows the build is bad.
 */
async function verifyCriticalApiRoutes() {
  if (apiMode !== 'in-process' || !apiServer) {
    return true;
  }

  const routes = ['/api/pages/home', '/api/hero-config', '/api/health'];
  const failures = [];

  const isRouteNotRegistered = (status, body) => {
    if (status !== 404) return false;
    const text = String(body).toLowerCase();
    // A genuine "resource not found" from a working controller says the route is
    // registered and the build is fine. Only treat router-level "unknown route"
    // responses as build failures.
    if (text.includes('home page not found')) return false;
    if (text.includes('hero config') && text.includes('not found')) return false;
    return true;
  };

  for (const route of routes) {
    const result = await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: publicPort,
          path: route,
          method: 'GET'
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode, body: body.slice(0, 500) });
          });
        }
      );
      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ status: null, body: 'timeout' });
      });
      req.on('error', (error) => {
        resolve({ status: null, body: error.message });
      });
      req.end();
    });

    // 404 from the router means the controller/route is missing from the build.
    // 404 from a service (e.g. "Home page not found") is expected on a fresh DB.
    // 500/503 may be transient while the database is still unreachable.
    if (isRouteNotRegistered(result.status, result.body)) {
      failures.push({ route, ...result });
    }
  }

  if (failures.length > 0) {
    console.error(
      'CRITICAL: Some API routes are missing. This usually means apps/api/dist ' +
        'is stale or was built from a different commit. Rebuild the API and redeploy. ' +
        'Missing routes:'
    );
    for (const failure of failures) {
      console.error(`  ${failure.route} -> HTTP ${failure.status}: ${failure.body}`);
    }
    return false;
  }

  return true;
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
    INTERNAL_API_URL: `http://127.0.0.1:${publicPort}`,
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
  logStartupDiagnostics();
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
  await runMigrations();

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

  const apiRoutesOk = await verifyCriticalApiRoutes();
  isUpstreamReady = apiRoutesOk;
  if (apiRoutesOk) {
    console.log('Upstreams are ready; proxy is now accepting traffic');
  } else {
    console.error(
      'Upstreams started but critical API routes are missing. ' +
        'The health endpoint will continue to report warming_up until the build is fixed.'
    );
  }

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

function registerFatalErrorHandlers() {
  process.on('uncaughtException', (error) => {
    console.error('FATAL: uncaught exception in unified server:', error);
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('FATAL: unhandled rejection in unified server:', reason);
    if (reason && reason.stack) {
      console.error(reason.stack);
    }
  });
}

// Start the server immediately when this file is loaded. Hostinger's Node.js
// hosting does not support guards like "if (require.main === module)"; it
// expects the entry file to call server.listen() without such conditions.
// Tests can prevent auto-start by setting NODE_ENV=test before requiring this file.
if (process.env.NODE_ENV !== 'test') {
  registerFatalErrorHandlers();
  (async () => {
    try {
      await ensureBuilt();
      await startServices();
    } catch (error) {
      console.error('Unable to start the unified app:', error);
      if (error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  })();
}
