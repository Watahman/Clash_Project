import { savePlan } from './cwl-planner.js'

function createPlayerCard(playerInfo, clanuuid){
    const playerTemplate = document.querySelector("#cwl-player-template");

    playerInfo.forEach(player => {
        const playerTemplateClone = playerTemplate.content.cloneNode(true);

        playerTemplateClone.querySelector(".cwl-player-townhall-foto").src = `../assets/css/pictures/townhalls/Town_Hall${player.townHallLevel}.png`;
        playerTemplateClone.querySelector(".cwl-player-hashtag").textContent = player.tag;
        playerTemplateClone.querySelector(".cwl-player-name").textContent = player.name;
        playerTemplateClone.querySelector(".cwl-player-clan").textContent = player.clanName || "No clan";

        const element = playerTemplateClone.querySelector(".cwl-player-article");
        element.originalContainer = document.querySelector("#cwl-available-players");

        if(clanuuid != null){
            if(clanuuid === "user"){
                element.classList.add("userBase")
                element.classList.add("hidden")
                document.querySelector("#cwl-account-list").appendChild(playerTemplateClone)
            }else if(clanuuid === "friends"){
                element.classList.add("friendBase")
                element.classList.add("hidden")
                document.querySelector("#cwl-account-list").appendChild(playerTemplateClone)
            }else if(clanuuid === "group"){
                element.classList.add("groupBase")
                element.classList.add("hidden")
                document.querySelector("#cwl-group-preview-list").appendChild(playerTemplateClone)
            }else{
                makePlayerDraggable(element);
                document.querySelectorAll(".cwl-clan-article").forEach(article => {
                    if(article.id === "cwl-clan-template_" + clanuuid){
                        article.querySelector(".cwl-clan-player-list").appendChild(playerTemplateClone)
                        const prevPlayers = article.querySelector(".cwl-amount-of-players-in-clan").textContent.split("/")
                        article.querySelector(".cwl-amount-of-players-in-clan").textContent = parseInt(prevPlayers[0]) + 1 + "/" + prevPlayers[1]
                    }
                })
            }
        }else{
            document.querySelector("#cwl-available-players").appendChild(playerTemplateClone);
            const totalPlayers = document.querySelector("#cwl-total-player-amount");
            totalPlayers.textContent = parseInt(totalPlayers.textContent) + 1 + "";
        }
    })
    savePlan()
}

function createClanCard(clanInfo, playerAmount, uuid = ""){
    const clanTemplate = document.querySelector("#cwl-clan-template");
    const clanTemplateClone = clanTemplate.content.cloneNode(true);

    clanTemplateClone.querySelector(".cwl-clan-logo").src = clanInfo.badgeUrls.small
    clanTemplateClone.querySelector(".cwl-clan-name").textContent = clanInfo.name;
    clanTemplateClone.querySelector(".cwl-amount-of-players-in-clan").textContent = `0/${playerAmount}`;
    clanTemplateClone.querySelector(".cwl-amount-of-players-in-clan").id = "cwl-clan-playeramount-template-" + (document.querySelector("#cwl-all-clans").children.length + 1);
    if(uuid === ""){
        clanTemplateClone.querySelector("article").id = "cwl-clan-template_" + crypto.randomUUID()
    }else clanTemplateClone.querySelector("article").id = "cwl-clan-template_" + uuid;
    clanTemplateClone.querySelector(".cwl-delete-clan").addEventListener("click", (e) => {
        e.target.closest("article").querySelector(".cwl-clan-player-list").querySelectorAll(".cwl-player-article").forEach(article => {
            document.querySelector("#cwl-available-players").appendChild(article);
            document.querySelector("#cwl-total-player-amount").textContent = parseInt(document.querySelector("#cwl-total-player-amount").textContent) + 1 + "";
        })

        e.target.closest("article").remove()
        savePlan()
    })
    document.querySelector("#cwl-all-clans").appendChild(clanTemplateClone);
    localStorage.setItem("clanId_" + clanInfo.name, clanInfo.tag);

    const newClanArticle = document.querySelector("#cwl-all-clans").lastElementChild;
    makeClanDraggable(newClanArticle);

    savePlan();
}

