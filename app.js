createInitialState();

const DAYS = { MONDAY: 'Segunda', TUESDAY: 'Terça', WEDNESDAY: 'Quarta', THURSDAY: 'Quinta', FRIDAY: 'Sexta', SATURDAY: 'Sábado', SUNDAY: 'Domingo' };
const COLORS = ['orange', 'blue', 'green'];
const $ = selector => document.querySelector(selector);
let seconds = 50 * 60;
let interval;
let running = false;
let selectedSessionId = null;
let onboardingStep = 1;
const TODAY = new Date().toISOString().slice(0, 10);

function minutes(value) { const h = Math.floor(value / 60); const m = value % 60; return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}min`; }
function currentWeek() { const date = new Date(`${TODAY}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); const start = date.toISOString().slice(0, 10); date.setDate(date.getDate() + 6); return { start, end: date.toISOString().slice(0, 10) }; }
function previousWeek(week) { const date = new Date(`${week.start}T12:00:00`); date.setDate(date.getDate() - 7); const start = date.toISOString().slice(0, 10); date.setDate(date.getDate() + 6); return { start, end: date.toISOString().slice(0, 10) }; }
function weeklySummary(week = currentWeek()) { return StudyAnalytics.calculateWeeklySummary({ sessions: sessionsRepository.getAll(), goals: goalsRepository.getAll(), topics: topicsRepository.getAll(), availability: availabilityRepository.getAll(), weekStart: week.start, weekEnd: week.end }); }
function coachSummary() { const end = TODAY; const start = new Date(`${end}T12:00:00`); start.setDate(start.getDate() - 13); return StudyAnalytics.calculateWeeklySummary({ sessions: sessionsRepository.getAll(), goals: goalsRepository.getAll(), topics: topicsRepository.getAll(), availability: availabilityRepository.getAll(), weekStart: start.toISOString().slice(0, 10), weekEnd: end }); }
function coachContext() { return AIContextBuilder.buildCoachContext({ profile: studentProfileRepository.getProfile() || {}, settings: aiCoachRepository.getSettings(), analytics: coachSummary(), goals: goalsRepository.getAll(), reviews: studentProfileRepository.getWeeklyReviews(), sessions: sessionsRepository.getAll(), now: new Date(`${TODAY}T12:00:00`) }); }
function contextHash(context) { let hash = 5381; const text = JSON.stringify(context); for (let index = 0; index < text.length; index += 1) hash = (hash * 33) ^ text.charCodeAt(index); return String(hash >>> 0); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
function renderCoach() {
  const element = $('#coach-content'); const settings = aiCoachRepository.getSettings(); const analysis = aiCoachRepository.getAnalysis();
  if (!settings.enabled) { element.innerHTML = '<p>Study Coach desativado. Sua rotina e estatísticas continuam funcionando normalmente.</p>'; return; }
  if (!analysis) { element.innerHTML = '<p>Atualize a análise para receber observações sobre seus dados de estudo.</p>'; return; }
  const recommendations = aiCoachRepository.getRecommendations().filter(item => item.analysisId === analysis.analysisId);
  element.innerHTML = `<h3>${escapeHtml(analysis.response.summary)}</h3>${analysis.response.observations.slice(0, 2).map(item => `<div class="coach-observation"><p class="eyebrow">${item.type}</p><p>${escapeHtml(item.text)}</p></div>`).join('')}${recommendations.map(item => `<div class="coach-recommendation"><p class="eyebrow">SUGESTÃO · ${item.confidence}</p><p>${escapeHtml(item.reason)}</p>${item.status === 'PENDING' ? `<div class="coach-actions"><button data-accept-recommendation="${item.id}">Aceitar</button><button data-reject-recommendation="${item.id}">Ignorar</button></div>` : `<p>${item.status === 'ACCEPTED' ? 'Sugestão aceita.' : 'Sugestão ignorada.'}</p>`}</div>`).join('')}`;
}
async function refreshCoach() {
  const button = $('#refresh-coach'); const settings = aiCoachRepository.getSettings();
  if (!settings.enabled) return toast('Ative o Study Coach nas configurações para gerar uma análise.');
  const context = coachContext(); const hash = contextHash(context); const cached = aiCoachRepository.getAnalysis();
  if (AIAnalysisCache.isValid(cached, hash)) { renderCoach(); return toast('Análise recente reutilizada.'); }
  button.disabled = true; button.textContent = 'Analisando sua rotina...';
  try {
    const response = await AICoachClient.generateCoachResponse(context);
    const valid = AIResponseValidator.validateCoachResponse(response, { goalIds: goalsRepository.getAll().map(goal => goal.id) });
    if (!valid) throw new Error('Resposta inválida');
    const analysisId = storage.id(); const createdAt = new Date().toISOString();
    aiCoachRepository.saveAnalysis({ analysisId, createdAt, contextHash: hash, response: valid });
    const records = valid.recommendations.map(item => ({ ...item, id: storage.id(), analysisId, createdAt, status: 'PENDING' }));
    aiCoachRepository.saveRecommendations([...aiCoachRepository.getRecommendations(), ...records]); renderCoach();
  } catch (error) { console.error('Study Coach failed:', error); $('#coach-content').innerHTML = '<h3>Study Coach indisponível</h3><p>Suas estatísticas e rotina continuam funcionando normalmente.</p><button class="text-button" id="retry-coach">Tentar novamente</button>'; }
  finally { button.disabled = false; button.textContent = 'Atualizar análise'; }
}
function iconify() { lucide.createIcons(); }
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 2800); }
function renderTimer() { $('#timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function stopTimer() { clearInterval(interval); interval = null; running = false; }
function activeSession() { return sessionsRepository.getAll().find(session => session.status === 'IN_PROGRESS' || session.status === 'PAUSED'); }
function updateTimer() {
  const session = sessionsRepository.getById(selectedSessionId);
  if (!session) return stopTimer();
  const focused = SessionFlow.focusedSeconds(session);
  seconds = Math.max(0, session.plannedMinutes * 60 - focused);
  renderTimer();
}
function showTimer(session) {
  const goal = goalsRepository.getById(session.goalId); const area = areasRepository.getById(session.areaId); const topic = topicsRepository.getById(session.topicId);
  $('#timer-modal .eyebrow').textContent = `${(goal?.name || 'ESTUDO').toUpperCase()}${area ? ` · ${area.name.toUpperCase()}` : ''}`;
  $('#timer-modal h2').textContent = topic?.name || session.topicName || goal?.name || 'Sessão de estudo';
  $('#pause-button').innerHTML = session.status === 'PAUSED' ? '<i data-lucide="play"></i> Retomar' : '<i data-lucide="pause"></i> Pausar';
  $('#timer-started').textContent = session.startedAt ? `Sessão iniciada às ${session.startedAt.slice(11, 16)}` : '';
  selectedSessionId = session.id; updateTimer();
  if (!$('#timer-modal').open) $('#timer-modal').showModal();
  stopTimer();
  if (session.status === 'IN_PROGRESS') { running = true; interval = setInterval(updateTimer, 1000); }
  iconify();
}
function activeGoals() { return goalsRepository.getAll().filter(goal => goal.status === 'ACTIVE'); }

function todaySessions() { return sessionsRepository.getByDate(TODAY).sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)); }
function sessionTime(session, key) { return session[key].slice(11, 16); }
function routineWarningText(warning) {
  return ({
    NO_AVAILABILITY: 'Você não possui horário de estudo configurado para hoje.',
    NO_ACTIVE_GOALS: 'Configure um objetivo ativo para montar sua rotina.',
    INSUFFICIENT_TIME: 'A disponibilidade de hoje não comporta todas as metas ideais.',
    MINIMUM_GOALS_NOT_REACHED: 'A disponibilidade atual não comporta as metas mínimas de todos os objetivos.',
    IDEAL_GOALS_NOT_REACHED: 'A rotina priorizou o que cabe no seu dia.'
  })[warning];
}
function nextGenerationId(existing) {
  const generations = existing.map(session => Number((session.routineGenerationId || '').match(/generation-(\d+)/)?.[1]) || 0);
  return `${TODAY}-generation-${String(Math.max(0, ...generations) + 1).padStart(3, '0')}`;
}
function ensureRoutine(regenerate = false) {
  const existing = todaySessions();
  const savedRoutine = routineDaysRepository.get(TODAY);
  const hasRoutine = existing.some(session => session.source === 'ROUTINE');
  if ((hasRoutine || savedRoutine) && !regenerate) return { sessions: existing, totalAvailableMinutes: savedRoutine?.totalAvailableMinutes || 0, totalPlannedMinutes: existing.reduce((sum, session) => sum + session.plannedMinutes, 0), warnings: savedRoutine?.warnings || [] };
  const result = RoutineEngine.generate({ date: TODAY, goals: goalsRepository.getAll(), availability: availabilityRepository.getAll(), areas: areasRepository.getAll(), topics: topicsRepository.getAll(), existingSessions: existing, routineGenerationId: nextGenerationId(existing), createId: () => storage.id() });
  const newRoutineSessions = result.sessions.filter(session => session.source === 'ROUTINE');
  sessionsRepository.replaceFutureRoutine(TODAY, newRoutineSessions);
  routineDaysRepository.save(TODAY, result);
  return { ...result, sessions: todaySessions() };
}
function renderToday(result = ensureRoutine()) {
  const sessions = result.sessions || todaySessions();
  const goals = goalsRepository.getAll();
  const areas = areasRepository.getAll();
  const topics = topicsRepository.getAll();
  const planned = sessions.reduce((sum, session) => sum + session.plannedMinutes, 0);
  const date = new Date(`${TODAY}T12:00:00`);
  $('#today-label').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date).toUpperCase();
  $('#planned-total').textContent = minutes(planned);
  const warning = result.warnings && result.warnings[0]; const noGoals = !activeGoals().length; const noAvailability = !availabilityRepository.getAll().length;
  $('#routine-summary').textContent = warning ? routineWarningText(warning) : planned ? `Você tem ${minutes(planned)} planejados. Comece pelo que importa e ajuste o caminho quando precisar.` : 'Sua agenda está livre para hoje.';
  const now = new Date();
  const next = sessions.find(session => session.status === 'IN_PROGRESS') || sessions.find(session => session.status === 'PAUSED') || sessions.find(session => session.status === 'PLANNED' && new Date(session.plannedEnd) >= now);
  const nextButton = $('#start-button');
  selectedSessionId = next ? next.id : null;
  if (next) {
    const goal = goals.find(item => item.id === next.goalId);
    const area = areas.find(item => item.id === next.areaId);
    const topic = topics.find(item => item.id === next.topicId);
    $('#next-session-flag').innerHTML = `<span></span> ${(goal?.name || 'Estudo').toUpperCase()}${area ? ` · ${area.name.toUpperCase()}` : ''}`;
    $('#next-session-title').textContent = topic?.name || goal?.name || 'Sessão de estudo';
    $('#next-session-description').textContent = next.status === 'PAUSED' ? `Sessão pausada. Tempo estudado: ${minutes(Math.round(SessionFlow.focusedSeconds(next) / 60))}.` : next.status === 'IN_PROGRESS' ? 'Sua sessão está em andamento.' : 'Uma sugestão de foco para sua rotina de hoje.';
    $('#next-session-duration').innerHTML = `<i data-lucide="clock-3"></i> ${minutes(next.plannedMinutes)}`;
    $('#next-session-time').innerHTML = `<i data-lucide="calendar-clock"></i> ${sessionTime(next, 'plannedStart')} - ${sessionTime(next, 'plannedEnd')}`;
    nextButton.disabled = false;
    nextButton.innerHTML = next.status === 'PAUSED' ? 'Retomar sessão <i data-lucide="play"></i>' : next.status === 'IN_PROGRESS' ? 'Abrir sessão <i data-lucide="arrow-right"></i>' : 'Iniciar sessão <i data-lucide="arrow-right"></i>';
  } else {
    $('#next-session-flag').innerHTML = '<span></span> SEM PRÓXIMA SESSÃO';
    $('#next-session-title').textContent = noGoals ? 'Ainda não há objetivos configurados.' : noAvailability ? 'Você já possui objetivos, mas ainda não configurou quando pode estudar.' : 'Nenhuma sessão planejada para hoje.';
    $('#next-session-description').textContent = noGoals ? 'Crie seu primeiro objetivo para começar.' : noAvailability ? 'Defina quando pode estudar para gerar sua rotina.' : warning ? routineWarningText(warning) : 'Você não possui disponibilidade hoje ou suas metas já foram acomodadas.';
    $('#next-session-duration').innerHTML = '<i data-lucide="clock-3"></i> --';
    $('#next-session-time').innerHTML = '<i data-lucide="calendar-clock"></i> --';
    nextButton.disabled = !(noGoals || noAvailability);
    nextButton.innerHTML = noGoals ? 'Criar objetivo' : noAvailability ? 'Configurar disponibilidade' : 'Sem sessões';
  }
  $('#session-list').innerHTML = sessions.length ? sessions.map((session, index) => {
    const goal = goals.find(item => item.id === session.goalId);
    const topic = topics.find(item => item.id === session.topicId);
    const isDone = session.status === 'COMPLETED';
    const canAct = session.status === 'PLANNED';
    const statusLabel = ({ IN_PROGRESS: 'em andamento', PAUSED: 'pausada', SKIPPED: 'pulada', RESCHEDULED: 'reagendada', CANCELLED: 'cancelada' })[session.status] || '';
    return `<article class="session-row${isDone ? ' done' : ''}"><div class="${isDone ? 'status-check' : 'status-empty'}">${isDone ? '<i data-lucide="check"></i>' : ''}</div><div class="time">${sessionTime(session, 'plannedStart')}<small>${sessionTime(session, 'plannedEnd')}</small></div><div class="subject"><span class="dot ${COLORS[index % COLORS.length]}"></span><div><strong>${goal?.name || 'Estudo'}</strong><small>${topic?.name || session.topicName || 'Sessão planejada'}${statusLabel ? ` · ${statusLabel}` : ''}</small></div></div><div class="row-duration">${minutes(session.plannedMinutes)}</div>${(canAct || session.status === 'IN_PROGRESS' || session.status === 'PAUSED') ? `<button class="row-more" data-start-session="${session.id}" aria-label="Iniciar sessão"><i data-lucide="play"></i></button>` : ''}${canAct ? `<button class="text-button" data-skip-session="${session.id}">pular</button><button class="text-button" data-reschedule-session="${session.id}">reagendar</button><button class="text-button danger" data-cancel-session="${session.id}">cancelar</button>` : ''}</article>`;
  }).join('') : `<p class="empty-state">${noGoals ? 'Crie seu primeiro objetivo para começar.' : noAvailability ? 'Configure sua disponibilidade para gerar sessões.' : warning ? routineWarningText(warning) : 'Nenhuma sessão planejada para hoje. Veja os próximos dias quando tiver disponibilidade.'}</p>`;
  iconify();
}

