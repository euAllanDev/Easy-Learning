const AIRecommendationService = (() => {
  const STATUS = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED', EXPIRED: 'EXPIRED' };
  function apply(recommendation, { goalsRepository, studentProfileRepository }) {
    if (!recommendation || recommendation.status !== STATUS.PENDING) throw new Error('A recomendação não está pendente.');
    const change = recommendation.suggestedChange;
    if (['REDUCE_LOAD', 'INCREASE_LOAD', 'REBALANCE_GOAL'].includes(recommendation.type)) {
      if (!recommendation.goalId || !change || !goalsRepository.getById(recommendation.goalId)) throw new Error('A recomendação não possui um objetivo ou minutos válidos.');
      goalsRepository.update(recommendation.goalId, { minimumMinutesPerDay: change.minimumMinutes, idealMinutesPerDay: change.idealMinutes });
    } else if (recommendation.type === 'CHANGE_SESSION_LENGTH') {
      if (!change) throw new Error('A recomendação não possui minutos válidos.');
      studentProfileRepository.updateProfile({ preferredSessionMinutes: change.idealMinutes });
    } else if (recommendation.type === 'CHANGE_STUDY_PERIOD' && recommendation.suggestedChange?.period) {
      studentProfileRepository.updateProfile({ preferredStudyPeriod: recommendation.suggestedChange.period });
    }
    return { ...recommendation, status: STATUS.ACCEPTED, appliedAt: new Date().toISOString() };
  }
  return { STATUS, apply };
})();

if (typeof module !== 'undefined') module.exports = AIRecommendationService;
