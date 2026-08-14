const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveProxyProtocol } = require('./server.js');

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
