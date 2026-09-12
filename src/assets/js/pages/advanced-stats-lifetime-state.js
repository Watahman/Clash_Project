export function createLifetimeLoader({ state, renderPage }) {
    function resetLifetimeState() {
        state.lifetimeGeneration += 1;
        state.lifetime = null;
        state.lifetimeState = 'idle';
        state.lifetimePlayerTag = '';
        state.lifetimeLoadAttempted = false;
    }

    async function loadLifetime() {
        const playerTag = state.playerTag;
        const generation = state.lifetimeGeneration;
        if (!playerTag || (state.lifetimeLoadAttempted && state.lifetimePlayerTag === playerTag)) return;
        state.lifetimePlayerTag = playerTag;
        state.lifetimeLoadAttempted = true;
        state.lifetimeState = 'loading';
        renderPage();
        try {
            const response = await state.api.getLifetime?.(playerTag);
            if (playerTag !== state.playerTag || generation !== state.lifetimeGeneration) return;
            state.lifetime = response || null;
            state.lifetimeState = response?.partial || response?.data?.partial ? 'partial' : response ? 'ready' : 'unavailable';
        } catch (error) {
            if (playerTag !== state.playerTag || generation !== state.lifetimeGeneration) return;
            console.error('advanced_stats_lifetime_load_failed', error);
            state.lifetime = null;
            state.lifetimeState = 'error';
        }
        if (playerTag === state.playerTag && generation === state.lifetimeGeneration) renderPage();
    }

    return { loadLifetime, resetLifetimeState };
}