function renderMiniGoals() {
  const goals = activeGoals();
  $('#goals-mini-list').innerHTML = goals.length ? goals.map((goal, index) => `<div class="goal-line"><span class="dot ${COLORS[index % COLORS.length]}"></span><strong>${goal.name}</strong><div class="mini-track ${COLORS[index % COLORS.length]}-track"><i style="width:${Math.min(100, goal.idealMinutesPerDay / 2)}%"></i></div><small>${minutes(goal.idealMinutesPerDay)}</small></div>`).join('') : '<p class="empty-state">Adicione um objetivo para começar.</p>';
}

function renderGoals() {
  const goals = goalsRepository.getAll().filter(goal => goal.status !== 'ARCHIVED');
  $('#goal-cards').innerHTML = goals.length ? goals.map(goal => {
    const areas = areasRepository.getAll().filter(area => area.goalId === goal.id);
    return `<article class="goal-card"><div class="goal-card-top"><div><span class="priority ${goal.priority.toLowerCase()}">${({ HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' })[goal.priority]} prioridade</span><h2>${goal.name}</h2><p>${goal.description || 'Sem descrição adicionada.'}</p></div><button class="icon-action" data-edit-goal="${goal.id}" aria-label="Editar ${goal.name}"><i data-lucide="pencil"></i></button></div><div class="goal-metrics"><div><span>Meta ideal</span><strong>${minutes(goal.idealMinutesPerDay)} <small>/ dia</small></strong></div><div><span>Meta mínima</span><strong>${minutes(goal.minimumMinutesPerDay)} <small>/ dia</small></strong></div><div><span>Áreas</span><strong>${areas.length}</strong></div></div><div class="goal-card-footer"><span class="status-label ${goal.status.toLowerCase()}">${({ ACTIVE: 'Ativo', PAUSED: 'Pausado', COMPLETED: 'Concluído' })[goal.status]}</span><div><button class="text-button" data-status-goal="${goal.id}" data-status="${goal.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'}">${goal.status === 'ACTIVE' ? 'pausar' : 'retomar'}</button><button class="text-button" data-complete-goal="${goal.id}">concluir</button><button class="text-button danger" data-archive-goal="${goal.id}">arquivar</button></div></div></article>`;
  }).join('') : '<div class="empty-panel"><i data-lucide="target"></i><h2>Sem objetivos ativos</h2><p>Crie um objetivo para começar a estruturar seus estudos.</p></div>';
  iconify();
}

