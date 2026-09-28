const AIAnalysisCache = (() => {
  const TTL_MS = 24 * 60 * 60 * 1000;
  const isValid = (analysis, hash, now = Date.now()) => Boolean(analysis && analysis.contextHash === hash && Number.isFinite(new Date(analysis.createdAt).getTime()) && now - new Date(analysis.createdAt).getTime() < TTL_MS);
  return { TTL_MS, isValid };
})();

if (typeof module !== 'undefined') module.exports = AIAnalysisCache;
