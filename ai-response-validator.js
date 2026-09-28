const AIResponseValidator = (() => {
  const OBSERVATION_TYPES = new Set(['FACT', 'PATTERN', 'CHANGE']);
  const RECOMMENDATION_TYPES = new Set(['REDUCE_LOAD', 'INCREASE_LOAD', 'REBALANCE_GOAL', 'CHANGE_SESSION_LENGTH', 'CHANGE_STUDY_PERIOD', 'FOCUS_TOPIC', 'MAINTAIN_CURRENT_PLAN', 'REVIEW_WEEK']);
  const CONFIDENCE = new Set(['LOW', 'MEDIUM', 'HIGH']);
  const hasUnsafeContent = value => typeof value === 'string' && /(executejavascript|runcommand|writefile|deletedata)/i.test(value);
  const isText = value => typeof value === 'string' && value.trim().length > 0 && !hasUnsafeContent(value);
  const exactKeys = (value, keys) => Object.keys(value).every(key => keys.includes(key));

  function validateCoachResponse(response, { goalIds = [], maximumRecommendations = 3 } = {}) {
    if (!response || typeof response !== 'object' || Array.isArray(response) || !exactKeys(response, ['summary', 'observations', 'recommendations']) || !isText(response.summary) || !Array.isArray(response.observations) || !Array.isArray(response.recommendations) || response.recommendations.length > maximumRecommendations) return null;
    if (!response.observations.every(item => item && exactKeys(item, ['type', 'text']) && OBSERVATION_TYPES.has(item.type) && isText(item.text))) return null;
    for (const item of response.recommendations) {
      if (!item || !exactKeys(item, ['type', 'goalId', 'reason', 'confidence', 'suggestedChange']) || !RECOMMENDATION_TYPES.has(item.type) || !isText(item.reason) || !CONFIDENCE.has(item.confidence) || (item.goalId != null && !goalIds.includes(item.goalId))) return null;
      if (item.goalId != null && typeof item.goalId !== 'string') return null;
      if (['REDUCE_LOAD', 'INCREASE_LOAD', 'REBALANCE_GOAL'].includes(item.type) && (!item.goalId || !item.suggestedChange)) return null;
      if (item.suggestedChange != null) {
        const change = item.suggestedChange;
        if (!change || typeof change !== 'object' || !exactKeys(change, ['minimumMinutes', 'idealMinutes']) || !Number.isFinite(change.minimumMinutes) || !Number.isFinite(change.idealMinutes) || change.minimumMinutes < 1 || change.idealMinutes < change.minimumMinutes || change.idealMinutes > 720) return null;
      }
    }
    return response;
  }
  return { OBSERVATION_TYPES, RECOMMENDATION_TYPES, CONFIDENCE, validateCoachResponse };
})();

if (typeof module !== 'undefined') module.exports = AIResponseValidator;
