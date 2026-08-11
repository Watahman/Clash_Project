export const BRACKET_IMPORT_MAX_BYTES = 1024 * 1024;

function importSizeError() {
    const error = new Error('Bracket JSON file is too large.');
    error.code = 'too-large';
    return error;
}

function downloadName(name) {
    return `${String(name || 'bracket').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'bracket'}.json`;
}

export function downloadBracketJson(bracket, {
    documentRef = globalThis.document,
    urlRef = globalThis.URL,
    schedule = globalThis.setTimeout
} = {}) {
    const blob = new Blob([JSON.stringify(bracket, null, 2)], { type: 'application/json' });
    const objectUrl = urlRef.createObjectURL(blob);
    const link = documentRef.createElement('a');
    link.href = objectUrl;
    link.download = downloadName(bracket.name);
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    schedule(() => urlRef.revokeObjectURL(objectUrl), 0);
}

export async function readBracketFile(file, importer) {
    if (!file) return null;
    if (Number(file.size) > BRACKET_IMPORT_MAX_BYTES) throw importSizeError();
    return importer(await file.text());
}
