import { getPlayerBasicData } from '../API/API-Functions.js';
import { getClanInfoRequest } from '../API/API-Clan.js';
import { createPlayerCard, createClanCard } from '../templates/CWLTemplates.js';
import { normalizeTag, plannerHasPlayer } from './cwl-utils.js';
import { t } from '../i18n/i18n.js';
import { bindBackdropClick } from '../utils/backdrop-click.js';

const TAG_CHARS = '0289PYLQGRJCUV';
const HASH_TAG_PATTERN = new RegExp(`#([${TAG_CHARS}]{3,15})(?![A-Z0-9])`, 'gi');
const BARE_TAG_PATTERN = new RegExp(`^(?=.*[PYLQGRJCUV])[${TAG_CHARS}]{3,15}$`, 'i');
const LARGE_IMPORT_WARNING_THRESHOLD = 500;
const LOOKUP_CONCURRENCY = 4;
const IMPORT_CONCURRENCY = 4;
const MAX_RATE_LIMIT_RETRIES = 5;
const DEFAULT_RATE_LIMIT_DELAY_MS = 60_000;
const DEFAULT_UPSTREAM_RATE_LIMIT_DELAY_MS = 10_000;

const PLAYER_CONTEXT_WORDS = [
    'player', 'players', 'speler', 'spelers', 'member', 'members', 'lid', 'leden',
    'account', 'accounts', 'roster', 'participant', 'participants', 'deelnemer', 'deelnemers'
];
const CLAN_CONTEXT_WORDS = ['clan', 'clans', 'guild', 'guilds'];

let state = createEmptyState();

function createEmptyState() {
    return {
        file: null,
        candidates: [],
        results: [],
        busy: false,
        analysisToken: 0,
        importScope: 'both'
    };
}

export function extractTagsFromCell(value) {
    if (value == null) return [];
    const raw = String(value).trim();
    if (!raw) return [];

    const normalizedText = raw.replaceAll('%23', '#').toUpperCase();
    const tags = new Set();
    let match;

    HASH_TAG_PATTERN.lastIndex = 0;
    while ((match = HASH_TAG_PATTERN.exec(normalizedText)) !== null) {
        tags.add(`#${match[1]}`);
    }

    const bare = normalizedText.replace(/^['"]|['"]$/g, '').trim();
    if (BARE_TAG_PATTERN.test(bare)) tags.add(`#${bare}`);

    return Array.from(tags);
}

export function inferTagContext(contextText = '') {
    const text = String(contextText).toLowerCase();
    if (/\b(player|member|account|speler|lid)[ _-]*tag\b/.test(text)) return 'player';
    if (/\bclan[ _-]*tag\b/.test(text)) return 'clan';

    const playerScore = PLAYER_CONTEXT_WORDS.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
    const clanScore = CLAN_CONTEXT_WORDS.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
    if (playerScore === clanScore) return 'unknown';
    return playerScore > clanScore ? 'player' : 'clan';
}

function inferExplicitTagContext(contextText = '') {
    const compact = String(contextText).toLowerCase().replace(/[ _-]+/g, '');
    if (/(player|member|account|speler|lid)tag/.test(compact)) return 'player';
    if (/clantag/.test(compact)) return 'clan';
    return 'unknown';
}

function inferColumnContexts(rows) {
    const maxColumns = rows.reduce(
        (count, row) => Math.max(count, Array.isArray(row) ? row.length : 0),
        0
    );
    return Array.from({ length: maxColumns }, (_, colIndex) => {
        for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
            const type = inferExplicitTagContext(rows[rowIndex]?.[colIndex]);
            if (type !== 'unknown') return type;
        }
        return 'unknown';
    });
}

export function collectWorkbookCandidates(workbook, XLSX) {
    const byTag = new Map();

    for (const sheetName of workbook.SheetNames || []) {
        const sheet = workbook.Sheets?.[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false,
            blankrows: false
        });
        const columnContexts = inferColumnContexts(rows);

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
            const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
            for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
                const tags = extractTagsFromCell(row[colIndex]);
                if (!tags.length) continue;

                const inferredType = inferCellContext(
                    rows,
                    rowIndex,
                    colIndex,
                    sheetName,
                    columnContexts
                );
                const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });

                for (const tag of tags) {
                    const existing = byTag.get(tag);
                    const occurrence = { sheet: sheetName, cell: cellAddress, inferredType };
                    if (existing) {
                        existing.occurrences.push(occurrence);
                        if (inferredType !== 'unknown') {
                            existing.inferredTypes.add(inferredType);
                            existing.inferredType = existing.inferredTypes.size === 1
                                ? inferredType
                                : 'unknown';
                        }
                    } else {
                        byTag.set(tag, {
                            tag,
                            inferredType,
                            inferredTypes: new Set(inferredType === 'unknown' ? [] : [inferredType]),
                            occurrences: [occurrence]
                        });
                    }
                }
            }
        }
    }

    return Array.from(byTag.values(), candidate => {
        const { inferredTypes, ...result } = candidate;
        return result;
    });
}

