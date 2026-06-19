export function createBaseCard(baseInfo) {
    const baseTemplate = document.querySelector("#po-base-template");
    const baseTemplateCopy = baseTemplate.content.cloneNode(true);
    baseTemplateCopy.querySelector(".po-base-img").src = `/assets/css/pictures/townhalls/Town_Hall${baseInfo.townHallLevel}.png`;
    baseTemplateCopy.querySelector(".po-base-name").textContent = baseInfo.name;
    baseTemplateCopy.querySelector(".po-base-info").textContent = baseInfo.tag;
    document.querySelector(".po-panel-content").appendChild(baseTemplateCopy);
}
