import { averageOfObjects } from './Calculations.js';

function createPlayerCard(playerInfo){
    const playerTemplate = document.querySelector("#cwl-player-template");

    playerInfo.forEach(player => {
        const playerTemplateClone = playerTemplate.content.cloneNode(true);

        playerTemplateClone.querySelector(".cwl-player-townhall-foto").src = `../assets/css/pictures/townhalls/Town_Hall${player.townHallLevel}.png`;
        playerTemplateClone.querySelector(".cwl-player-hashtag").textContent = player.tag;
        playerTemplateClone.querySelector(".cwl-player-name").textContent = player.name;
        playerTemplateClone.querySelector(".cwl-player-clan").textContent = player.clanName;
        console.log(player.leagueHistory);
        console.log(averageOfObjects(player.leagueHistory));

        const element = playerTemplateClone.querySelector(".cwl-player-article");
        element.originalContainer = document.querySelector("#cwl-available-players");
        makeDraggable(element);

        document.querySelector("#cwl-available-players").appendChild(playerTemplateClone);
        const totalPlayers = document.querySelector("#cwl-total-player-amount");
        totalPlayers.textContent = parseInt(totalPlayers.textContent) + 1 + "";
    })
}

function createClanCard(clanInfo, playerAmount){
    const clanTemplate = document.querySelector("#cwl-clan-template");
    const clanTemplateClone = clanTemplate.content.cloneNode(true);

    clanTemplateClone.querySelector(".cwl-clan-logo").src = clanInfo.badgeUrls.small
    clanTemplateClone.querySelector(".cwl-clan-name").textContent = clanInfo.name;
    clanTemplateClone.querySelector(".cwl-amount-of-players-in-clan").textContent = `0/${playerAmount}`;
    clanTemplateClone.querySelector(".cwl-amount-of-players-in-clan").id = "cwl-clan-playeramount-template-" + (document.querySelector("#cwl-all-clans").children.length + 1);
    clanTemplateClone.querySelector(".cwl-clan-player-list").id = "cwl-clan-player-list-template-" + (document.querySelector("#cwl-all-clans").children.length + 1);
    clanTemplateClone.id = "cwl-clan-template-" + document.querySelector("#cwl-all-clans").children.length + 1;
    document.querySelector("#cwl-all-clans").appendChild(clanTemplateClone);
}

function makeDraggable(element) {
    let offsetX, offsetY;
    let startLeft, startTop;
    let dragging = false;
    element.originalContainer = element.parentElement;

    element.addEventListener("mousedown", (e) => {
        e.preventDefault();

        if (dragging) return;
        dragging = true;
        updatePlayerAmount(element, false);

        const rect = element.getBoundingClientRect();
        startLeft = rect.left + window.scrollX;
        startTop = rect.top + window.scrollY;

        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        element.style.position = "absolute";
        element.style.left = startLeft + "px";
        element.style.top = startTop + "px";
        element.style.zIndex = "1000";

        document.body.appendChild(element);

        const onMouseMove = (e) => {
            element.style.left = (e.clientX - offsetX + window.scrollX) + "px";
            element.style.top = (e.clientY - offsetY + window.scrollY) + "px";
        };

        const onMouseUp = (e) => {
            dragging = false;

            // zoek alle mogelijke drop-lijsten
            const lists = document.querySelectorAll(".cwl-clan-player-list, #cwl-available-players");

            let dropped = false;

            lists.forEach(list => {
                const rect = list.getBoundingClientRect();
                if (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                ) {
                    list.appendChild(element);
                    element.originalContainer = list;
                    console.log(element);
                    console.log(element.originalContainer);
                    updatePlayerAmount(element, true);
                    dropped = true;

                }
            });

            if (!dropped) {
                element.originalContainer.appendChild(element);
                updatePlayerAmount(element, true);
            }

            element.style.position = "";
            element.style.left = "";
            element.style.top = "";
            element.style.zIndex = "";

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

function updatePlayerAmount(element, dropped){
    if(dropped){
        if(element.parentElement.id === "cwl-available-players"){
            const totalElement = document.querySelector("#cwl-total-player-amount");
            totalElement.textContent = parseInt(totalElement.textContent) + 1 + "";
        }else {
            const parentIdNumber = element.parentElement.id.split("-").pop();
            const totalElement = document.querySelector(`#cwl-clan-playeramount-template-${parentIdNumber}`);
            totalElement.textContent = parseInt(totalElement.textContent.split("/")[0]) + 1 + "/" + totalElement.textContent.split("/")[1];
        }
    }else{
        if(element.parentElement.id === "cwl-available-players"){
            const totalElement = document.querySelector("#cwl-total-player-amount");
            totalElement.textContent = parseInt(totalElement.textContent) - 1 + "";
        }else {
            const parentIdNumber = element.parentElement.id.split("-").pop();
            const totalElement = document.querySelector(`#cwl-clan-playeramount-template-${parentIdNumber}`);
            totalElement.textContent = parseInt(totalElement.textContent.split("/")[0]) - 1 + "/" + totalElement.textContent.split("/")[1];
        }
    }
}

export { createPlayerCard, createClanCard };