function inferCellContext(rows, rowIndex, colIndex, sheetName, columnContexts) {
    const columnType = columnContexts[colIndex] || 'unknown';
    if (columnType !== 'unknown') return columnType;
    for (let row = rowIndex - 1; row >= Math.max(0, rowIndex - 4); row -= 1) {
        const above = Array.isArray(rows[row]) ? rows[row][colIndex] : '';
        const directType = inferTagContext(above);
        if (directType !== 'unknown') return directType;
    }
    return inferTagContext(buildContextText(rows, rowIndex, colIndex, sheetName));
}

function buildContextText(rows, rowIndex, colIndex, sheetName) {
    const bits = [sheetName];
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];

    for (let c = Math.max(0, colIndex - 3); c <= Math.min(row.length - 1, colIndex + 1); c += 1) {
        if (c === colIndex) continue;
        if (row[c] != null && String(row[c]).trim()) bits.push(String(row[c]));
    }

    for (let r = Math.max(0, rowIndex - 4); r < rowIndex; r += 1) {
        const above = Array.isArray(rows[r]) ? rows[r][colIndex] : '';
        if (above != null && String(above).trim()) bits.push(String(above));
    }

    return bits.join(' ');
}

export function initSpreadsheetImport() {
    const openButton = document.querySelector('#cwl-import-spreadsheet-button');
    const overlay = document.querySelector('#cwl-overlay-import-spreadsheet');
    const input = document.querySelector('#cwl-spreadsheet-file-input');
    const dropzone = document.querySelector('#cwl-spreadsheet-dropzone');
    const importButton = document.querySelector('#cwl-spreadsheet-import-selected');
    const resetButton = document.querySelector('#cwl-spreadsheet-reset');
    const scopeSelect = document.querySelector('#cwl-spreadsheet-import-scope');

    if (!openButton || !overlay || !input || !dropzone || !importButton) return;

    openButton.addEventListener('click', () => {
        resetImporter();
        overlay.classList.remove('hidden');
    });

    bindBackdropClick(overlay, () => {
        overlay.classList.add('hidden');
        resetImporter();
    });

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input.click();
        }
    });
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
        event.preventDefault();
        dropzone.classList.remove('is-dragging');
    }));
    dropzone.addEventListener('drop', event => {
        const file = event.dataTransfer?.files?.[0];
        if (file) analyzeFile(file);
    });
    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) analyzeFile(file);
    });

    importButton.addEventListener('click', importSelected);
    resetButton?.addEventListener('click', resetImporter);
    scopeSelect?.addEventListener('change', () => {
        state.importScope = scopeSelect.value || 'both';
        renderResults();
    });
    document.querySelector('#cwl-spreadsheet-preview')?.addEventListener('change', handlePreviewChange);
    window.addEventListener('clashtools:language-changed', () => renderResults());

    resetImporter();
}

