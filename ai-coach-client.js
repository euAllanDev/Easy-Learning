const AICoachClient = (() => {
  async function generateCoachResponse(context, fetchImpl = fetch) {
    const response = await fetchImpl('/api/ai/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) });
    if (!response.ok) throw new Error('Study Coach indisponível.');
    return response.json();
  }
  return { generateCoachResponse };
})();

if (typeof module !== 'undefined') module.exports = AICoachClient;
