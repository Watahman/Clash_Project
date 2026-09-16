import { isFixtureRequested } from '../fixtures/fixture-mode.js?v=20260829-public-auth-v1';
import { enforcePreviewProgressAccess } from './preview-progress-access.js?v=20260916-preview-progress-v1';

const guardPromise = isFixtureRequested()
    ? Promise.resolve()
    : enforcePreviewProgressAccess();

window.clashtoolsRegisterInitialLoad?.(guardPromise);