async function analyzeFile(file) {
    if (state.busy) return;
    const XLSX = globalThis.XLSX;
    if (!XLSX?.read || !XLSX?.utils?.sheet_to_json) {
        setStatus(t('cwl.sheetImportLibraryMissing'), 'error');
        return;
    }

    const token = ++state.analysisToken;
    state.file = file;
    state.candidates = [];
    state.results = [];
    setBusy(true);
    setFileLabel(file.name);
    setProgress(0, t('cwl.sheetReadingFile'));
    clearResults();

    let stage = 'reading';
    try {
        const buffer = await file.arrayBuffer();
        if (token !== state.analysisToken) return;
        const workbook = XLSX.read(buffer, { type: 'array', dense: true });
        state.candidates = collectWorkbookCandidates(workbook, XLSX);

        if (!state.candidates.length) {
            setStatus(t('cwl.sheetNoTags'), 'warning');
            setProgress(0, '');
            return;
        }
        stage = 'validation';

        if (state.candidates.length > LARGE_IMPORT_WARNING_THRESHOLD) {
            setStatus(t('cwl.sheetLargeImport', { count: state.candidates.length }), 'warning');
        } else {
            setStatus(t('cwl.sheetFoundTags', { count: state.candidates.length }), '');
        }

        state.results = new Array(state.candidates.length);
        let completed = 0;
        await runWithConcurrency(state.candidates, LOOKUP_CONCURRENCY, async (candidate, index) => {
            if (token !== state.analysisToken) return;
            state.results[index] = await classifyCandidate(candidate);
            completed += 1;
            setProgress(completed / state.candidates.length, t('cwl.sheetCheckingTags', {
                current: completed,
                total: state.candidates.length
            }));
        });

        if (token !== state.analysisToken) return;
        setProgress(1, t('cwl.sheetAnalysisComplete'));
        renderResults();
        setPreviewMode(true);
    } catch (error) {
        console.error('Spreadsheet import failed', error);
        setStatus(t(stage === 'validation' ? 'cwl.sheetValidationError' : 'cwl.sheetReadError'), 'error');
        setProgress(0, '');
    } finally {
        if (token === state.analysisToken) setBusy(false);
    }
}

async function classifyCandidate(candidate) {
    let playerResult = { ok: false, data: null };
    let clanResult = { ok: false, data: null };

    if (candidate.inferredType === 'player') {
        playerResult = await lookupPlayer(candidate.tag);
        if (!playerResult.ok) clanResult = await lookupClan(candidate.tag);
    } else if (candidate.inferredType === 'clan') {
        clanResult = await lookupClan(candidate.tag);
        if (!clanResult.ok) playerResult = await lookupPlayer(candidate.tag);
    } else {
        [playerResult, clanResult] = await Promise.all([
            lookupPlayer(candidate.tag),
            lookupClan(candidate.tag)
        ]);
    }

    let detectedType = 'invalid';
    let selectedType = null;
    if (playerResult.ok && clanResult.ok) {
        detectedType = 'ambiguous';
        selectedType = candidate.inferredType === 'clan' ? 'clan' : 'player';
    } else if (playerResult.ok) {
        detectedType = 'player';
        selectedType = 'player';
    } else if (clanResult.ok) {
        detectedType = 'clan';
        selectedType = 'clan';
    }

    const alreadyInPlanner = selectedType === 'player'
        ? plannerHasPlayer(candidate.tag)
        : selectedType === 'clan' && plannerHasClan(candidate.tag);

    return {
        ...candidate,
        detectedType,
        selectedType,
        playerData: playerResult.ok ? playerResult.data : null,
        clanData: clanResult.ok ? clanResult.data : null,
        alreadyInPlanner,
        selected: detectedType !== 'invalid' && !alreadyInPlanner
    };
}

function rateLimitDelayMs(error) {
    const retryAfterSeconds = Number(error?.details?.retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return Math.max(1_000, Math.ceil(retryAfterSeconds * 1_000));
    }
    return error?.code === 'UPSTREAM_RATE_LIMITED'
        ? DEFAULT_UPSTREAM_RATE_LIMIT_DELAY_MS
        : DEFAULT_RATE_LIMIT_DELAY_MS;
}

