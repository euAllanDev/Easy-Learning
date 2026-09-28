const fs = require('node:fs');
const path = require('node:path');

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'study-coach-system-prompt.txt'), 'utf8');

async function generateCoachResponse(context, { fetchImpl = fetch, apiKey = process.env.GROQ_API_KEY, model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', timeoutMs = 15000 } = {}) {
  if (!apiKey) { const error = new Error('Study Coach is not configured.'); error.code = 'AI_UNAVAILABLE'; throw error; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(context) }] }) });
    if (!response.ok) throw new Error(`Groq request failed (${response.status}).`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq returned an invalid response.');
    try { return JSON.parse(content); } catch { throw new Error('Groq returned invalid JSON.'); }
  } finally { clearTimeout(timeout); }
}

module.exports = { generateCoachResponse, SYSTEM_PROMPT };
