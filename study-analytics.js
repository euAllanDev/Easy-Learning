const StudyAnalytics = (() => {
  const PERIODS = ['MORNING', 'AFTERNOON', 'EVENING'];
  const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const round = value => Number(value.toFixed(2));
  const dateValue = date => typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const inRange = (session, start, end) => session.date >= start && session.date <= end;
  const periodFor = session => {
    const hour = Number((session.plannedStart || `${session.date}T12:00:00`).slice(11, 13));
    return hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'EVENING';
  };
  const plannedSessions = sessions => sessions.filter(session => !['CANCELLED', 'RESCHEDULED'].includes(session.status) && session.source !== 'MANUAL');
  const completedSessions = sessions => sessions.filter(session => session.status === 'COMPLETED');
  const totals = sessions => {
    const completed = completedSessions(sessions);
    const questions = completed.reduce((sum, session) => sum + (session.questions || 0), 0);
    const correct = completed.reduce((sum, session) => sum + (session.correct || 0), 0);
    return { plannedMinutes: plannedSessions(sessions).reduce((sum, session) => sum + (session.plannedMinutes || 0), 0), actualMinutes: completed.reduce((sum, session) => sum + (session.actualMinutes || 0), 0), questions, correct, accuracy: questions ? round(correct / questions * 100) : null };
  };

  function calculateConsistency(sessions, availability, weekStart, weekEnd) {
    const completedDays = new Set(completedSessions(sessions.filter(session => inRange(session, weekStart, weekEnd))).map(session => session.date));
    let availableDays = 0;
    for (let cursor = new Date(`${weekStart}T12:00:00`), end = new Date(`${weekEnd}T12:00:00`); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      if (availability.some(item => item.dayOfWeek === DAY_NAMES[cursor.getDay()])) availableDays += 1;
    }
    return { studyDays: completedDays.size, availableDays, rate: availableDays ? round(completedDays.size / availableDays * 100) : null };
  }
  function calculateCompletionRate(sessions) {
    const planned = plannedSessions(sessions);
    const completed = planned.filter(session => session.status === 'COMPLETED');
    return { plannedSessions: planned.length, cancelledSessions: sessions.filter(session => session.status === 'CANCELLED').length, completedSessions: completed.length, skippedSessions: planned.filter(session => session.status === 'SKIPPED').length, rescheduledSessions: sessions.filter(session => session.status === 'RESCHEDULED').length, rate: planned.length ? round(completed.length / planned.length * 100) : null };
  }
  function calculateGoalStatistics(sessions, goals = []) {
    const ids = new Set([...goals.map(goal => goal.id), ...sessions.map(session => session.goalId).filter(Boolean)]);
    return [...ids].map(goalId => {
      const subset = sessions.filter(session => session.goalId === goalId); const values = totals(subset); const completion = calculateCompletionRate(subset);
      return { goalId, ...values, completedSessions: completedSessions(subset).length, skippedSessions: completion.skippedSessions, rescheduledSessions: completion.rescheduledSessions, completionRate: completion.rate };
    });
  }
  function calculateTopicStatistics(sessions, topics = []) {
    const ids = new Set([...topics.map(topic => topic.id), ...sessions.map(session => session.topicId).filter(Boolean)]);
    return [...ids].map(topicId => {
      const subset = sessions.filter(session => session.topicId === topicId); const values = totals(subset); const difficulties = completedSessions(subset).map(session => ({ EASY: 1, NORMAL: 2, HARD: 3 }[session.difficulty || 'NORMAL']));
      return { topicId, ...values, completedSessions: completedSessions(subset).length, averageDifficulty: difficulties.length ? round(difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length) : null };
    });
  }
  function calculateTimePeriodStatistics(sessions) {
    return PERIODS.map(period => {
      const subset = sessions.filter(session => periodFor(session) === period); const completion = calculateCompletionRate(subset); const values = totals(subset);
      return { period, plannedSessions: completion.plannedSessions, completedSessions: completion.completedSessions, skippedSessions: completion.skippedSessions, plannedMinutes: values.plannedMinutes, actualMinutes: values.actualMinutes, completionRate: completion.rate };
    });
  }
  function calculateDifficulty(sessions) {
    const values = completedSessions(sessions).map(session => ({ EASY: 1, NORMAL: 2, HARD: 3 }[session.difficulty || 'NORMAL']));
    return { easyCount: values.filter(value => value === 1).length, normalCount: values.filter(value => value === 2).length, hardCount: values.filter(value => value === 3).length, averageDifficulty: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null };
  }
  function calculateWeeklySummary({ sessions = [], goals = [], topics = [], availability = [], weekStart, weekEnd }) {
    const scoped = sessions.filter(session => inRange(session, weekStart, weekEnd)); const workload = totals(scoped); const completion = calculateCompletionRate(scoped); const consistency = calculateConsistency(sessions, availability, weekStart, weekEnd);
    return { weekStart, weekEnd, ...workload, completionRatio: workload.plannedMinutes ? round(workload.actualMinutes / workload.plannedMinutes * 100) : null, sessions: completion, consistency, goals: calculateGoalStatistics(scoped, goals), topics: calculateTopicStatistics(scoped, topics), timePeriods: calculateTimePeriodStatistics(scoped), difficulty: calculateDifficulty(scoped) };
  }
  function buildStudentProfileSummary({ sessions = [], goals = [], topics = [], availability = [], reviews = [], periodStart, periodEnd }) {
    const summary = calculateWeeklySummary({ sessions, goals, topics, availability, weekStart: dateValue(periodStart), weekEnd: dateValue(periodEnd) });
    return { period: { days: Math.round((new Date(`${summary.weekEnd}T12:00:00`) - new Date(`${summary.weekStart}T12:00:00`)) / 86400000) + 1, studyDays: summary.consistency.studyDays }, consistency: { rate: summary.consistency.rate }, workload: { plannedMinutes: summary.plannedMinutes, actualMinutes: summary.actualMinutes, completionRatio: summary.completionRatio }, sessions: { planned: summary.sessions.plannedSessions, completed: summary.sessions.completedSessions, skipped: summary.sessions.skippedSessions, rescheduled: summary.sessions.rescheduledSessions }, goals: summary.goals, topics: summary.topics, timePeriods: summary.timePeriods, recentReviews: reviews.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart)) };
  }
  return { calculateConsistency, calculateCompletionRate, calculateGoalStatistics, calculateTopicStatistics, calculateTimePeriodStatistics, calculateDifficulty, calculateWeeklySummary, buildStudentProfileSummary };
})();

if (typeof module !== 'undefined') module.exports = StudyAnalytics;