function makePlayerDraggable(element) {
    let offsetX, offsetY;
    let startLeft, startTop;
    let dragging = false;
    element.originalContainer = element.parentElement;

    element.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

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

function makeClanDraggable(clanArticle) {
    const handle = clanArticle.querySelector(".cwl-clan-info-card");
    handle.style.cursor = "grab";

    let dragging = false;
    let placeholder = null;
    let offsetX, offsetY;

    handle.addEventListener("mousedown", (e) => {
        if (e.target.closest(".cwl-delete-clan") ||
            e.target.closest(".cwl-confirm-clan-is-full") ||
            e.target.closest(".cwl-player-article")) return;

        e.preventDefault();
        if (dragging) return;
        dragging = true;

        const container = document.querySelector("#cwl-all-clans");
        const rect = clanArticle.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // Maak een placeholder aan op de originele plek
        placeholder = document.createElement("div");
        placeholder.style.width = rect.width + "px";
        placeholder.style.height = rect.height + "px";
        placeholder.style.border = "2px dashed var(--border-focus)";
        placeholder.style.borderRadius = "var(--radius-xl)";
        placeholder.style.background = "var(--accent-glow)";
        placeholder.style.flexShrink = "0";
        container.insertBefore(placeholder, clanArticle);

        // Float de kaart vrij
        clanArticle.style.position = "fixed";
        clanArticle.style.left = rect.left + "px";
        clanArticle.style.top = rect.top + "px";
        clanArticle.style.width = rect.width + "px";
        clanArticle.style.zIndex = "500";
        clanArticle.style.opacity = "0.92";
        clanArticle.style.boxShadow = "var(--shadow-lg)";
        clanArticle.style.pointerEvents = "none";
        document.body.appendChild(clanArticle);

        const onMouseMove = (e) => {
            clanArticle.style.left = (e.clientX - offsetX) + "px";
            clanArticle.style.top  = (e.clientY - offsetY) + "px";

            // Zoek welke clan we overheen bewegen en verplaats placeholder
            clanArticle.style.pointerEvents = "none";
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".cwl-clan-article");
            clanArticle.style.pointerEvents = "";

            if (target && target !== clanArticle) {
                const targetRect = target.getBoundingClientRect();
                const midX = targetRect.left + targetRect.width / 2;
                if (e.clientX < midX) {
                    container.insertBefore(placeholder, target);
                } else {
                    container.insertBefore(placeholder, target.nextSibling);
                }
            }
        };

        const onMouseUp = () => {
            dragging = false;
            handle.style.cursor = "grab";

            // Zet de kaart op de plek van de placeholder
            clanArticle.style.position = "";
            clanArticle.style.left = "";
            clanArticle.style.top = "";
            clanArticle.style.width = "";
            clanArticle.style.zIndex = "";
            clanArticle.style.opacity = "";
            clanArticle.style.boxShadow = "";
            clanArticle.style.pointerEvents = "";

            container.insertBefore(clanArticle, placeholder);
            placeholder.remove();
            placeholder = null;

            savePlan();

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

function updatePlayerAmount(element, dropped) {
    const clan = element.parentElement.closest(".cwl-clan-article");
    const playersInClan = clan?.querySelector(".cwl-amount-of-players-in-clan");
    const total = document.querySelector("#cwl-total-player-amount");

    const delta = dropped ? 1 : -1;

    if (clan && playersInClan) {
        const [current, max] = playersInClan.textContent.split("/");
        playersInClan.textContent = `${parseInt(current) + delta}/${max}`;
    } else {
        total.textContent = parseInt(total.textContent) + delta + "";
    }

    if (dropped) savePlan();
}

export { createPlayerCard, createClanCard };