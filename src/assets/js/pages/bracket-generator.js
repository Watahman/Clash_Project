import { initI18n } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { createBracketController } from '../bracket/bracket-page-controller.js?v=20260829-public-auth-v1';
import { bindBracketEvents } from '../bracket/bracket-page-events.js';
import {
    collectBracketRefs,
    mountActionIcons,
    renderModuleCopy,
    updateGuidanceCopy
} from '../bracket/bracket-page-view.js?v=20260829-public-auth-v1';
import { createBracketFixture } from '../bracket/bracket-fixtures.js';
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
    renderModuleCopy(documentRef, refs);
    const loadedFixture = await controller.loadFixture();
    if (!loadedFixture) {
        controller.restore();
    }
    controller.render();
    windowRef.setTimeout(() => updateGuidanceCopy(documentRef), 0);
    return controller;
}

if (typeof document !== 'undefined') void initBracketGenerator();