function renderAvailability() {
  const items = availabilityRepository.getAll();
  $('#availability-list').innerHTML = Object.keys(DAYS).map(day => {
    const dayItems = items.filter(item => item.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return `<article class="day-card"><h2>${DAYS[day]}</h2><div class="time-slots">${dayItems.length ? dayItems.map(item => `<div class="time-slot"><span><i data-lucide="clock-3"></i> ${item.startTime} <b></b> ${item.endTime}</span><button data-edit-availability="${item.id}" aria-label="Editar horário"><i data-lucide="pencil"></i></button><button data-remove-availability="${item.id}" aria-label="Remover horário"><i data-lucide="x"></i></button></div>`).join('') : '<p class="no-slots">Nenhum horário definido</p>'}</div><button class="add-inline" data-add-day="${day}"><i data-lucide="plus"></i> adicionar horário</button></article>`;
  }).join('');
  iconify();
}

function renderAll() { renderMiniGoals(); renderGoals(); renderAvailability(); renderActivityGoals(); renderToday(); renderHistory(); renderCoach(); }
function renderActivityGoals() { $('#activity-form select').innerHTML = activeGoals().map(goal => `<option value="${goal.id}">${goal.name}</option>`).join(''); }
function renderHistory() {
  const sessions = sessionsRepository.getAll().filter(session => session.status === 'COMPLETED').sort((a, b) => (b.endedAt || '').localeCompare(a.endedAt || ''));
  const stats = SessionFlow.statistics(sessionsRepository.getAll()); const summary = weeklySummary(); const previous = weeklySummary(previousWeek(currentWeek()));
  $('#history-summary').textContent = `${minutes(stats.actualMinutes)} realizados de ${minutes(stats.plannedMinutes)} planejados (${stats.differenceMinutes >= 0 ? '+' : '-'}${minutes(Math.abs(stats.differenceMinutes))}), ${stats.completedSessions} sessões concluídas e ${stats.completionRate}% de conclusão.`;
  $('#week-days').innerHTML = `${summary.consistency.studyDays}<small>/${summary.consistency.availableDays}</small>`;
  $('#week-rate').innerHTML = `${summary.sessions.rate ?? 0}<small>%</small>`;
  $('#weekly-summary').innerHTML = `<div><span>Tempo estudado</span><strong>${minutes(summary.actualMinutes)}</strong></div><div><span>Sessões</span><strong>${summary.sessions.completedSessions} <small>/ ${summary.sessions.plannedSessions}</small></strong></div><div><span>Conclusão</span><strong>${summary.sessions.rate ?? '—'}<small>%</small></strong></div><div><span>Dias estudados</span><strong>${summary.consistency.studyDays}<small>/${summary.consistency.availableDays}</small></strong></div><div><span>Questões</span><strong>${summary.questions}</strong></div><div><span>Aproveitamento</span><strong>${summary.accuracy == null ? '—' : `${summary.accuracy}%`}</strong></div>`;
  const goalNames = new Map(goalsRepository.getAll().map(goal => [goal.id, goal.name])); const periodNames = { MORNING: 'Manhã', AFTERNOON: 'Tarde', EVENING: 'Noite' };
  $('#weekly-breakdown').innerHTML = `<div class="review-breakdown"><div><p class="eyebrow">POR OBJETIVO</p>${summary.goals.filter(item => item.actualMinutes || item.plannedMinutes).map(item => `<p><strong>${goalNames.get(item.goalId) || 'Estudo'}</strong><span>${minutes(item.actualMinutes)}</span></p>`).join('') || '<p>Sem dados na semana.</p>'}</div><div><p class="eyebrow">POR PERÍODO</p>${summary.timePeriods.filter(item => item.plannedSessions).map(item => `<p><strong>${periodNames[item.period]}</strong><span>${item.completionRate ?? '—'}% conclusão</span></p>`).join('') || '<p>Sem sessões planejadas.</p>'}</div></div>`;
  $('#weekly-comparison').innerHTML = previous.actualMinutes || previous.sessions.plannedSessions ? `<div class="comparison"><p class="eyebrow">COMPARAÇÃO SEMANAL</p><p>Tempo estudado <strong>${minutes(previous.actualMinutes)} → ${minutes(summary.actualMinutes)}</strong></p><p>Conclusão <strong>${previous.sessions.rate ?? '—'}% → ${summary.sessions.rate ?? '—'}%</strong></p><p>Questões <strong>${previous.questions} → ${summary.questions}</strong></p></div>` : '';
  const recommendation = summary.sessions.rate != null && summary.sessions.rate < 70 ? 'Sua rotina teve várias sessões não concluídas. Considere reduzir temporariamente a carga planejada.' : summary.completionRatio != null && summary.completionRatio < 75 ? 'Seu tempo realizado ficou abaixo do planejado nesta semana.' : null;
  $('#weekly-recommendation').innerHTML = recommendation ? `<div class="recommendation"><p class="eyebrow">SUGESTÃO</p><p>${recommendation}</p></div>` : '';
  const reviews = studentProfileRepository.getWeeklyReviews();
  $('#weekly-reviews-list').innerHTML = reviews.length ? reviews.map(review => `<article class="goal-card"><span class="status-label completed">Semana ${review.weekStart.split('-').reverse().slice(0, 2).join('/')}</span><h2>${({ TOO_LIGHT: 'Muito leve', BALANCED: 'Equilibrada', TOO_HEAVY: 'Muito pesada' })[review.feeling]}</h2><p>${review.notes || 'Sem observação.'}</p></article>`).join('') : '<p class="empty-state">Registre como você sentiu sua semana.</p>';
  $('#history-list').innerHTML = sessions.length ? sessions.map(session => {
    const goal = goalsRepository.getById(session.goalId); const area = areasRepository.getById(session.areaId); const topic = topicsRepository.getById(session.topicId);
    const accuracy = session.accuracy == null ? 'Sem questões' : `${session.correct}/${session.questions} · ${session.accuracy}%`;
    return `<article class="goal-card"><span class="status-label completed">${session.date} · ${session.source === 'MANUAL' ? 'Manual' : 'Rotina'}</span><h2>${goal?.name || 'Estudo'}</h2><p>${area?.name ? `${area.name} · ` : ''}${topic?.name || session.topicName || 'Sessão de estudo'} · ${session.plannedStart.slice(11, 16)}</p><div class="goal-metrics"><div><span>Planejado</span><strong>${minutes(session.plannedMinutes)}</strong></div><div><span>Realizado</span><strong>${minutes(session.actualMinutes || 0)}</strong></div><div><span>Questões</span><strong>${accuracy}</strong></div></div><p>Dificuldade: ${{ EASY: 'Fácil', NORMAL: 'Normal', HARD: 'Difícil' }[session.difficulty] || 'Normal'}</p>${session.note ? `<p>${session.note}</p>` : ''}</article>`;
  }).join('') : '<div class="empty-panel"><i data-lucide="book-open"></i><h2>Seu histórico aparecerá aqui</h2><p>Conclua uma sessão ou registre uma atividade.</p></div>';
  iconify();
}
function openPage(name) {
  ['dashboard', 'goals', 'availability', 'history'].forEach(page => $(`#${page}-page`).hidden = page !== name);
  document.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openGoal(id) {
  const form = $('#goal-form'); const goal = id ? goalsRepository.getById(id) : null;
  form.reset(); form.elements.id.value = id || '';
  $('#goal-modal-label').textContent = goal ? 'CONFIGURAR OBJETIVO' : 'NOVO OBJETIVO'; $('#goal-modal-title').textContent = goal ? goal.name : 'Seu novo foco';
  $('#goal-structure').hidden = !goal;
  if (goal) { form.elements.name.value = goal.name; form.elements.description.value = goal.description; form.elements.priority.value = goal.priority; form.elements.ideal.value = goal.idealMinutesPerDay; form.elements.minimum.value = goal.minimumMinutesPerDay; renderAreas(goal.id); }
  $('#goal-modal').showModal(); iconify();
}
function renderAreas(goalId) {
  const areas = areasRepository.getAll().filter(area => area.goalId === goalId);
  $('#areas-editor').innerHTML = areas.length ? areas.map(area => `<div class="area-editor"><div class="area-title"><strong>${area.name}</strong><button type="button" data-add-topic="${area.id}"><i data-lucide="plus"></i> tópico</button><button type="button" data-edit-area="${area.id}"><i data-lucide="pencil"></i></button><button type="button" data-remove-area="${area.id}"><i data-lucide="trash-2"></i></button></div>${topicsRepository.getAll().filter(topic => topic.areaId === area.id).map(topic => `<div class="topic-row"><span></span>${topic.name}<button type="button" data-edit-topic="${topic.id}"><i data-lucide="pencil"></i></button><button type="button" data-remove-topic="${topic.id}"><i data-lucide="x"></i></button></div>`).join('')}</div>`).join('') : '<p class="empty-state">Crie áreas para organizar este objetivo.</p>';
  iconify();
}
function askName(title, current = '') { const name = window.prompt(title, current); return name && name.trim(); }

function startSession(id) {
  const session = sessionsRepository.getById(id); if (!session) return;
  try {
    const sessions = sessionsRepository.getAll();
    const next = session.status === 'PLANNED' ? SessionFlow.start(session, sessions) : session.status === 'PAUSED' ? SessionFlow.resume(session, sessions) : session.status === 'IN_PROGRESS' ? session : null;
    if (!next) return toast('Esta sessão não pode ser iniciada.');
    const saved = session.status === 'IN_PROGRESS' ? next : sessionsRepository.update(id, next);
    showTimer(saved); renderToday();
  } catch (error) { toast(error.message); }
}
$('#start-button').addEventListener('click', () => {
  if (selectedSessionId) return startSession(selectedSessionId);
  if (!activeGoals().length) return openGoal();
  if (!availabilityRepository.getAll().length) return openPage('availability');
});
$('#pause-button').addEventListener('click', () => {
  const session = sessionsRepository.getById(selectedSessionId); if (!session) return;
  try {
    const next = session.status === 'IN_PROGRESS' ? SessionFlow.pause(session) : SessionFlow.resume(session, sessionsRepository.getAll());
    const saved = sessionsRepository.update(session.id, next); showTimer(saved); renderToday();
  } catch (error) { toast(error.message); }
});
$('#finish-button').addEventListener('click', () => {
  const session = sessionsRepository.getById(selectedSessionId); if (!session) return;
  try {
    const completed = sessionsRepository.update(session.id, SessionFlow.complete(session));
    stopTimer(); $('#timer-modal').close(); $('#studied-time').value = completed.actualMinutes; $('#finish-modal').showModal(); renderToday();
  } catch (error) { toast(error.message); }
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { button.closest('dialog').close(); if (button.closest('#timer-modal')) stopTimer(); }));
$('#timer-modal').addEventListener('cancel', stopTimer);
document.querySelectorAll('.difficulty button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.difficulty button').forEach(item => item.classList.remove('selected')); button.classList.add('selected'); }));
$('#finish-form').addEventListener('submit', event => { event.preventDefault(); const form = event.target; const difficulty = document.querySelector('.difficulty .selected')?.dataset.difficulty || 'NORMAL'; try { if (selectedSessionId) sessionsRepository.update(selectedSessionId, SessionFlow.applyResult(sessionsRepository.getById(selectedSessionId), { actualMinutes: form.elements['studied-time'].value, questions: form.elements.questions.value, correct: form.elements.correct.value, difficulty, note: form.elements.note.value })); $('#finish-modal').close(); renderToday(); renderHistory(); toast('Sessão registrada. Bom trabalho!'); } catch (error) { toast(error.message); } });
$('#activity-button').addEventListener('click', () => $('#activity-modal').showModal());
$('#open-weekly-review').addEventListener('click', () => { const week = currentWeek(); const review = studentProfileRepository.getWeeklyReview(week.start); const profile = studentProfileRepository.getProfile() || {}; const form = $('#weekly-review-form'); form.reset(); form.elements.notes.value = review?.notes || ''; form.elements.preferredSessionMinutes.value = profile.preferredSessionMinutes || ''; form.elements.preferredBreakMinutes.value = profile.preferredBreakMinutes ?? ''; form.elements.preferredStudyPeriod.value = profile.preferredStudyPeriod || 'FLEXIBLE'; document.querySelectorAll('[data-feeling]').forEach(button => button.classList.toggle('selected', button.dataset.feeling === (review?.feeling || 'BALANCED'))); $('#weekly-review-modal').showModal(); iconify(); });
document.querySelectorAll('[data-feeling]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-feeling]').forEach(item => item.classList.remove('selected')); button.classList.add('selected'); }));
$('#weekly-review-form').addEventListener('submit', event => { event.preventDefault(); const form = event.target; const week = currentWeek(); const feeling = document.querySelector('[data-feeling].selected')?.dataset.feeling || 'BALANCED'; studentProfileRepository.saveWeeklyReview({ weekStart: week.start, weekEnd: week.end, feeling, notes: form.elements.notes.value.trim() || null }); studentProfileRepository.updateProfile({ preferredSessionMinutes: form.elements.preferredSessionMinutes.value ? Number(form.elements.preferredSessionMinutes.value) : null, preferredBreakMinutes: form.elements.preferredBreakMinutes.value === '' ? null : Number(form.elements.preferredBreakMinutes.value), preferredStudyPeriod: form.elements.preferredStudyPeriod.value }); $('#weekly-review-modal').close(); renderHistory(); toast('Revisão semanal salva.'); });
$('#activity-form').addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); try { sessionsRepository.create(SessionFlow.manualSession(data, new Date(), () => storage.id())); $('#activity-modal').close(); event.target.reset(); renderToday(); renderHistory(); toast('Atividade registrada no seu progresso.'); } catch (error) { toast(error.message); } });
$('#plan-button').addEventListener('click', () => $('.schedule-title').scrollIntoView({ behavior: 'smooth' }));
$('#add-session').addEventListener('click', () => { const button = $('#add-session'); button.disabled = true; button.innerHTML = '<i data-lucide="loader-circle"></i> Reorganizando sua rotina...'; try { renderToday(ensureRoutine(true)); toast('Rotina atualizada.'); } catch (error) { console.error(error); toast('Não foi possível atualizar sua rotina. Tente novamente.'); } finally { button.disabled = false; button.innerHTML = '<i data-lucide="refresh-cw"></i> reorganizar dia'; iconify(); } });
$('#refresh-coach').addEventListener('click', refreshCoach);

