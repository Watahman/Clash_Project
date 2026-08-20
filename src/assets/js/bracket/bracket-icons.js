const paths = Object.freeze({
    bracket: '<path d="M5 5h4v4H5V5Zm10 10h4v4h-4v-4Zm0-10h4v4h-4V5ZM9 7h3v10h3"/>',
    seed: '<path d="M5 5h4v4H5V5Zm10 0h4v4h-4V5ZM5 15h4v4H5v-4Zm10 0h4v4h-4v-4ZM9 7h6M9 17h6"/>',
    shuffle: '<path d="M4 7h3c3.5 0 4.5 10 8 10h5m-4-3 4 3-4 3M4 17h3c1.2 0 2.2-1.4 3-3m3-4c.8-1.6 1.8-3 3-3h5m-4-3 4 3-4 3"/>',
    upload: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"/>',
    download: '<path d="M12 4v12m0 0-4.5-4.5M12 16l4.5-4.5M5 19h14"/>',
    reset: '<path d="M5 8a7 7 0 1 1 1.5 7.7M5 8V4m0 4h4"/>',
    trophy: '<path d="M8 5h8v4.5a4 4 0 0 1-8 0V5Zm4 8.5V18m-4 1h8M5 6H3v2a3 3 0 0 0 3 3m13-5h2v2a3 3 0 0 1-3 3"/>',
    chevronLeft: '<path d="m14.5 5-7 7 7 7"/>',
    chevronRight: '<path d="m9.5 5 7 7-7 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
});

export function bracketIcon(name, documentRef = globalThis.document) {
    const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths[name] || paths.bracket;
    return svg;
}
