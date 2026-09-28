const test = require('node:test');
const assert = require('node:assert/strict');
const Builder = require('../ai-context-builder.js');

const analytics = { consistency: { studyDays: 3, availableDays: 4, rate: 75 }, sessions: { plannedSessions: 4, completedSessions: 3 }, plannedMinutes: 200, actualMinutes: 150, completionRatio: 75, goals: [{ goalId: 'goal-a', plannedMinutes: 200, actualMinutes: 150, completionRate: 75 }], timePeriods: [] };
const input = { profile: { preferredSessionMinutes: 50, fullName: 'Private' }, analytics, goals: [{ id: 'goal-a', name: 'Goal', priority: 'HIGH' }], reviews: [{ weekStart: '2026-09-21', weekEnd: '2026-09-27', feeling: 'BALANCED', notes: 'Private note' }], sessions: [{ date: '2026-09-28', goalId: 'goal-a', status: 'COMPLETED', plannedMinutes: 50, actualMinutes: 50 }], now: new Date('2026-09-28T12:00:00Z') };

test('builds a limited deterministic context without personal data or notes by default', () => {
  const first = Builder.buildCoachContext(input); const second = Builder.buildCoachContext(input);
  assert.deepEqual(first, second); assert.equal(first.student.fullName, undefined); assert.equal(first.recentReviews[0].notes, undefined); assert.equal(first.recentSessions, undefined); assert.equal(first.goals[0].name, 'Goal');
});
test('respects privacy settings and limits detailed session history', () => {
  const context = Builder.buildCoachContext({ ...input, settings: { sendPerformanceData: false, sendStudyNotes: true, sendDetailedHistory: true }, sessions: Array.from({ length: 25 }, (_, index) => ({ ...input.sessions[0], date: `2026-09-${String(index + 1).padStart(2, '0')}` })) });
  assert.equal(context.workload, undefined); assert.equal(context.recentReviews[0].notes, 'Private note'); assert.ok(context.recentSessions.length <= 20);
});
