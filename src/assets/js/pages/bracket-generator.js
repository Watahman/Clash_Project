import { initI18n } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { createBracketController } from '../bracket/bracket-page-controller.js';
import { bindBracketEvents } from '../bracket/bracket-page-events.js';
import {
    collectBracketRefs,
    mountActionIcons,
    renderModuleCopy,
    updateGuidanceCopy
} from '../bracket/bracket-page-view.js';
import { createBracketFixture } from '../bracket/bracket-fixtures.js';
import { initBracketViewControls } from '../bracket/bracket-view-controls.js?v=20260812-bracket-view';
import {
    getRedesignFixture,
    isRedesignFixtureRequested
} from '../fixtures/redesign-fixture-mode.js';

export async function initBracketGenerator({
    documentRef = globalThis.document,
    windowRef = globalThis.window
} = {}) {
    initI18n();
    const refs = collectBracketRefs(documentRef);
    mountActionIcons(refs);
    const controller = createBracketController({
        refs,
        documentRef,
        windowRef,
        fixture: {
            isRequested: () => isRedesignFixtureRequested(windowRef.location),
            get: () => getRedesignFixture(windowRef.location)
        },
        fixtureFactory: createBracketFixture
    });
    bindBracketEvents({ refs, controller, windowRef });
    renderModuleCopy(documentRef, refs, false);
    const loadedFixture = await controller.loadFixture();
    if (!loadedFixture) {
        await syncAuthSession().catch(() => null);
        controller.restore();
    }
    controller.render();
    initBracketViewControls({ refs, controller, documentRef, windowRef });
    profileHTML();
    windowRef.setTimeout(() => updateGuidanceCopy(documentRef), 0);
    return controller;
}

if (typeof document !== 'undefined') void initBracketGenerator();