document.querySelectorAll('[data-page]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); openPage(link.dataset.page); }));
document.querySelectorAll('[data-open-page]').forEach(button => button.addEventListener('click', () => openPage(button.dataset.openPage)));
$('#create-goal').addEventListener('click', () => openGoal());
$('#goal-form').addEventListener('submit', event => { event.preventDefault(); const form = event.target; const data = Object.fromEntries(new FormData(form)); const ideal = Number(data.ideal); const minimum = Number(data.minimum); if (!data.name.trim()) return toast('Informe o nome do objetivo.'); if (minimum <= 0 || ideal <= 0 || minimum > ideal) return toast('A meta mínima deve ser positiva e menor ou igual à ideal.'); const changes = { name: data.name.trim(), description: data.description.trim(), priority: data.priority, idealMinutesPerDay: ideal, minimumMinutesPerDay: minimum }; if (data.id) { goalsRepository.update(data.id, changes); } else { const now = new Date().toISOString(); goalsRepository.create({ ...changes, status: 'ACTIVE', createdAt: now, updatedAt: now }); } $('#goal-modal').close(); renderAll(); toast('Objetivo salvo.'); });
$('#create-availability').addEventListener('click', () => { $('#availability-form').reset(); $('#availability-form').elements.id.value = ''; $('#availability-modal').showModal(); });
$('#availability-form').addEventListener('submit', event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); if (data.start >= data.end) return toast('O horário de início deve ser anterior ao fim.'); const item = { dayOfWeek: data.day, startTime: data.start, endTime: data.end }; if (data.id) availabilityRepository.update(data.id, item); else availabilityRepository.create(item); $('#availability-modal').close(); renderAvailability(); toast('Horário salvo.'); });

