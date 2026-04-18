function init(){
    document.querySelectorAll('.tool-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = 'panel-' + tab.dataset.panel;

            document.querySelectorAll('.tool-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(panelId).classList.add('active');
        });
    });
    profileInit()
}

function profileInit(){
    document.querySelector("#profile-btn").addEventListener('click', () => {openProfile("Emile", "#" + "42323")})
    document.querySelector("#profile-overlay").addEventListener('click', (e) => {poBackdrop(e)})
    document.querySelector("#po-close").addEventListener('click', () => {closeProfile()})
    document.querySelector("#po-code-btn").addEventListener('click', () => {poCopy()})
    document.querySelectorAll(".po-tab").forEach(tab => {tab.addEventListener('click', (e) => {poTab(e.target)})})
}

// aanpassen
function openProfile(username, code, memberSince) {
    document.querySelector("#po-username").textContent = username || 'User';
    document.querySelector("#po-code").textContent = code || '';
    document.querySelector("#po-member-since").textContent = memberSince ? 'Lid sinds ' + memberSince : 'Lid sinds 18 februari';
    document.querySelector("#profile-overlay").classList.add('po-open');
    document.body.style.overflow = 'hidden';
}

function closeProfile() {
    document.querySelector("#profile-overlay").classList.remove('po-open');
    document.body.style.overflow = '';
}

function poBackdrop(e) {
    if (e.target.id === 'profile-overlay'){
        closeProfile();
    }
}

function poTab(btn) {
    document.querySelectorAll('.po-tab').forEach(t => t.classList.remove('po-tab-active'));
    btn.classList.add('po-tab-active');
}

let poCopyTimer;
function poCopy() {
    navigator.clipboard.writeText(document.getElementById('po-code').textContent).catch(() => {});
    document.getElementById('po-ico-copy').classList.add('po-hidden');
    document.getElementById('po-ico-check').classList.remove('po-hidden');
    clearTimeout(poCopyTimer);
    poCopyTimer = setTimeout(() => {
        document.getElementById('po-ico-copy').classList.remove('po-hidden');
        document.getElementById('po-ico-check').classList.add('po-hidden');
    }, 1800);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProfile();
});

init()