function delay(milliseconds) {
    return new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));
}

export async function lookupWithRateLimitRetry(request, {
    wait = delay,
    maxRetries = MAX_RATE_LIMIT_RETRIES
} = {}) {
    let retries = 0;
    while (true) {
        try {
            return { ok: true, data: await request() };
        } catch (error) {
            if (error?.status === 404) return { ok: false, error, data: null };
            if (error?.status !== 429 || retries >= maxRetries) throw error;
            retries += 1;
            await wait(rateLimitDelayMs(error));
        }
    }
}

function lookupPlayer(tag) {
    return lookupWithRateLimitRetry(() => getPlayerBasicData(tag));
}

function lookupClan(tag) {
    return lookupWithRateLimitRetry(() => getClanInfoRequest(tag));
}

function plannerHasClan(tag) {
    const normalized = normalizeTag(tag);
    return Array.from(document.querySelectorAll('#cwl-all-clans .cwl-clan-article'))
        .some(article => normalizeTag(article.dataset.clanTag) === normalized);
}

export function matchesImportScope(result, scope = 'both') {
    if (!result?.selectedType) return false;
    return scope === 'both' || result.selectedType === scope;
}

function handlePreviewChange(event) {
    const row = event.target.closest('[data-import-index]');
    if (!row) return;
    const index = Number(row.dataset.importIndex);
    const result = state.results[index];
    if (!result) return;

    if (event.target.matches('[data-import-select]')) {
        result.selected = event.target.checked;
    }
    if (event.target.matches('[data-import-type]')) {
        result.selectedType = event.target.value;
        result.alreadyInPlanner = result.selectedType === 'player'
            ? plannerHasPlayer(result.tag)
            : plannerHasClan(result.tag);
        if (result.alreadyInPlanner) result.selected = false;
    }
    renderResults();
}

async function importSelected() {
    if (state.busy) return;
    const selected = state.results.filter(result =>
        result?.selected
        && result.selectedType
        && !result.alreadyInPlanner
        && matchesImportScope(result, state.importScope)
    );
    if (!selected.length) {
        setStatus(t('cwl.sheetNothingSelected'), 'warning');
        return;
    }

    setBusy(true);
    let completed = 0;
    let importedPlayers = 0;
    let importedClans = 0;
    let skipped = 0;

    try {
        const playerRows = selected.filter(result => result.selectedType === 'player' && result.playerData);
        if (playerRows.length) {
            const playerResult = createPlayerCard(playerRows.map(result => result.playerData));
            importedPlayers += playerResult.added || 0;
            skipped += playerResult.skipped || 0;
            completed += playerRows.length;
            setProgress(completed / selected.length, t('cwl.sheetImporting', { current: completed, total: selected.length }));
        }

        const clanRows = selected.filter(result => result.selectedType === 'clan' && result.clanData);
        await runWithConcurrency(clanRows, IMPORT_CONCURRENCY, async result => {
            if (plannerHasClan(result.tag)) {
                skipped += 1;
            } else {
                createClanCard(result.clanData, 15);
                importedClans += 1;
            }
            completed += 1;
            setProgress(completed / selected.length, t('cwl.sheetImporting', { current: completed, total: selected.length }));
        });

        state.results.forEach(result => {
            if (!result) return;
            result.alreadyInPlanner = result.selectedType === 'player'
                ? plannerHasPlayer(result.tag)
                : result.selectedType === 'clan' && plannerHasClan(result.tag);
            if (result.alreadyInPlanner) result.selected = false;
        });
        renderResults();
        setStatus(t('cwl.sheetImportedSummary', {
            players: importedPlayers,
            clans: importedClans,
            skipped
        }), 'success');
        setProgress(1, t('cwl.sheetImportComplete'));
        document.querySelector('#cwl-overlay-import-spreadsheet')?.classList.add('hidden');
        resetImporter();
    } catch (error) {
        console.error('Spreadsheet planner import failed', error);
        setStatus(t('cwl.sheetImportError'), 'error');
    } finally {
        setBusy(false);
    }
}

