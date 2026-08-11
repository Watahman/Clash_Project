export function createEntityGuesserActions({
    getState,
    getCategory,
    getAnswer,
    isFixtureActive,
    availableHintCount,
    buildHint,
    getLocale = () => 'en',
    calculateScore,
    readJson,
    writeJson,
    updateStreak,
    statsStorageKey,
    saveDailyState,
    shouldPersistDailyState,
    announce
}) {
    function complete(won) {
        const state = getState();
        const category = getCategory();
        state.completed = true;
        state.won = won;
        state.score = calculateScore(
            state.guesses.length,
            state.hints.length,
            won,
            category.maxAttempts
        );
        if (shouldPersistDailyState(state.mode, isFixtureActive())) {
            writeJson(
                statsStorageKey,
                updateStreak(readJson(statsStorageKey, {}), state.dateKey, won, category.id)
            );
        }
        saveDailyState();
        announce();
    }

    function revealHint() {
        const state = getState();
        const category = getCategory();
        const available = availableHintCount(
            state.guesses.length,
            state.hints.length,
            category.maxAttempts
        );
        if (available <= 0 || state.completed) return;
        state.hints.push(buildHint(getAnswer(), category, state.hints.length + 1, getLocale()));
        saveDailyState();
        announce();
    }

    return { complete, revealHint };
}
