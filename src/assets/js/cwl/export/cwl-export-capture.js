import { ASSET_FALLBACKS } from '../../assets/entity-assets.js';

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;
const DEFAULT_PIXEL_RATIO = 2;
let stylesheetPromise;

export async function captureCwlExportElement(root, options = {}) {
    if (root instanceof HTMLCanvasElement) return canvasBlob(root);
    if (!root || root.nodeType !== Node.ELEMENT_NODE) {
        throw new TypeError('A rendered export template is required.');
    }

    const width = dimension(root, 'exportWidth', DEFAULT_WIDTH);
    const height = dimension(root, 'exportHeight', DEFAULT_HEIGHT);
    const ratio = options.pixelRatio || DEFAULT_PIXEL_RATIO;
    const clone = await prepareClone(root, width, options.cssUrl);
    const markup = new XMLSerializer().serializeToString(clone);
    const svg = exportSvg(markup, width, height, ratio);
    const source = await loadSvgImage(svg);
    return drawPng(source, width, height, ratio);
}

export function triggerCwlExportDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function prepareClone(root, width, cssUrl) {
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    const clone = root.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.marginRight = '0';
    clone.style.marginBottom = '0';
    clone.style.width = `${width}px`;
    const style = document.createElement('style');
    style.textContent = await loadStylesheet(cssUrl);
    clone.prepend(style);
    await Promise.all(Array.from(clone.querySelectorAll('img')).map(inlineImage));
    return clone;
}

function loadStylesheet(cssUrl) {
    stylesheetPromise ||= fetch(cssUrl)
        .then(response => response.ok ? response.text() : '')
        .catch(() => '');
    return stylesheetPromise;
}

async function inlineImage(image) {
    const original = image.getAttribute('src') || ASSET_FALLBACKS.clan;
    const dataUrl = await fetchImageData(original);
    if (dataUrl) image.setAttribute('src', dataUrl);
    else if (original !== ASSET_FALLBACKS.clan) image.setAttribute('src', ASSET_FALLBACKS.clan);
    image.removeAttribute('srcset');
}

async function fetchImageData(source) {
    if (source.startsWith('data:')) return source;
    try {
        const response = await fetch(new URL(source, location.href), { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Asset unavailable');
        return blobDataUrl(await response.blob());
    } catch {
        if (source === ASSET_FALLBACKS.clan) return '';
        return fetchImageData(ASSET_FALLBACKS.clan);
    }
}

function exportSvg(markup, width, height, ratio) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * ratio}" height="${height * ratio}" viewBox="0 0 ${width} ${height}"><foreignObject width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml">${markup}</div></foreignObject></svg>`;
}

function loadSvgImage(svg) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Export SVG could not be loaded.'));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
}

async function drawPng(source, width, height, ratio) {
    const canvas = document.createElement('canvas');
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D rendering is unavailable.');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvasBlob(canvas);
}

function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob !== 'function') {
            reject(new Error('PNG export is unavailable in this browser.'));
            return;
        }
        canvas.toBlob(blob => (
            blob ? resolve(blob) : reject(new Error('PNG export returned no image.'))
        ), 'image/png');
    });
}

function dimension(element, key, fallback) {
    const value = Number(element?.dataset?.[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function blobDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Asset could not be read.'));
        reader.readAsDataURL(blob);
    });
}
