// Prevent server.js from auto-starting when it is imported by the test runner.
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

const { loadDotEnvFile, resolveProxyProtocol, runMigrations, startProxyServer } = require('./server.js');

test('loadDotEnvFile loads environment variables from a .env file', () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    loadDotEnvFile(path.join(__dirname, '.env'));
    assert.match(process.env.DATABASE_URL || '', /postgresql:\/\/postgres:/);
  } finally {
    if (typeof original === 'undefined') {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  }
});

test('resolveProxyProtocol keeps local loopback upstreams on HTTP', () => {
  assert.equal(
    resolveProxyProtocol('http://127.0.0.1:3101/en', {
      headers: { host: 'localhost:3101', 'x-forwarded-proto': 'https' }
    }),
    'http'
  );
  assert.equal(
    resolveProxyProtocol('https://example.com/en', {
      headers: { host: 'example.com', 'x-forwarded-proto': 'https' }
    }),
    'https'
  );
});

test('resolveProxyProtocol honors comma-separated forwarded protocols', () => {
  assert.equal(
    resolveProxyProtocol('https://example.com/en', {
      headers: { host: 'example.com', 'x-forwarded-proto': 'https,http' }
    }),
    'https'
  );
  assert.equal(
    resolveProxyProtocol('http://127.0.0.1:3101/en', {
      headers: { host: 'localhost:3101', 'x-forwarded-proto': 'https,http' }
    }),
    'http'
  );
});

test('runMigrations skips when DATABASE_URL is not set', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  // Should not throw.
  await runMigrations();
  if (typeof originalDatabaseUrl === 'undefined') {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('runMigrations skips when SKIP_MIGRATIONS is true', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalSkipMigrations = process.env.SKIP_MIGRATIONS;
  process.env.DATABASE_URL = 'postgresql://localhost/test';
  process.env.SKIP_MIGRATIONS = 'true';
  // Should not throw.
  await runMigrations();
  process.env.DATABASE_URL = originalDatabaseUrl;
  if (typeof originalSkipMigrations === 'undefined') {
    delete process.env.SKIP_MIGRATIONS;
  } else {
    process.env.SKIP_MIGRATIONS = originalSkipMigrations;
  }
});

test('startProxyServer health endpoint responds 200 during warmup', async () => {
  const originalPort = process.env.PORT;
  process.env.PORT = '0';

  const server = startProxyServer();

  try {
    const port = await new Promise((resolve, reject) => {
      server.once('listening', () => {
        const address = server.address();
        resolve(address?.port || 0);
      });
      server.once('error', reject);
    });

    const response = await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body });
        });
      });
      req.on('error', reject);
      req.setTimeout(2000, () => {
        req.destroy();
        reject(new Error('Health probe request timed out'));
      });
    });

    assert.equal(response.statusCode, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.status, 'warming_up');
    assert.equal(parsed.ready, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  }
});
