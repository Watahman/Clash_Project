export function createBaseCard(baseInfo){
    console.log(baseInfo);
    const baseTemplate = document.querySelector("#po-base-template");
    const baseTemplateCopy = baseTemplate.content.cloneNode(true);
    baseTemplateCopy.querySelector(".po-base-img").src = `../assets/css/pictures/townhalls/Town_Hall${baseInfo[0].townHallLevel}.png`;
    baseTemplateCopy.querySelector(".po-base-name").textContent = baseInfo[0].name;
    baseTemplateCopy.querySelector(".po-base-info").textContent = baseInfo[0].tag;

    document.querySelector(".po-panel").appendChild(baseTemplateCopy);
}