function renderResults() {
    const container = document.querySelector('#cwl-spreadsheet-preview');
    const summary = document.querySelector('#cwl-spreadsheet-summary');
    const importButton = document.querySelector('#cwl-spreadsheet-import-selected');
    if (!container || !summary || !importButton) return;

    const resolved = state.results.filter(Boolean);
    if (!resolved.length) {
        container.replaceChildren();
        summary.textContent = '';
        importButton.disabled = true;
        return;
    }

    const counts = resolved.reduce((acc, result) => {
        acc[result.detectedType] = (acc[result.detectedType] || 0) + 1;
        if (result.alreadyInPlanner) acc.duplicate += 1;
        if (result.selected && matchesImportScope(result, state.importScope)) acc.selected += 1;
        return acc;
    }, { player: 0, clan: 0, ambiguous: 0, invalid: 0, duplicate: 0, selected: 0 });

    summary.textContent = t('cwl.sheetSummary', {
        players: counts.player,
        clans: counts.clan,
        ambiguous: counts.ambiguous,
        invalid: counts.invalid,
        duplicates: counts.duplicate
    });

    const fragment = document.createDocumentFragment();
    state.results.forEach((result, index) => {
        if (result) fragment.appendChild(buildResultRow(result, index));
    });
    container.replaceChildren(fragment);
    importButton.disabled = state.busy || counts.selected === 0;
    importButton.textContent = t('cwl.sheetImportSelectedCount', { count: counts.selected });
}

function buildResultRow(result, index) {
    const row = document.createElement('article');
    const inScope = matchesImportScope(result, state.importScope);
    row.className = `cwl-sheet-result cwl-sheet-result--${result.detectedType}${inScope ? '' : ' is-out-of-scope'}`;
    row.dataset.importIndex = String(index);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.importSelect = 'true';
    checkbox.checked = Boolean(result.selected && inScope);
    checkbox.disabled = result.detectedType === 'invalid' || result.alreadyInPlanner || !inScope;
    checkbox.setAttribute('aria-label', t('cwl.sheetSelectTag', { tag: result.tag }));

    const main = document.createElement('div');
    main.className = 'cwl-sheet-result-main';
    const title = document.createElement('strong');
    title.textContent = result.tag;
    const detail = document.createElement('span');
    detail.textContent = resultName(result);
    main.append(title, detail);

    const meta = document.createElement('div');
    meta.className = 'cwl-sheet-result-meta';
    const location = result.occurrences?.[0];
    const source = document.createElement('span');
    source.textContent = location ? `${location.sheet} · ${location.cell}` : '';
    const occurrences = document.createElement('span');
    if ((result.occurrences?.length || 0) > 1) {
        occurrences.textContent = t('cwl.sheetOccurrences', { count: result.occurrences.length });
    }
    meta.append(source, occurrences);

    const typeControl = result.detectedType === 'ambiguous'
        ? buildAmbiguousTypeSelect(result)
        : buildTypeBadge(result);

    row.append(checkbox, main, meta, typeControl);
    if (!inScope && result.detectedType !== 'invalid') {
        const excluded = document.createElement('span');
        excluded.className = 'cwl-sheet-scope-excluded';
        excluded.textContent = t('cwl.sheetExcludedByScope');
        row.appendChild(excluded);
    }
    if (result.alreadyInPlanner) {
        const duplicate = document.createElement('span');
        duplicate.className = 'cwl-sheet-duplicate';
        duplicate.textContent = t('cwl.sheetAlreadyInPlan');
        row.appendChild(duplicate);
    }
    return row;
}

function buildAmbiguousTypeSelect(result) {
    const select = document.createElement('select');
    select.dataset.importType = 'true';
    select.className = 'cwl-sheet-type-select';
    const player = document.createElement('option');
    player.value = 'player';
    player.textContent = t('cwl.sheetPlayer');
    const clan = document.createElement('option');
    clan.value = 'clan';
    clan.textContent = t('cwl.sheetClan');
    select.append(player, clan);
    select.value = result.selectedType || 'player';
    select.setAttribute('aria-label', t('cwl.sheetChooseType', { tag: result.tag }));
    return select;
}

