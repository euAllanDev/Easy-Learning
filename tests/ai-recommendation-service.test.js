const test = require('node:test');
const assert = require('node:assert/strict');
const Service = require('../ai-recommendation-service.js');
const pending = { id: 'rec', status: 'PENDING', type: 'REDUCE_LOAD', goalId: 'goal-a', suggestedChange: { minimumMinutes: 30, idealMinutes: 60 } };

test('applies a valid accepted recommendation through repositories', () => {
  let changes; const result = Service.apply(pending, { goalsRepository: { getById: () => ({ id: 'goal-a' }), update: (id, value) => { changes = { id, ...value }; } }, studentProfileRepository: {} });
  assert.equal(result.status, 'ACCEPTED'); assert.deepEqual(changes, { id: 'goal-a', minimumMinutesPerDay: 30, idealMinutesPerDay: 60 });
});
test('does not apply rejected or invalid recommendations', () => {
  assert.throws(() => Service.apply({ ...pending, status: 'REJECTED' }, { goalsRepository: {}, studentProfileRepository: {} }));
  assert.throws(() => Service.apply({ ...pending, goalId: 'missing' }, { goalsRepository: { getById: () => null }, studentProfileRepository: {} }));
});
