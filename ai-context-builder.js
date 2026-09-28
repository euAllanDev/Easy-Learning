const AIContextBuilder = (() => {
  const SETTINGS_DEFAULTS = { sendPerformanceData: true, sendStudyNotes: false, sendDetailedHistory: false };
  const dateForDaysAgo = (days, now) => { const date = new Date(now); date.setDate(date.getDate() - days + 1); return date.toISOString().slice(0, 10); };
  const sanitizeReview = (review, includeNotes) => ({ weekStart: review.weekStart, weekEnd: review.weekEnd, feeling: review.feeling, ...(includeNotes && review.notes ? { notes: review.notes } : {}) });

  function buildCoachContext({ profile = {}, settings = {}, analytics, goals = [], reviews = [], sessions = [], now = new Date(), days = 14 } = {}) {
    if (!analytics) throw new Error('Analytics is required to build the AI context.');
    const options = { ...SETTINGS_DEFAULTS, ...settings };
    const periodStart = dateForDaysAgo(days, now);
    const scopedSessions = sessions.filter(session => session.date >= periodStart && session.date <= now.toISOString().slice(0, 10));
    const context = {
      student: { preferredSessionMinutes: profile.preferredSessionMinutes || null, preferredStudyPeriod: profile.preferredStudyPeriod || 'FLEXIBLE' },
      period: { days },
      consistency: analytics.consistency,
      sessions: { planned: analytics.sessions.plannedSessions, completed: analytics.sessions.completedSessions, skipped: analytics.sessions.skippedSessions, rescheduled: analytics.sessions.rescheduledSessions },
      workload: { plannedMinutes: analytics.plannedMinutes, actualMinutes: analytics.actualMinutes, completionRatio: analytics.completionRatio },
      goals: analytics.goals.map(metric => {
        const goal = goals.find(item => item.id === metric.goalId);
        return { id: metric.goalId, name: goal?.name || 'Objetivo', priority: goal?.priority || 'MEDIUM', plannedMinutes: metric.plannedMinutes, actualMinutes: metric.actualMinutes, completionRate: metric.completionRate };
      }),
      timePeriods: analytics.timePeriods,
      recentReviews: reviews.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 4).map(review => sanitizeReview(review, options.sendStudyNotes))
    };
    if (!options.sendPerformanceData) {
      delete context.consistency;
      delete context.sessions;
      delete context.workload;
      context.goals = context.goals.map(({ id, name, priority }) => ({ id, name, priority }));
      context.timePeriods = [];
    }
    if (options.sendDetailedHistory) context.recentSessions = scopedSessions.slice(-20).map(({ date, goalId, status, plannedMinutes, actualMinutes }) => ({ date, goalId, status, plannedMinutes, actualMinutes }));
    return context;
  }
  return { SETTINGS_DEFAULTS, buildCoachContext };
})();

if (typeof module !== 'undefined') module.exports = AIContextBuilder;
