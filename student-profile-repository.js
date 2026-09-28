const studentProfileRepository = (() => {
  const profileKey = keys.profile;
  const reviewsKey = keys.reviews;
  const read = (key, fallback) => storage.read(key, fallback);
  const write = (key, value) => storage.write(key, value);
  const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const now = () => new Date().toISOString();
  return {
    getProfile() { return read(profileKey, null); },
    updateProfile(changes) { const current = this.getProfile() || { id: id(), createdAt: now() }; const profile = { ...current, ...changes, updatedAt: now() }; write(profileKey, profile); return profile; },
    getWeeklyReview(weekStart) { return read(reviewsKey, []).find(review => review.weekStart === weekStart) || null; },
    saveWeeklyReview(review) { const reviews = read(reviewsKey, []); const current = reviews.find(item => item.weekStart === review.weekStart); const record = { ...current, ...review, id: current?.id || id(), createdAt: current?.createdAt || now(), updatedAt: now() }; write(reviewsKey, [...reviews.filter(item => item.weekStart !== review.weekStart), record]); return record; },
    getWeeklyReviews() { return read(reviewsKey, []).sort((a, b) => b.weekStart.localeCompare(a.weekStart)); }
  };
})();