function buildTypeBadge(result) {
    const badge = document.createElement('span');
    badge.className = `cwl-sheet-type cwl-sheet-type--${result.detectedType}`;
    const labels = {
        player: t('cwl.sheetPlayer'),
        clan: t('cwl.sheetClan'),
        invalid: t('cwl.sheetInvalid'),
        ambiguous: t('cwl.sheetAmbiguous')
    };
    badge.textContent = labels[result.detectedType] || result.detectedType;
    return badge;
}

function resultName(result) {
    if (result.detectedType === 'ambiguous') {
        const playerName = result.playerData?.name || t('cwl.sheetPlayer');
        const clanName = result.clanData?.name || t('cwl.sheetClan');
        return `${playerName} / ${clanName}`;
    }
    if (result.detectedType === 'player') return result.playerData?.name || '';
    if (result.detectedType === 'clan') return result.clanData?.name || '';
    return t('cwl.sheetNotFound');
}

function resetImporter() {
    state.analysisToken += 1;
    state = { ...createEmptyState(), analysisToken: state.analysisToken };
    const input = document.querySelector('#cwl-spreadsheet-file-input');
    if (input) input.value = '';
    const scopeSelect = document.querySelector('#cwl-spreadsheet-import-scope');
    if (scopeSelect) scopeSelect.value = 'both';
    setFileLabel('');
    setStatus('', '');
    setProgress(0, '');
    clearResults();
    setPreviewMode(false);
    setBusy(false);
}


function setPreviewMode(enabled) {
    const overlay = document.querySelector('#cwl-overlay-import-spreadsheet');
    const container = document.querySelector('#cwl-container-import-spreadsheet');
    overlay?.classList.toggle('is-preview-mode', enabled);
    container?.classList.toggle('is-preview-mode', enabled);
}

function clearResults() {
    const preview = document.querySelector('#cwl-spreadsheet-preview');
    const summary = document.querySelector('#cwl-spreadsheet-summary');
    if (preview) preview.replaceChildren();
    if (summary) summary.textContent = '';
    const importButton = document.querySelector('#cwl-spreadsheet-import-selected');
    if (importButton) {
        importButton.disabled = true;
        importButton.textContent = t('cwl.sheetImportSelectedCount', { count: 0 });
    }
}

function setFileLabel(name) {
    const label = document.querySelector('#cwl-spreadsheet-file-name');
    if (label) label.textContent = name || t('cwl.sheetDropFile');
}

function setStatus(message, stateName = '') {
    const status = document.querySelector('#cwl-spreadsheet-status');
    if (!status) return;
    status.textContent = message || '';
    status.dataset.state = stateName;
    status.classList.toggle('hidden', !message);
}

function setProgress(value, label) {
    const progress = document.querySelector('#cwl-spreadsheet-progress');
    const fill = document.querySelector('#cwl-spreadsheet-progress-fill');
    const text = document.querySelector('#cwl-spreadsheet-progress-label');
    const safeValue = Math.max(0, Math.min(1, Number(value) || 0));
    if (progress) progress.classList.toggle('hidden', !label);
    if (fill) fill.style.width = `${Math.round(safeValue * 100)}%`;
    if (text) text.textContent = label || '';
}

function setBusy(busy) {
    state.busy = busy;

    document.querySelector('#cwl-spreadsheet-file-input')?.toggleAttribute('disabled', busy);
    document.querySelector('#cwl-spreadsheet-reset')?.toggleAttribute('disabled', busy);
    document.querySelector('#cwl-spreadsheet-import-selected')?.toggleAttribute('disabled', busy);

    document.querySelector('#cwl-spreadsheet-dropzone')?.classList.toggle('is-busy', busy);

    document.body.style.cursor = busy ? 'wait' : '';

    renderResults();
}

async function runWithConcurrency(items, concurrency, worker) {
    let nextIndex = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            await worker(items[index], index);
        }
    });
    await Promise.all(runners);
}
