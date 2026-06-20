function getAssetPrefix() {
    return window.location.pathname.includes('/subPages/') ? '../assets/css/pictures/' : 'assets/css/pictures/';
}

function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

export function createBaseCard(baseInfo) {
    const baseTemplate = document.querySelector("#po-base-template");
    if (!baseTemplate || !baseInfo) return;

    const existing = Array.from(document.querySelectorAll('.po-card-base .po-base-info'))
        .some(info => normalizeTag(info.textContent) === normalizeTag(baseInfo.tag));
    if (existing) return;

    const baseTemplateCopy = baseTemplate.content.cloneNode(true);
    const item = baseTemplateCopy.querySelector('.po-card-base');
    const img = baseTemplateCopy.querySelector(".po-base-img");
    img.src = `${getAssetPrefix()}townhalls/Town_Hall${baseInfo.townHallLevel || 1}.png`;
    baseTemplateCopy.querySelector(".po-base-name").textContent = baseInfo.name || 'Base';
    baseTemplateCopy.querySelector(".po-base-info").textContent = baseInfo.tag || '';
    if (!document.querySelector('#po-tab-bases')?.classList.contains('po-tab-active')) {
        item.classList.add('hidden');
    }
    document.querySelector(".po-panel-content")?.appendChild(baseTemplateCopy);
}
