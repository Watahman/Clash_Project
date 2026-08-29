import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

export class AuthUnavailableError extends Error {
    constructor(cause) {
        super(t('auth.sessionUnavailable'));
        this.name = 'AuthUnavailableError';
        this.code = 'AUTH_UNAVAILABLE';
        this.status = Number(cause?.status) || 0;
        this.cause = cause;
    }
}
