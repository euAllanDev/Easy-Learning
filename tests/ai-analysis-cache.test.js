const test = require('node:test');
const assert = require('node:assert/strict');
const Cache = require('../ai-analysis-cache.js');

test('reuses only a non-expired analysis with the same context hash', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  assert.equal(Cache.isValid({ contextHash: 'same', createdAt: new Date(now - 1000).toISOString() }, 'same', now), true);
  assert.equal(Cache.isValid({ contextHash: 'same', createdAt: new Date(now - Cache.TTL_MS).toISOString() }, 'same', now), false);
  assert.equal(Cache.isValid({ contextHash: 'old', createdAt: new Date(now).toISOString() }, 'same', now), false);
});