document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.editGoal) return openGoal(button.dataset.editGoal);
  if (button.dataset.statusGoal) { goalsRepository.update(button.dataset.statusGoal, { status: button.dataset.status }); renderAll(); return toast(button.dataset.status === 'PAUSED' ? 'Objetivo pausado.' : 'Objetivo retomado.'); }
  if (button.dataset.completeGoal) { goalsRepository.update(button.dataset.completeGoal, { status: 'COMPLETED' }); renderAll(); return toast('Objetivo concluído.'); }
  if (button.dataset.archiveGoal) { if (window.confirm('Arquivar este objetivo? As sessões anteriores serão preservadas.')) { goalsRepository.archive(button.dataset.archiveGoal); renderAll(); toast('Objetivo arquivado.'); } return; }
  if (button.dataset.addDay) { $('#availability-form').reset(); $('#availability-form').elements.day.value = button.dataset.addDay; $('#availability-modal').showModal(); }
  if (button.dataset.editAvailability) { const item = availabilityRepository.getById(button.dataset.editAvailability); const form = $('#availability-form'); form.elements.id.value = item.id; form.elements.day.value = item.dayOfWeek; form.elements.start.value = item.startTime; form.elements.end.value = item.endTime; $('#availability-modal').showModal(); }
  if (button.dataset.removeAvailability) { if (window.confirm('Remover este horário de disponibilidade?')) { availabilityRepository.remove(button.dataset.removeAvailability); renderAll(); toast('Horário removido.'); } return; }
  if (button.id === 'add-area') { const goalId = $('#goal-form').elements.id.value; const name = askName('Nome da área'); if (name) { areasRepository.create({ goalId, name, description: '' }); renderAreas(goalId); } }
  if (button.dataset.editArea) { const area = areasRepository.getById(button.dataset.editArea); const name = askName('Nome da área', area.name); if (name) { areasRepository.update(area.id, { name }); renderAreas(area.goalId); } }
  if (button.dataset.removeArea) { const area = areasRepository.getById(button.dataset.removeArea); if (area && window.confirm('Excluir esta área e seus tópicos?')) { topicsRepository.getAll().filter(topic => topic.areaId === area.id).forEach(topic => topicsRepository.remove(topic.id)); areasRepository.remove(area.id); renderAreas(area.goalId); } }
  if (button.dataset.addTopic) { const name = askName('Nome do tópico'); if (name) { const area = areasRepository.getById(button.dataset.addTopic); topicsRepository.create({ areaId: area.id, name, description: '' }); renderAreas(area.goalId); } }
  if (button.dataset.editTopic) { const topic = topicsRepository.getById(button.dataset.editTopic); const name = askName('Nome do tópico', topic.name); if (name) { topicsRepository.update(topic.id, { name }); const area = areasRepository.getById(topic.areaId); renderAreas(area.goalId); } }
   if (button.dataset.removeTopic) { const topic = topicsRepository.getById(button.dataset.removeTopic); const area = topic && areasRepository.getById(topic.areaId); if (topic && area && window.confirm('Excluir este tópico?')) { topicsRepository.remove(topic.id); renderAreas(area.goalId); } }
   if (button.dataset.acceptRecommendation) {
     const recommendation = aiCoachRepository.getRecommendations().find(item => item.id === button.dataset.acceptRecommendation);
     try { const accepted = AIRecommendationService.apply(recommendation, { goalsRepository, studentProfileRepository }); aiCoachRepository.updateRecommendation(accepted.id, accepted); renderAll(); toast('Sugestão aceita. Sua rotina será ajustada na próxima geração.'); } catch (error) { toast(error.message); }
   }
    if (button.dataset.rejectRecommendation) { aiCoachRepository.updateRecommendation(button.dataset.rejectRecommendation, { status: 'REJECTED', rejectedAt: new Date().toISOString() }); renderCoach(); toast('Sugestão ignorada.'); }
    if (button.id === 'retry-coach') refreshCoach();
   if (button.dataset.startSession) startSession(button.dataset.startSession);
   if (button.dataset.skipSession) {
     const session = sessionsRepository.getById(button.dataset.skipSession);
     if (session && window.confirm('Pular esta sessão?')) { sessionsRepository.update(session.id, SessionFlow.skip(session, window.prompt('Observação opcional', '') || '')); renderToday(); toast('Sessão marcada como pulada.'); }
   }
   if (button.dataset.cancelSession) {
     const session = sessionsRepository.getById(button.dataset.cancelSession);
     if (session && window.confirm('Cancelar esta sessão?')) { sessionsRepository.update(session.id, SessionFlow.cancel(session)); renderToday(); toast('Sessão cancelada.'); }
   }
   if (button.dataset.rescheduleSession) {
     const session = sessionsRepository.getById(button.dataset.rescheduleSession); if (!session) return;
     const date = window.prompt('Nova data (AAAA-MM-DD)', session.date); if (!date) return;
     const time = window.prompt('Novo horário (HH:MM)', sessionTime(session, 'plannedStart')); if (!time) return;
      try { const { original, replacement } = SessionFlow.reschedule(session, date, time, new Date(), () => storage.id(), { availability: availabilityRepository.getAll(), sessions: sessionsRepository.getAll() }); sessionsRepository.update(session.id, original); sessionsRepository.create(replacement); renderToday(); renderHistory(); toast('Sessão reagendada.'); } catch (error) { toast(error.message); }
   }
});

