const test = require('node:test');
const assert = require('node:assert/strict');
const Analytics = require('../study-analytics.js');

const session = (changes = {}) => ({ id: crypto.randomUUID(), date: '2026-09-21', goalId: 'goal-a', topicId: 'topic-a', source: 'ROUTINE', status: 'COMPLETED', plannedMinutes: 60, actualMinutes: 45, plannedStart: '2026-09-21T08:00:00', questions: 10, correct: 8, difficulty: 'NORMAL', ...changes });
const availability = [{ dayOfWeek: 'MONDAY', startTime: '07:00', endTime: '10:00' }, { dayOfWeek: 'TUESDAY', startTime: '07:00', endTime: '10:00' }];

test('calculates consistency only on configured availability days', () => {
  const result = Analytics.calculateConsistency([session(), session({ id: 'two', date: '2026-09-22' })], availability, '2026-09-21', '2026-09-27');
  assert.deepEqual(result, { studyDays: 2, availableDays: 2, rate: 100 });
});
test('excludes cancelled and rescheduled sessions from completion denominator while keeping skips', () => {
  const result = Analytics.calculateCompletionRate([session(), session({ id: 'skip', status: 'SKIPPED' }), session({ id: 'cancel', status: 'CANCELLED' }), session({ id: 'move', status: 'RESCHEDULED' })]);
  assert.equal(result.rate, 50); assert.equal(result.skippedSessions, 1); assert.equal(result.cancelledSessions, 1); assert.equal(result.rescheduledSessions, 1);
});
test('aggregates goal and topic workload, accuracy and difficulty', () => {
  const sessions = [session(), session({ id: 'hard', actualMinutes: 60, questions: 20, correct: 10, difficulty: 'HARD' })];
  const goal = Analytics.calculateGoalStatistics(sessions, [{ id: 'goal-a' }])[0]; const topic = Analytics.calculateTopicStatistics(sessions, [{ id: 'topic-a' }])[0];
  assert.equal(goal.actualMinutes, 105); assert.equal(goal.accuracy, 60); assert.equal(topic.averageDifficulty, 2.5);
});
test('aggregates sessions by time period', () => {
  const result = Analytics.calculateTimePeriodStatistics([session(), session({ id: 'night', plannedStart: '2026-09-21T19:00:00', status: 'SKIPPED' })]);
  assert.equal(result.find(item => item.period === 'MORNING').completionRate, 100); assert.equal(result.find(item => item.period === 'EVENING').completionRate, 0);
});
test('builds a weekly summary and structured student profile', () => {
  const input = { sessions: [session()], goals: [{ id: 'goal-a' }], topics: [{ id: 'topic-a' }], availability, weekStart: '2026-09-21', weekEnd: '2026-09-27' };
  const weekly = Analytics.calculateWeeklySummary(input); const profile = Analytics.buildStudentProfileSummary({ ...input, periodStart: input.weekStart, periodEnd: input.weekEnd, reviews: [{ weekStart: '2026-09-21', feeling: 'BALANCED' }] });
  assert.equal(weekly.completionRatio, 75); assert.equal(weekly.difficulty.normalCount, 1); assert.equal(profile.period.days, 7); assert.equal(profile.sessions.completed, 1); assert.equal(profile.recentReviews.length, 1);
});
