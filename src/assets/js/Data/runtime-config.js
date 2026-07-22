const existingConfig = window.APP_CONFIG || {};
window.APP_CONFIG = {
    ...existingConfig,
    API_BASE_URL: String(existingConfig.API_BASE_URL || '/api').replace(/\/+$/, '')
};
