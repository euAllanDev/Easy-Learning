const RoutineEngine = (() => {
  const DEFAULT_CONFIG = {
    minimumSessionMinutes: 20,
    maximumSessionMinutes: 90,
    breakMinutes: 10,
    priorityWeights: { HIGH: 3, MEDIUM: 2, LOW: 1 }
  };

  const WARNINGS = {
    NO_AVAILABILITY: 'NO_AVAILABILITY',
    INSUFFICIENT_TIME: 'INSUFFICIENT_TIME',
    MINIMUM_GOALS_NOT_REACHED: 'MINIMUM_GOALS_NOT_REACHED',
    IDEAL_GOALS_NOT_REACHED: 'IDEAL_GOALS_NOT_REACHED',
    NO_ACTIVE_GOALS: 'NO_ACTIVE_GOALS'
  };

  function toMinutes(time) { const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; }
  function toTime(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
  function weekday(date) { return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${date}T12:00:00`).getDay()]; }
  function dateTime(date, time) { return `${date}T${time}:00`; }
  function uniqueWarnings(warnings) { return [...new Set(warnings)]; }

  function subtractIntervals(intervals, blocks) {
    return intervals.flatMap(interval => {
      let segments = [{ start: toMinutes(interval.startTime), end: toMinutes(interval.endTime) }];
      blocks.forEach(block => {
        const start = toMinutes(block.plannedStart.slice(11, 16));
        const end = toMinutes(block.plannedEnd.slice(11, 16));
        segments = segments.flatMap(segment => {
          if (end <= segment.start || start >= segment.end) return [segment];
          return [start > segment.start && { start: segment.start, end: start }, end < segment.end && { start: end, end: segment.end }].filter(Boolean);
        });
      });
      return segments;
    }).sort((a, b) => a.start - b.start);
  }

  function distribute(goals, availableMinutes, config) {
    const allocations = new Map(goals.map(goal => [goal.id, 0]));
    const minimumTotal = goals.reduce((sum, goal) => sum + goal.minimumMinutesPerDay, 0);
    const idealTotal = goals.reduce((sum, goal) => sum + goal.idealMinutesPerDay, 0);
    const ordered = [...goals].sort((a, b) => config.priorityWeights[b.priority] - config.priorityWeights[a.priority] || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    let remaining = availableMinutes;

    if (minimumTotal > availableMinutes) {
      ordered.forEach(goal => {
        const amount = Math.min(goal.minimumMinutesPerDay, remaining);
        allocations.set(goal.id, amount);
        remaining -= amount;
      });
      return { allocations, minimumTotal, idealTotal, minimumReached: false, idealReached: false };
    }

    goals.forEach(goal => allocations.set(goal.id, goal.minimumMinutesPerDay));
    remaining -= minimumTotal;
    while (remaining > 0) {
      const eligible = goals.filter(goal => allocations.get(goal.id) < goal.idealMinutesPerDay);
      if (!eligible.length) break;
      const totalWeight = eligible.reduce((sum, goal) => sum + config.priorityWeights[goal.priority], 0);
      let assigned = 0;
      eligible.forEach(goal => {
        const capacity = goal.idealMinutesPerDay - allocations.get(goal.id);
        const share = Math.min(capacity, Math.max(1, Math.floor(remaining * config.priorityWeights[goal.priority] / totalWeight)));
        allocations.set(goal.id, allocations.get(goal.id) + share);
        assigned += share;
      });
      remaining -= assigned;
    }
    return { allocations, minimumTotal, idealTotal, minimumReached: true, idealReached: idealTotal <= availableMinutes };
  }

  function splitDuration(total, config) {
    if (total < config.minimumSessionMinutes) return [];
    const count = Math.ceil(total / config.maximumSessionMinutes);
    const base = Math.floor(total / count);
    const extra = total % count;
    return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
  }

  function topicSelector(goalId, areas, topics, existing) {
    const options = areas.filter(area => area.goalId === goalId).flatMap(area => topics.filter(topic => topic.areaId === area.id).map(topic => ({ areaId: area.id, topicId: topic.id })));
    if (!options.length) return () => ({ areaId: null, topicId: null });
    const lastByTopic = new Map();
    existing.filter(session => session.goalId === goalId && session.topicId).forEach(session => {
      const previous = lastByTopic.get(session.topicId);
      if (!previous || session.plannedStart > previous) lastByTopic.set(session.topicId, session.plannedStart);
    });
    const ordered = [...options].sort((a, b) => (lastByTopic.get(a.topicId) || '').localeCompare(lastByTopic.get(b.topicId) || '') || a.topicId.localeCompare(b.topicId));
    let index = 0;
    return () => ordered[index++ % ordered.length];
  }

  function generate(input) {
    const config = { ...DEFAULT_CONFIG, ...input.config, priorityWeights: { ...DEFAULT_CONFIG.priorityWeights, ...(input.config && input.config.priorityWeights) } };
    const date = input.date;
    const allExisting = input.existingSessions || [];
    const protectedSessions = allExisting.filter(session => session.date === date && (session.status === 'COMPLETED' || session.status === 'IN_PROGRESS' || session.status === 'PAUSED' || session.source === 'MANUAL'));
    const goals = (input.goals || []).filter(goal => goal.status === 'ACTIVE');
    const intervals = (input.availability || []).filter(item => !item.dayOfWeek || item.dayOfWeek === weekday(date)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const totalAvailableMinutes = intervals.reduce((sum, item) => sum + toMinutes(item.endTime) - toMinutes(item.startTime), 0);
    const warnings = [];

    if (!intervals.length) return { sessions: protectedSessions, totalAvailableMinutes: 0, totalPlannedMinutes: protectedSessions.reduce((sum, item) => sum + item.plannedMinutes, 0), warnings: [WARNINGS.NO_AVAILABILITY] };
    if (!goals.length) return { sessions: protectedSessions, totalAvailableMinutes, totalPlannedMinutes: protectedSessions.reduce((sum, item) => sum + item.plannedMinutes, 0), warnings: [WARNINGS.NO_ACTIVE_GOALS] };

    const openIntervals = subtractIntervals(intervals, protectedSessions);
    const schedulableMinutes = openIntervals.reduce((sum, item) => sum + item.end - item.start, 0);
    const allocation = distribute(goals, schedulableMinutes, config);
    if (allocation.idealTotal > schedulableMinutes) warnings.push(WARNINGS.INSUFFICIENT_TIME, WARNINGS.IDEAL_GOALS_NOT_REACHED);
    if (!allocation.minimumReached) warnings.push(WARNINGS.MINIMUM_GOALS_NOT_REACHED);

    const chunks = [];
    goals.sort((a, b) => config.priorityWeights[b.priority] - config.priorityWeights[a.priority] || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).forEach(goal => {
      splitDuration(allocation.allocations.get(goal.id), config).forEach(minutes => chunks.push({ goal, minutes }));
    });
    const selectors = new Map(goals.map(goal => [goal.id, topicSelector(goal.id, input.areas || [], input.topics || [], allExisting)]));
    const sessions = [];
    let intervalIndex = 0;
    let cursor = openIntervals[0] ? openIntervals[0].start : 0;
    for (const chunk of chunks) {
      let remaining = chunk.minutes;
      while (remaining >= config.minimumSessionMinutes && intervalIndex < openIntervals.length) {
        const interval = openIntervals[intervalIndex];
        cursor = Math.max(cursor, interval.start);
        const room = interval.end - cursor;
        if (room < config.minimumSessionMinutes) { intervalIndex++; cursor = openIntervals[intervalIndex] ? openIntervals[intervalIndex].start : 0; continue; }
        const duration = Math.min(remaining, room, config.maximumSessionMinutes);
        if (duration < config.minimumSessionMinutes) break;
        const topic = selectors.get(chunk.goal.id)();
        sessions.push({ id: input.createId ? input.createId() : `${date}-routine-${sessions.length + 1}`, routineGenerationId: input.routineGenerationId || `${date}-generation-001`, date, goalId: chunk.goal.id, areaId: topic.areaId, topicId: topic.topicId, plannedStart: dateTime(date, toTime(cursor)), plannedEnd: dateTime(date, toTime(cursor + duration)), plannedMinutes: duration, status: 'PLANNED', source: 'ROUTINE' });
        remaining -= duration;
        cursor += duration + config.breakMinutes;
      }
    }
    const plannedRoutineMinutes = sessions.reduce((sum, session) => sum + session.plannedMinutes, 0);
    if (plannedRoutineMinutes < allocation.minimumTotal) warnings.push(WARNINGS.MINIMUM_GOALS_NOT_REACHED);
    if (plannedRoutineMinutes < allocation.idealTotal) warnings.push(WARNINGS.IDEAL_GOALS_NOT_REACHED);
    return { sessions: [...protectedSessions, ...sessions].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)), totalAvailableMinutes, totalPlannedMinutes: protectedSessions.reduce((sum, item) => sum + item.plannedMinutes, plannedRoutineMinutes), warnings: uniqueWarnings(warnings) };
  }

  return { DEFAULT_CONFIG, WARNINGS, generate, weekday };
})();

if (typeof module !== 'undefined') module.exports = RoutineEngine;