function onboardingAvailability() {
  $('#onboarding-availability').innerHTML = Object.entries(DAYS).map(([day, label]) => `<label class="onboarding-day"><input type="checkbox" value="${day}" /> ${label}<input type="time" value="07:00" aria-label="Início ${label}" /><input type="time" value="10:00" aria-label="Fim ${label}" /></label>`).join('');
}
function renderOnboarding() {
  const titles = ['Vamos configurar seus estudos', 'Defina seu ritmo', 'Quando você pode estudar?', 'Sua configuração'];
  const copies = ['Primeiro vamos definir o que você quer estudar.', 'Escolha uma meta possível para dias difíceis e outra para dias normais.', 'Você pode adicionar vários intervalos depois.', 'Confira sua configuração antes de gerar sua primeira rotina.'];
  $('#onboarding-step').textContent = `PASSO ${onboardingStep} DE 4`; $('#onboarding-title').textContent = titles[onboardingStep - 1]; $('#onboarding-copy').textContent = copies[onboardingStep - 1];
  document.querySelectorAll('[data-onboarding-panel]').forEach(panel => panel.hidden = Number(panel.dataset.onboardingPanel) !== onboardingStep);
  $('#onboarding-back').hidden = onboardingStep === 1; $('#onboarding-next').textContent = onboardingStep === 4 ? 'Começar minha rotina' : 'Continuar';
  if (onboardingStep === 4) { const form = $('#onboarding-form'); const selected = [...document.querySelectorAll('.onboarding-day input[type="checkbox"]:checked')]; $('#onboarding-summary').innerHTML = `<p><strong>Objetivo</strong><br>${escapeHtml(form.elements.name.value)}</p><p><strong>Meta ideal</strong><br>${minutes(Number(form.elements.ideal.value))}</p><p><strong>Meta mínima</strong><br>${minutes(Number(form.elements.minimum.value))}</p><p><strong>Disponibilidade</strong><br>${selected.map(input => `${DAYS[input.value]} ${input.parentElement.querySelectorAll('input[type="time"]')[0].value} - ${input.parentElement.querySelectorAll('input[type="time"]')[1].value}`).join('<br>') || 'Nenhum horário definido'}</p>`; }
}
function openOnboarding() { onboardingStep = 1; $('#onboarding-form').reset(); onboardingAvailability(); renderOnboarding(); $('#onboarding-modal').showModal(); }
$('#onboarding-back').addEventListener('click', () => { onboardingStep--; renderOnboarding(); });
$('#onboarding-form').addEventListener('submit', event => { event.preventDefault(); const form = event.target; if (onboardingStep === 1 && !form.elements.name.value.trim()) return toast('Informe o nome do objetivo.'); if (onboardingStep === 2) { const minimum = Number(form.elements.minimum.value); const ideal = Number(form.elements.ideal.value); if (!minimum || !ideal || minimum > ideal) return toast('A meta mínima deve ser positiva e menor ou igual à ideal.'); } if (onboardingStep < 4) { onboardingStep++; return renderOnboarding(); } try { const now = new Date().toISOString(); const goal = goalsRepository.create({ name: form.elements.name.value.trim(), priority: form.elements.priority.value, description: '', idealMinutesPerDay: Number(form.elements.ideal.value), minimumMinutesPerDay: Number(form.elements.minimum.value), status: 'ACTIVE', createdAt: now, updatedAt: now }); document.querySelectorAll('.onboarding-day input[type="checkbox"]:checked').forEach(input => { const [start, end] = input.parentElement.querySelectorAll('input[type="time"]'); if (start.value < end.value) availabilityRepository.create({ dayOfWeek: input.value, startTime: start.value, endTime: end.value }); }); $('#onboarding-next').disabled = true; $('#onboarding-next').textContent = 'Gerando rotina...'; $('#onboarding-modal').close(); renderAll(); toast(availabilityRepository.getAll().length ? 'Rotina atualizada.' : 'Sua configuração está pronta. Sua próxima sessão aparecerá no próximo dia disponível.'); } catch (error) { console.error(error); toast('Não foi possível salvar sua configuração. Tente novamente.'); } finally { $('#onboarding-next').disabled = false; } });

