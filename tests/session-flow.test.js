const test = require('node:test');
const assert = require('node:assert/strict');
const Flow = require('../session-flow.js');

const at = value => new Date(`2026-09-28T${value}:00Z`);
const planned = (id = 'session') => ({ id, date: '2026-09-28', goalId: 'goal', plannedMinutes: 50, status: 'PLANNED', source: 'ROUTINE' });

test('1. starts a planned session', () => {
  const session = Flow.start(planned(), [], at('07:00'));
  assert.equal(session.status, Flow.STATUS.IN_PROGRESS);
  assert.equal(session.startedAt, '2026-09-28T07:00:00.000Z');
});

test('2. pauses a running session', () => {
  const running = Flow.start(planned(), [], at('07:00'));
  const paused = Flow.pause(running, at('07:20'));
  assert.equal(paused.status, Flow.STATUS.PAUSED);
  assert.equal(paused.focusedSeconds, 1200);
});

test('3. resumes a paused session', () => {
  const paused = Flow.pause(Flow.start(planned(), [], at('07:00')), at('07:20'));
  const resumed = Flow.resume(paused, [paused], at('07:25'));
  assert.equal(resumed.status, Flow.STATUS.IN_PROGRESS);
  assert.equal(resumed.pausedDuration, 300);
});

test('4. completes a started session', () => {
  const completed = Flow.complete(Flow.start(planned(), [], at('07:00')), at('07:50'));
  assert.equal(completed.status, Flow.STATUS.COMPLETED);
  assert.equal(completed.endedAt, '2026-09-28T07:50:00.000Z');
});

test('5. calculates real focused time', () => {
  const completed = Flow.complete(Flow.start(planned(), [], at('07:00')), at('07:43'));
  assert.equal(completed.actualMinutes, 43);
});

test('6. excludes pauses from focused time', () => {
  const paused = Flow.pause(Flow.start(planned(), [], at('07:00')), at('07:20'));
  const resumed = Flow.resume(paused, [paused], at('07:25'));
  const completed = Flow.complete(resumed, at('07:50'));
  assert.equal(completed.actualMinutes, 45);
  assert.equal(completed.pausedDuration, 300);
});

test('7. recovers an in-progress session from timestamps', () => {
  const running = Flow.start(planned(), [], at('07:00'));
  assert.equal(Flow.actualMinutes(running, at('07:17')), 17);
});

test('8. rejects invalid questions and correct answers', () => {
  assert.throws(() => Flow.validateResult({ actualMinutes: 20, questions: 10, correct: 15 }), /acertos/);
});

test('9. calculates accuracy', () => {
  assert.equal(Flow.validateResult({ actualMinutes: 20, questions: 18, correct: 12 }).accuracy, 66.67);
});

test('10. completes a result without questions', () => {
  const result = Flow.validateResult({ actualMinutes: 20, questions: '', correct: '' });
  assert.equal(result.questions, null);
  assert.equal(result.accuracy, null);
});

test('11. skips a planned session', () => {
  const skipped = Flow.skip(planned(), 'Sem tempo hoje', at('07:00'));
  assert.equal(skipped.status, Flow.STATUS.SKIPPED);
  assert.equal(skipped.note, 'Sem tempo hoje');
});

test('12. reschedules and keeps the original record', () => {
  const { original, replacement } = Flow.reschedule(planned(), '2026-09-29', '18:00', at('07:00'), () => 'new');
  assert.equal(original.status, Flow.STATUS.RESCHEDULED);
  assert.equal(replacement.rescheduledFromSessionId, original.id);
  assert.equal(replacement.plannedEnd, '2026-09-29T18:50:00');
});

test('13. cancels a planned session', () => {
  assert.equal(Flow.cancel(planned(), at('07:00')).status, Flow.STATUS.CANCELLED);
});

test('14. prevents two simultaneous sessions', () => {
  const running = Flow.start(planned('one'), [], at('07:00'));
  assert.throws(() => Flow.start(planned('two'), [running], at('07:01')), /andamento/);
});

test('15. records manual activity as completed', () => {
  const session = Flow.manualSession({ goalId: 'goal', topic: 'Docker', actualMinutes: 42, questions: '', correct: '' }, at('07:00'), () => 'manual');
  assert.equal(session.source, 'MANUAL');
  assert.equal(session.status, Flow.STATUS.COMPLETED);
  assert.equal(session.topicName, 'Docker');
});
