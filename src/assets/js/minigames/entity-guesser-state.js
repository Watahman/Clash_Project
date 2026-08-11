export function createEntityGuesserStateManager({
    entityCategories,
    dataVersion,
    dailyStorageKey,
    practiceCategoryKey,
    getCategory,
    getEntities,
    getDailyCategory,
    getDailyEntity,
    getPracticeEntity,
    readJson,
    readString,
    writeString,
    isFixtureActive
}) {
    function isValidDailyState(saved, dateKey, dailyCategory) {
        return Boolean(
            saved?.mode === 'daily'
            && saved.dateKey === dateKey
            && saved.dataVersion === dataVersion
            && saved.categoryId === dailyCategory.id
            && typeof saved.answerId === 'string'
            && Array.isArray(saved.guesses)
            && Array.isArray(saved.hints)
            && saved.guesses.length <= dailyCategory.maxAttempts
            && saved.hints.length <= 2
            && typeof saved.completed === 'boolean'
            && typeof saved.won === 'boolean'
        );
    }

    function practiceCategoryId(requested) {
        if (entityCategories.some(item => item.id === requested)) return requested;
        const saved = readString(practiceCategoryKey);
        return entityCategories.some(item => item.id === saved) ? saved : 'troopsHeroes';
    }

    function createEmptyState(mode, dateKey, categoryId, answerId) {
        return {
            mode,
            dateKey,
            dataVersion,
            categoryId,
            answerId,
            guesses: [],
            hints: [],
            completed: false,
            won: false,
            score: 0
        };
    }

    function createDailyState(dateKey) {
        const dailyCategory = getDailyCategory(dateKey);
        const saved = readJson(dailyStorageKey);
        if (isValidDailyState(saved, dateKey, dailyCategory)) return saved;
        return createEmptyState(
            'daily',
            dateKey,
            dailyCategory.id,
            getDailyEntity(dateKey, dailyCategory).id
        );
    }

    function createPracticeState(requestedCategory, dateKey) {
        const categoryId = practiceCategoryId(requestedCategory);
        if (!isFixtureActive()) writeString(practiceCategoryKey, categoryId);
        const category = getCategory(categoryId);
        return createEmptyState(
            'practice',
            dateKey,
            categoryId,
            getPracticeEntity(category).id
        );
    }

    function create(mode, requestedCategory, dateKey) {
        return mode === 'daily'
            ? createDailyState(dateKey)
            : createPracticeState(requestedCategory, dateKey);
    }

    function hydrate(next, dateKey = next.dateKey) {
        let state = next;
        let category = getCategory(state.categoryId);
        let entities = getEntities(category.id);
        let answer = entities.find(entity => entity.id === state.answerId);

        if (!answer) {
            state = create(state.mode, category.id, dateKey);
            category = getCategory(state.categoryId);
            entities = getEntities(category.id);
            answer = entities.find(entity => entity.id === state.answerId);
        }

        return { state, category, entities, answer };
    }

    return { create, hydrate, isValidDailyState };
}
