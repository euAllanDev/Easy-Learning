const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../routine-engine.js');

const date = '2026-09-28';
const availability = (start = '07:00', end = '12:00') => [{ dayOfWeek: 'MONDAY', startTime: start, endTime: end }];
const goal = (id, priority = 'MEDIUM', ideal = 60, minimum = 20) => ({ id, name: id, priority, idealMinutesPerDay: ideal, minimumMinutesPerDay: minimum, status: 'ACTIVE' });
const generate = overrides => Engine.generate({ date, goals: [goal('a')], availability: availability(), areas: [], topics: [], existingSessions: [], config: { breakMinutes: 0 }, ...overrides });
const minutesFor = (result, goalId) => result.sessions.filter(session => session.goalId === goalId).reduce((sum, session) => sum + session.plannedMinutes, 0);

test('1. generates one goal when availability is sufficient', () => {
  const result = generate();
  assert.equal(minutesFor(result, 'a'), 60);
  assert.equal(result.sessions[0].source, 'ROUTINE');
});

test('2. generates multiple active goals', () => {
  const result = generate({ goals: [goal('a'), goal('b')] });
  assert.equal(minutesFor(result, 'a'), 60);
  assert.equal(minutesFor(result, 'b'), 60);
});

test('3. favors higher priorities under contention', () => {
  const result = generate({ availability: availability('07:00', '09:00'), goals: [goal('high', 'HIGH', 120, 20), goal('low', 'LOW', 120, 20)] });
  assert.ok(minutesFor(result, 'high') > minutesFor(result, 'low'));
});

test('4. reaches ideal goals when they fit', () => {
  const result = generate({ goals: [goal('a', 'HIGH', 100, 20), goal('b', 'MEDIUM', 40, 20)] });
  assert.equal(minutesFor(result, 'a'), 100);
  assert.equal(minutesFor(result, 'b'), 40);
  assert.ok(!result.warnings.includes(Engine.WARNINGS.IDEAL_GOALS_NOT_REACHED));
});

test('5. warns when ideal goals do not fit', () => {
  const result = generate({ availability: availability('07:00', '08:30'), goals: [goal('a', 'HIGH', 90, 30), goal('b', 'MEDIUM', 90, 30)] });
  assert.ok(result.warnings.includes(Engine.WARNINGS.INSUFFICIENT_TIME));
  assert.ok(result.totalPlannedMinutes <= result.totalAvailableMinutes);
});

test('6. allocates minimum contention by priority', () => {
  const result = generate({ availability: availability('07:00', '08:00'), goals: [goal('high', 'HIGH', 120, 60), goal('medium', 'MEDIUM', 60, 20)] });
  assert.equal(minutesFor(result, 'high'), 60);
  assert.equal(minutesFor(result, 'medium'), 0);
  assert.ok(result.warnings.includes(Engine.WARNINGS.MINIMUM_GOALS_NOT_REACHED));
});

test('7. never schedules through unavailable gaps', () => {
  const result = generate({ availability: [...availability('07:00', '08:00'), { dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '11:00' }], goals: [goal('a', 'HIGH', 120, 20)] });
  assert.deepEqual(result.sessions.map(session => [session.plannedStart.slice(11, 16), session.plannedEnd.slice(11, 16)]), [['07:00', '08:00'], ['10:00', '11:00']]);
});

test('8. returns no availability warning', () => {
  const result = generate({ availability: [] });
  assert.equal(result.sessions.length, 0);
  assert.deepEqual(result.warnings, [Engine.WARNINGS.NO_AVAILABILITY]);
});

test('9. ignores inactive goals', () => {
  const result = generate({ goals: [{ ...goal('a'), status: 'PAUSED' }] });
  assert.deepEqual(result.warnings, [Engine.WARNINGS.NO_ACTIVE_GOALS]);
});

test('10. preserves completed sessions while regenerating', () => {
  const completed = { id: 'completed', date, goalId: 'a', plannedStart: `${date}T07:00:00`, plannedEnd: `${date}T07:30:00`, plannedMinutes: 30, status: 'COMPLETED', source: 'ROUTINE' };
  const result = generate({ existingSessions: [completed] });
  assert.ok(result.sessions.some(session => session.id === 'completed'));
  assert.ok(result.sessions.every(session => session.id === 'completed' || session.plannedStart >= `${date}T07:30:00`));
});

test('10b. preserves paused sessions while regenerating', () => {
  const paused = { id: 'paused', date, goalId: 'a', plannedStart: `${date}T07:00:00`, plannedEnd: `${date}T07:30:00`, plannedMinutes: 30, status: 'PAUSED', source: 'ROUTINE' };
  const result = generate({ existingSessions: [paused] });
  assert.ok(result.sessions.some(session => session.id === 'paused'));
});

test('11. is deterministic without duplicate generated sessions', () => {
  const input = { date, goals: [goal('a')], availability: availability(), areas: [], topics: [], existingSessions: [], config: { breakMinutes: 0 } };
  const first = Engine.generate(input);
  const second = Engine.generate(input);
  assert.deepEqual(second.sessions, first.sessions);
});

test('12. rotates topics sequentially', () => {
  const result = generate({ goals: [goal('a', 'HIGH', 120, 20)], areas: [{ id: 'area', goalId: 'a' }], topics: [{ id: 'sql', areaId: 'area' }, { id: 'normalization', areaId: 'area' }] });
  assert.deepEqual(result.sessions.map(session => session.topicId), ['normalization', 'sql']);
});
