const STORAGE_SCHEMA_VERSION = 1;
const STATE_KEY = 'fluxo:state';
const keys = { goals: 'fluxo:goals', areas: 'fluxo:areas', topics: 'fluxo:topics', availability: 'fluxo:availability', sessions: 'fluxo:sessions', routineDays: 'fluxo:routine-days', aiSettings: 'fluxo:ai-settings', aiAnalysis: 'fluxo:ai-analysis', aiRecommendations: 'fluxo:ai-recommendations', profile: 'fluxo:student-profile', reviews: 'fluxo:weekly-reviews' };

function storageFailure(error) {
  console.error('Local storage failed:', error);
  window.dispatchEvent(new CustomEvent('fluxo:storage-error'));
}
const storage = {
  read(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch (error) { storageFailure(error); return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { storageFailure(error); throw new Error('Não foi possível salvar seus dados localmente. Verifique as permissões do navegador e tente novamente.'); }
  },
  id() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
};

const normalizeGoal = item => { const idealMinutesPerDay = Math.max(1, Number(item?.idealMinutesPerDay) || 1); return { id: typeof item?.id === 'string' ? item.id : storage.id(), name: String(item?.name || '').trim(), description: String(item?.description || ''), priority: ['HIGH', 'MEDIUM', 'LOW'].includes(item?.priority) ? item.priority : 'MEDIUM', idealMinutesPerDay, minimumMinutesPerDay: Math.min(idealMinutesPerDay, Math.max(1, Number(item?.minimumMinutesPerDay) || 1)), status: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(item?.status) ? item.status : 'ACTIVE', createdAt: item?.createdAt || new Date().toISOString(), updatedAt: item?.updatedAt || new Date().toISOString() }; };
const normalizeAvailability = item => ({ id: typeof item?.id === 'string' ? item.id : storage.id(), dayOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(item?.dayOfWeek) ? item.dayOfWeek : 'MONDAY', startTime: /^\d{2}:\d{2}$/.test(item?.startTime || '') ? item.startTime : '09:00', endTime: /^\d{2}:\d{2}$/.test(item?.endTime || '') ? item.endTime : '10:00' });
const normalizeSession = item => ({ ...item, id: typeof item?.id === 'string' ? item.id : storage.id(), date: /^\d{4}-\d{2}-\d{2}$/.test(item?.date || '') ? item.date : new Date().toISOString().slice(0, 10), plannedMinutes: Math.max(0, Number(item?.plannedMinutes) || 0), actualMinutes: item?.actualMinutes == null ? null : Math.max(0, Number(item.actualMinutes) || 0), focusedSeconds: Math.max(0, Number(item?.focusedSeconds) || 0), pausedDuration: Math.max(0, Number(item?.pausedDuration) || 0), status: ['PLANNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'SKIPPED', 'RESCHEDULED', 'CANCELLED'].includes(item?.status) ? item.status : 'PLANNED', source: ['ROUTINE', 'MANUAL'].includes(item?.source) ? item.source : 'ROUTINE' });
const normalizeProfile = item => item && typeof item === 'object' ? { ...item, id: typeof item.id === 'string' ? item.id : storage.id(), preferredStudyPeriod: ['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'].includes(item.preferredStudyPeriod) ? item.preferredStudyPeriod : 'FLEXIBLE' } : null;

function migrateStorage() {
  const state = storage.read(STATE_KEY, null);
  if (state?.schemaVersion >= STORAGE_SCHEMA_VERSION) return;
  const collections = [[keys.goals, normalizeGoal], [keys.availability, normalizeAvailability], [keys.sessions, normalizeSession]];
  collections.forEach(([key, normalize]) => {
    const value = storage.read(key, []);
    if (Array.isArray(value)) storage.write(key, value.filter(item => item && typeof item === 'object').map(normalize));
  });
  const profile = normalizeProfile(storage.read(keys.profile, null));
  if (profile) storage.write(keys.profile, profile);
  storage.write(STATE_KEY, { schemaVersion: STORAGE_SCHEMA_VERSION, migratedAt: new Date().toISOString() });
}

function collectionRepository(key, normalize = item => item) {
  return {
    getAll: () => { const items = storage.read(key, []); return Array.isArray(items) ? items : []; },
    getById: id => storage.read(key, []).find(item => item.id === id),
    create: item => { const record = normalize({ ...item, id: storage.id() }); storage.write(key, [...storage.read(key, []), record]); return record; },
    update: (id, changes) => { const all = storage.read(key, []).map(item => item.id === id ? normalize({ ...item, ...changes, updatedAt: new Date().toISOString() }) : item); storage.write(key, all); return all.find(item => item.id === id); },
    remove: id => storage.write(key, storage.read(key, []).filter(item => item.id !== id))
  };
}

const goalsRepository = { ...collectionRepository(keys.goals, normalizeGoal), archive(id) { return this.update(id, { status: 'ARCHIVED' }); } };
const areasRepository = collectionRepository(keys.areas);
const topicsRepository = collectionRepository(keys.topics);
const availabilityRepository = collectionRepository(keys.availability, normalizeAvailability);
const sessionsRepository = { ...collectionRepository(keys.sessions, normalizeSession), getByDate(date) { return this.getAll().filter(session => session.date === date); }, replaceFutureRoutine(date, sessions) { const kept = this.getAll().filter(session => session.date !== date || ['COMPLETED', 'IN_PROGRESS', 'PAUSED'].includes(session.status) || session.source === 'MANUAL'); storage.write(keys.sessions, [...kept, ...sessions.map(normalizeSession)]); return sessions; } };
const routineDaysRepository = { get(date) { return storage.read(keys.routineDays, {})[date]; }, save(date, result) { const days = storage.read(keys.routineDays, {}); storage.write(keys.routineDays, { ...days, [date]: { totalAvailableMinutes: result.totalAvailableMinutes, totalPlannedMinutes: result.totalPlannedMinutes, warnings: result.warnings } }); } };
const aiCoachRepository = {
  getSettings() { return { enabled: true, sendPerformanceData: true, sendStudyNotes: false, sendDetailedHistory: false, ...storage.read(keys.aiSettings, {}) }; },
  saveSettings(changes) { const settings = { ...this.getSettings(), ...changes }; storage.write(keys.aiSettings, settings); return settings; },
  getAnalysis() { return storage.read(keys.aiAnalysis, null); }, saveAnalysis(analysis) { storage.write(keys.aiAnalysis, analysis); return analysis; },
  getRecommendations() { return storage.read(keys.aiRecommendations, []); }, saveRecommendations(recommendations) { storage.write(keys.aiRecommendations, recommendations); return recommendations; },
  updateRecommendation(id, changes) { const all = this.getRecommendations().map(item => item.id === id ? { ...item, ...changes } : item); this.saveRecommendations(all); return all.find(item => item.id === id); }
};

const backupRepository = {
  exportData() { return { schemaVersion: STORAGE_SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: Object.fromEntries(Object.entries(keys).filter(([name]) => !['aiAnalysis'].includes(name)).map(([name, key]) => [name, storage.read(key, name === 'profile' ? null : [])])) }; },
  validate(data) {
    if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') throw new Error('O arquivo não contém um backup válido do Fluxo.');
    ['goals', 'areas', 'topics', 'availability', 'sessions', 'reviews', 'aiRecommendations'].forEach(name => { if (data.data[name] != null && !Array.isArray(data.data[name])) throw new Error('O arquivo possui uma estrutura inválida.'); });
    if (data.data.goals?.some(goal => !goal || typeof goal.name !== 'string') || data.data.sessions?.some(session => !session || typeof session.status !== 'string')) throw new Error('O arquivo possui dados inválidos.');
    return true;
  },
  importData(backup) { this.validate(backup); Object.entries(keys).forEach(([name, key]) => { if (name === 'aiAnalysis') return; if (Object.hasOwn(backup.data, name)) storage.write(key, backup.data[name]); }); migrateStorage(); }
};

function createInitialState() { migrateStorage(); }
