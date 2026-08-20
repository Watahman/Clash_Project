import {
    bracketChampion,
    createBracket,
    importBracket,
    setMatchWinner
} from './bracket-engine.js';
import { participantDisplayName } from './bracket-model.js';
import { t } from '../i18n/i18n.js';
import { bracketText } from './bracket-copy.js';
import { createBracketFixture } from './bracket-fixtures.js';
import { drawBracketConnectors, renderBracketBoard } from './bracket-renderer.js';
import { createBracketResetDialog } from './bracket-page-dialog.js';
import { downloadBracketJson, readBracketFile } from './bracket-page-files.js';
import { createBracketStorage } from './bracket-page-storage.js';
import {
    bracketErrorCopy,
    changedMatches,
    snapshotMatches
} from './bracket-page-utils.js';
import {
    announce,
    applyBracketToForm,
    focusSelectedRound,
    participantEntries,
    renderModuleCopy,
    setSetupVisibility,
    setStatus,
    updateGuidanceCopy,
    updateRoundControls,
    updateSetupSummary
} from './bracket-page-view.js';

class BracketController {
    constructor({
        refs,
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        storageBackend = windowRef?.localStorage,
        fixture = { isRequested: () => false, get: async () => null },
        fixtureFactory = createBracketFixture,
        boardRenderer = renderBracketBoard,
        connectorRenderer = drawBracketConnectors
    } = {}) {
        Object.assign(this, { refs, documentRef, windowRef, fixture, fixtureFactory, boardRenderer, connectorRenderer });
        this.state = { bracket: null, activeRound: 0, setupCollapsed: false, fixtureMode: false, changedMatchIds: new Set() };
        this.storage = createBracketStorage({
            storage: storageBackend,
            enabled: () => !this.state.fixtureMode
        });
        this.dialog = createBracketResetDialog({
            dialog: refs.resetDialog,
            cancel: refs.resetCancel,
            reset: refs.reset
        });
        this.chooseWinner = this.chooseWinner.bind(this);
        this.setRound = this.setRound.bind(this);
    }

    save() {
        if (!this.state.bracket || this.state.fixtureMode) return;
        if (!this.storage.save(this.state.bracket)) {
            setStatus(this.refs, bracketText('localSave'), 'info');
        }
    }
    restore() {
        if (this.state.fixtureMode) return;
        try {
            const restored = this.storage.restore(importBracket);
            if (!restored) return;
            this.state.bracket = restored;
            applyBracketToForm(this.refs, restored);
            this.state.setupCollapsed = true;
            setStatus(this.refs, bracketText('restored'), 'success');
        } catch {
            setStatus(this.refs, bracketText('restoreError'), 'error');
        }
    }
    render() {
        updateSetupSummary(this.refs, this.state.bracket);
        this.renderResultHeading();
        this.renderResultSummary();
        this.boardRenderer({
            board: this.refs.board,
            navigation: this.refs.roundTabs,
            bracket: this.state.bracket,
            activeRound: this.state.activeRound,
            changedMatchIds: this.state.changedMatchIds,
            onWinner: this.chooseWinner,
            onRoundChange: this.setRound
        });
        updateRoundControls(this.refs, this.state.bracket, this.state.activeRound);
        setSetupVisibility(this.refs, this.state.setupCollapsed);
    }
    renderResultHeading() {
        const count = this.state.bracket?.participants.length || participantEntries(this.refs).length;
        const title = this.state.fixtureMode
            ? bracketText('fixtureName', { count })
            : this.state.bracket?.name || this.refs.name.value.trim() || t('bracket.title');
        this.refs.resultTitle.textContent = title;
        this.refs.resultCount.textContent = String(count);
    }
    renderResultSummary() {
        const champion = bracketChampion(this.state.bracket);
        this.refs.resultChampion.textContent = champion
            ? this.displayName(champion)
            : '—';
        this.refs.resultChampionHelp.textContent = champion
            ? bracketText('championComplete', {
                name: this.displayName(champion)
            })
            : bracketText('championHelp');
    }

    generate(shuffle) {
        try {
            this.state.bracket = createBracket(participantEntries(this.refs), {
                shuffle,
                name: this.refs.name.value
            });
            this.state.activeRound = 0;
            this.state.changedMatchIds = new Set();
            this.state.setupCollapsed = true;
            this.save();
            this.render();
            setStatus(this.refs, bracketText('generated'), 'success');
        } catch (error) {
            setStatus(this.refs, bracketErrorCopy(error), 'error');
        }
    }
    chooseWinner(match, player) {
        if (!this.state.bracket) return;
        const before = snapshotMatches(this.state.bracket);
        try {
            setMatchWinner(this.state.bracket, match.id, player);
            this.state.changedMatchIds = changedMatches(this.state.bracket, before);
            this.save();
            this.render();
            this.announceWinner(player);
        } catch {
            setStatus(this.refs, bracketText('changeWinner'), 'error');
        }
    }

