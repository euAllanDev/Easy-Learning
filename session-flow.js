const SessionFlow = (() => {
  const STATUS = { PLANNED: 'PLANNED', IN_PROGRESS: 'IN_PROGRESS', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED', SKIPPED: 'SKIPPED', RESCHEDULED: 'RESCHEDULED', CANCELLED: 'CANCELLED' };
  const nowIso = now => (now instanceof Date ? now : new Date(now)).toISOString();
  const secondsBetween = (from, to) => Math.max(0, Math.floor((new Date(to) - new Date(from)) / 1000));
  const localDateTime = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  const focusedSeconds = (session, now = new Date()) => (session.focusedSeconds || 0) + (session.status === STATUS.IN_PROGRESS ? secondsBetween(session.resumedAt, now) : 0);
  const actualMinutes = (session, now) => Math.round(focusedSeconds(session, now) / 60);
  const inProgress = sessions => sessions.find(session => session.status === STATUS.IN_PROGRESS);

  function start(session, sessions, now = new Date()) {
    if (session.status !== STATUS.PLANNED) throw new Error('A sessão não pode ser iniciada neste estado.');
    if (inProgress(sessions) && inProgress(sessions).id !== session.id) throw new Error('Você já possui uma sessão em andamento.');
    const timestamp = nowIso(now);
    return { ...session, status: STATUS.IN_PROGRESS, startedAt: timestamp, resumedAt: timestamp, focusedSeconds: 0, pausedDuration: 0 };
  }
  function pause(session, now = new Date()) {
    if (session.status !== STATUS.IN_PROGRESS) throw new Error('Apenas uma sessão em andamento pode ser pausada.');
    const timestamp = nowIso(now);
    return { ...session, status: STATUS.PAUSED, pausedAt: timestamp, focusedSeconds: focusedSeconds(session, now), actualMinutes: actualMinutes(session, now) };
  }
  function resume(session, sessions, now = new Date()) {
    if (session.status !== STATUS.PAUSED) throw new Error('Apenas uma sessão pausada pode ser retomada.');
    if (inProgress(sessions) && inProgress(sessions).id !== session.id) throw new Error('Você já possui uma sessão em andamento.');
    const timestamp = nowIso(now);
    return { ...session, status: STATUS.IN_PROGRESS, resumedAt: timestamp, pausedDuration: (session.pausedDuration || 0) + secondsBetween(session.pausedAt, now), pausedAt: null };
  }
  function complete(session, now = new Date()) {
    if (![STATUS.IN_PROGRESS, STATUS.PAUSED].includes(session.status)) throw new Error('Apenas uma sessão iniciada pode ser finalizada.');
    const timestamp = nowIso(now);
    const completed = { ...session, status: STATUS.COMPLETED, endedAt: timestamp, focusedSeconds: focusedSeconds(session, now), actualMinutes: actualMinutes(session, now), pausedAt: null };
    return completed;
  }
  function skip(session, note, now = new Date()) {
    if (session.status !== STATUS.PLANNED) throw new Error('Apenas uma sessão planejada pode ser pulada.');
    return { ...session, status: STATUS.SKIPPED, skippedAt: nowIso(now), note: note || null };
  }
  function cancel(session, now = new Date()) {
    if (session.status !== STATUS.PLANNED) throw new Error('Apenas uma sessão planejada pode ser cancelada.');
    return { ...session, status: STATUS.CANCELLED, cancelledAt: nowIso(now) };
  }
  function reschedule(session, date, startTime, now = new Date(), createId = () => crypto.randomUUID(), constraints = {}) {
    if (session.status !== STATUS.PLANNED) throw new Error('Apenas uma sessão planejada pode ser reagendada.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) throw new Error('Informe uma nova data e horário válidos.');
    const [hours, minutes] = startTime.split(':').map(Number);
    const end = new Date(`${date}T${startTime}:00`); end.setMinutes(end.getMinutes() + session.plannedMinutes);
    const replacementStart = `${date}T${startTime}:00`; const replacementEnd = localDateTime(end);
    if (constraints.availability?.length) {
      const day = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${date}T12:00:00`).getDay()];
      const fits = constraints.availability.filter(item => item.dayOfWeek === day).some(item => `${date}T${item.startTime}:00` <= replacementStart && `${date}T${item.endTime}:00` >= replacementEnd);
      if (!fits) throw new Error('O novo horário precisa estar dentro da sua disponibilidade.');
    }
    if (constraints.sessions?.some(item => item.id !== session.id && item.date === date && ['PLANNED', 'IN_PROGRESS', 'PAUSED'].includes(item.status) && item.plannedStart < replacementEnd && item.plannedEnd > replacementStart)) throw new Error('O novo horário se sobrepõe a outra sessão.');
    const original = { ...session, status: STATUS.RESCHEDULED, rescheduledAt: nowIso(now) };
    const replacement = { ...session, id: createId(), date, plannedStart: replacementStart, plannedEnd: replacementEnd, status: STATUS.PLANNED, source: session.source, routineGenerationId: null, rescheduledFromSessionId: session.id, createdAt: nowIso(now), startedAt: null, endedAt: null, pausedAt: null, resumedAt: null, focusedSeconds: 0, pausedDuration: 0, actualMinutes: null };
    if (hours > 23 || minutes > 59) throw new Error('Informe uma nova data e horário válidos.');
    return { original, replacement };
  }
  function validateResult({ actualMinutes: minutes, questions, correct, difficulty, note }) {
    const actualMinutes = Number(minutes);
    if (!Number.isFinite(actualMinutes) || actualMinutes < 0) throw new Error('Informe um tempo estudado válido.');
    const parsedQuestions = questions === '' || questions == null ? null : Number(questions);
    const parsedCorrect = correct === '' || correct == null ? null : Number(correct);
    if (parsedQuestions !== null && (!Number.isInteger(parsedQuestions) || parsedQuestions < 0)) throw new Error('Informe uma quantidade de questões válida.');
    if (parsedQuestions > 0 && (parsedCorrect === null || !Number.isInteger(parsedCorrect) || parsedCorrect < 0 || parsedCorrect > parsedQuestions)) throw new Error('Os acertos devem estar entre 0 e o total de questões.');
    if (parsedQuestions === 0 && parsedCorrect !== null && parsedCorrect !== 0) throw new Error('Os acertos devem estar entre 0 e o total de questões.');
    return { actualMinutes, questions: parsedQuestions, correct: parsedQuestions === null ? null : (parsedCorrect || 0), accuracy: parsedQuestions ? Number((parsedCorrect / parsedQuestions * 100).toFixed(2)) : null, difficulty: ['EASY', 'NORMAL', 'HARD'].includes(difficulty) ? difficulty : 'NORMAL', note: note?.trim() || null };
  }
  function applyResult(session, result) { return { ...session, ...validateResult(result) }; }
  function manualSession(data, now = new Date(), createId = () => crypto.randomUUID()) {
    const timestamp = nowIso(now); const result = validateResult(data);
    return { id: createId(), date: timestamp.slice(0, 10), goalId: data.goalId, areaId: data.areaId || null, topicId: data.topicId || null, topicName: data.topic?.trim() || null, plannedStart: timestamp, plannedEnd: timestamp, plannedMinutes: result.actualMinutes, source: 'MANUAL', status: STATUS.COMPLETED, startedAt: timestamp, endedAt: timestamp, focusedSeconds: result.actualMinutes * 60, pausedDuration: 0, ...result, createdAt: timestamp };
  }
  function statistics(sessions) {
    const completed = sessions.filter(session => session.status === STATUS.COMPLETED);
    const planned = sessions.filter(session => session.source === 'ROUTINE' && ![STATUS.CANCELLED, STATUS.RESCHEDULED].includes(session.status));
    const totalQuestions = completed.reduce((sum, session) => sum + (session.questions || 0), 0);
    const totalCorrect = completed.reduce((sum, session) => sum + (session.correct || 0), 0);
    const plannedMinutes = planned.reduce((sum, session) => sum + session.plannedMinutes, 0);
    const completedMinutes = completed.reduce((sum, session) => sum + (session.actualMinutes || 0), 0);
    return { plannedMinutes, actualMinutes: completedMinutes, differenceMinutes: completedMinutes - plannedMinutes, completedSessions: completed.length, plannedSessions: planned.length, studiedDays: new Set(completed.map(session => session.date)).size, questions: totalQuestions, correct: totalCorrect, accuracy: totalQuestions ? Number((totalCorrect / totalQuestions * 100).toFixed(2)) : null, completionRate: planned.length ? Number((completed.filter(session => session.source === 'ROUTINE').length / planned.length * 100).toFixed(2)) : 0 };
  }
  return { STATUS, start, pause, resume, complete, skip, cancel, reschedule, focusedSeconds, actualMinutes, validateResult, applyResult, manualSession, statistics };
})();

if (typeof module !== 'undefined') module.exports = SessionFlow;
