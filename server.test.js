const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { loadDotEnvFile, resolveProxyProtocol } = require('./server.js');

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