    displayName(player) {
        return participantDisplayName(
            this.state.bracket,
            player,
            number => bracketText('participantNumber', { number })
        );
    }
    announceWinner(player) {
        const champion = bracketChampion(this.state.bracket);
        const message = champion
            ? bracketText('championComplete', {
                name: this.displayName(champion)
            })
            : bracketText('selectedWinner', {
                name: this.displayName(player)
            });
        setStatus(this.refs, message, 'success');
        announce(this.refs, message, this.windowRef.setTimeout.bind(this.windowRef));
    }

    setRound(roundIndex, focus = false) {
        if (!this.state.bracket) return;
        this.state.activeRound = Math.max(
            0,
            Math.min(roundIndex, this.state.bracket.rounds.length - 1)
        );
        this.render();
        if (focus) {
            focusSelectedRound(this.refs);
            this.scrollSelectedRound();
        }
    }
    scrollSelectedRound() {
        const round = this.refs.board.querySelector(
            `#bracket-round-${this.state.activeRound + 1}`
        );
        round?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    showSetup() {
        this.state.setupCollapsed = false;
        this.render();
        this.refs.participants.focus();
    }

    changeRound(delta) {
        this.setRound(this.state.activeRound + delta, true);
    }
    clearBracket() {
        this.state.bracket = null;
        this.state.activeRound = 0;
        this.state.setupCollapsed = false;
        this.state.changedMatchIds = new Set();
        this.refs.name.value = 'Clash tournament';
        this.refs.participants.value = '';
        if (!this.state.fixtureMode) this.storage.remove();
        this.render();
        setStatus(this.refs);
        announce(this.refs, bracketText('empty'), this.windowRef.setTimeout.bind(this.windowRef));
    }
    openResetDialog() {
        if (!this.dialog.open()) this.clearBracket();
    }
    confirmReset() {
        this.dialog.close();
        this.clearBracket();
    }
    closeResetDialog() {
        this.dialog.close();
    }
    cancelReset(event) {
        event.preventDefault();
        this.closeResetDialog();
    }
    exportJson() {
        if (!this.state.bracket) {
            setStatus(this.refs, bracketText('empty'), 'error');
            return;
        }
        downloadBracketJson(this.state.bracket, {
            documentRef: this.documentRef,
            urlRef: this.windowRef.URL,
            schedule: this.windowRef.setTimeout.bind(this.windowRef)
        });
        setStatus(this.refs, t('bracket.export'), 'success');
    }
    async importJson(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const imported = await readBracketFile(file, importBracket);
            this.applyImportedBracket(imported);
            setStatus(this.refs, bracketText('imported'), 'success');
        } catch (error) {
            const message = error?.code === 'too-large'
                ? bracketText('importTooLarge')
                : bracketText('importError');
            setStatus(this.refs, message, 'error');
        } finally {
            this.refs.importFile.value = '';
        }
    }
    applyImportedBracket(imported) {
        this.state.bracket = imported;
        this.state.fixtureMode = false;
        this.state.activeRound = 0;
        this.state.changedMatchIds = new Set();
        this.state.setupCollapsed = true;
        applyBracketToForm(this.refs, imported);
        this.save();
        this.render();
    }
    async loadFixture() {
        if (!this.fixture.isRequested()) return false;
        this.state.fixtureMode = true;
        try {
            const scenario = await this.fixture.get();
            this.state.bracket = this.fixtureFactory(scenario.id);
            this.showFixtureStatus();
        } catch {
            setStatus(this.refs, bracketText('importError'), 'error');
        }
        return true;
    }
    showFixtureStatus() {
        if (!this.state.bracket) return;
        applyBracketToForm(this.refs, this.state.bracket);
        this.state.setupCollapsed = true;
        setStatus(this.refs, bracketText('fixtureLoaded'), 'info');
    }
    languageChanged() {
        renderModuleCopy(this.documentRef, this.refs);
        if (this.state.fixtureMode) {
            this.refs.name.value = bracketText('fixtureName', { count: this.state.bracket?.participants.length || 0 });
        }
        this.render();
        updateGuidanceCopy(this.documentRef);
    }
    updateInputSummary() {
        updateSetupSummary(this.refs, this.state.bracket);
    }
    redrawConnectors() {
        this.connectorRenderer(this.refs.board, this.state.bracket);
    }
    getState() {
        return {
            bracket: this.state.bracket,
            activeRound: this.state.activeRound,
            setupCollapsed: this.state.setupCollapsed,
            fixtureMode: this.state.fixtureMode,
            changedMatchIds: new Set(this.state.changedMatchIds)
        };
    }
}
export function createBracketController(options) {
    return new BracketController(options);
}
