const test = require('node:test');
const assert = require('node:assert/strict');

const values = new Map();
function loadRepositories() {
  global.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  global.crypto = { randomUUID: () => `id-${values.size}` };
  global.window = { dispatchEvent() {} };
  global.CustomEvent = class { constructor(name) { this.name = name; } };
  const fs = require('node:fs');
  const vm = require('node:vm');
  vm.runInThisContext(fs.readFileSync(require('node:path').join(__dirname, '..', 'repositories.js'), 'utf8'));
}

loadRepositories();

test('exports versioned data without AI analysis or credentials', () => {
  goalsRepository.create({ name: 'Concurso', idealMinutesPerDay: 120, minimumMinutesPerDay: 30 });
  const backup = backupRepository.exportData();
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.data.goals.length, 1);
  assert.equal(Object.hasOwn(backup.data, 'aiAnalysis'), false);
  assert.equal(JSON.stringify(backup).includes('GROQ_API_KEY'), false);
});

test('rejects malformed backups before import', () => {
  assert.throws(() => backupRepository.validate({ data: { goals: 'not-an-array' } }), /estrutura inválida/);
  assert.throws(() => backupRepository.validate({ data: { goals: [{ name: 42 }] } }), /dados inválidos/);
});