$('#open-data-settings').addEventListener('click', () => { const settings = aiCoachRepository.getSettings(); const form = $('#coach-settings-form'); Object.keys(settings).forEach(key => { if (form.elements[key]) form.elements[key].checked = Boolean(settings[key]); }); $('#import-summary').hidden = true; $('#data-settings-modal').showModal(); });
$('#coach-settings-form').addEventListener('submit', event => { event.preventDefault(); const form = event.target; aiCoachRepository.saveSettings(Object.fromEntries(['enabled', 'sendPerformanceData', 'sendStudyNotes', 'sendDetailedHistory'].map(name => [name, form.elements[name].checked]))); $('#data-settings-modal').close(); renderCoach(); toast('Configurações salvas.'); });
$('#export-data').addEventListener('click', () => { const blob = new Blob([JSON.stringify(backupRepository.exportData(), null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `fluxo-backup-${TODAY}.json`; link.click(); URL.revokeObjectURL(link.href); toast('Backup exportado.'); });
$('#select-import').addEventListener('click', () => $('#import-data').click());
$('#import-data').addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const backup = JSON.parse(reader.result); backupRepository.validate(backup); $('#import-summary').hidden = false; $('#import-summary').innerHTML = `<p>Backup válido: ${(backup.data.goals || []).length} objetivos e ${(backup.data.sessions || []).length} sessões.</p><button type="button" class="finish-button" id="confirm-import">Confirmar importação</button>`; $('#confirm-import').onclick = () => { if (window.confirm('Importar este backup e substituir os dados locais atuais?')) { backupRepository.importData(backup); window.location.reload(); } }; } catch (error) { console.error(error); $('#import-summary').hidden = false; $('#import-summary').textContent = 'Não foi possível importar este arquivo. Verifique se ele é um backup válido.'; } }; reader.readAsText(file); });
window.addEventListener('fluxo:storage-error', () => toast('Não foi possível salvar seus dados localmente. Verifique as permissões do navegador e tente novamente.'));

renderAll();
const recoverableSession = activeSession();
if (recoverableSession) showTimer(recoverableSession);
else if (!activeGoals().length) openOnboarding();
iconify();
