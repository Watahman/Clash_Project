import {
    ENTITY_CATEGORIES,
    ENTITY_GUESSER_DATA_VERSION,
    getCategory,
    getEntities
} from '../minigames/entity-guesser-catalog.js?v=20260809-3';
import {
    DAILY_STORAGE_KEY,
    PRACTICE_CATEGORY_KEY,
    STATS_STORAGE_KEY,
    availableHintCount,
    buildHint,
    calculateScore,
    compareEntity,
    findEntity,
    getDailyCategory,
    getDailyEntity,
    getPracticeEntity,
    isWinningGuess,
    resultSquares,
    searchEntities,
    updateStreak,
    utcDateKey
} from '../minigames/entity-guesser-engine-v2.js?v=20260809-3';
import { getEntityAsset, installImageFallback } from '../assets/entity-assets.js';
import { getRedesignFixture, isLocalFixtureHost, isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';
import { getEntityGameFixture } from '../minigames/minigames-fixtures.js?v=20260809-3';

const COPY={en:{daily:'Daily',practice:'Practice',attempts:'Attempts',score:'Score',streak:'Streak',best:'Best',input:'Search answers',chooseAnswer:'Choose an answer',availableAnswers:'answers available. Type to filter or tap one.',scrollHelp:'Swipe the comparison sideways to see every clue.',noMatches:'No matching answers.',submit:'Submit guess',hint:'Reveal hint',newPractice:'New practice round',share:'Share result',copied:'Result copied',invalid:'Choose a valid answer from this category.',duplicate:'You already guessed that answer.',win:'Correct!',loss:'Round over',answer:'The answer was',noHint:'A hint unlocks after more attempts.',hintReady:'A hint is available.',dailyDone:'Today’s daily challenge is complete.',practiceNote:'Practice rounds do not affect your daily streak.',dailyNote:'Everyone receives the same category and answer until 00:00 UTC.',instructions:'Compare each property. Arrows show whether the hidden value is higher or lower.',correct:'Exact match',close:'Close value',partial:'Partial match',higher:'Hidden value is higher',lower:'Hidden value is lower',wrong:'Different',notComparable:'Not comparable',selectCategory:'Practice category',question:'Which Clash item is hidden?',phase:'Entity Guesser',guess:'Guess',boardContext:'Category comparisons · two optional hints',type:'Type',move:'Move',targets:'Targets',favorite:'Favorite',housing:'Housing',attack:'Attack',role:'Role',effect:'Effect',affects:'Affects',timing:'Timing',source:'Source',rarity:'Rarity',range:'Range',special:'Special',merged:'Merged',state:'State',function:'Function',size:'Size',count:'Count',system:'System',capacity:'Capacity'},
nl:{daily:'Dagelijks',practice:'Oefenen',attempts:'Pogingen',score:'Score',streak:'Reeks',best:'Beste',input:'Zoek antwoorden',chooseAnswer:'Kies een antwoord',availableAnswers:'antwoorden beschikbaar. Typ om te filteren of tik er één aan.',scrollHelp:'Veeg de vergelijking opzij om elke aanwijzing te zien.',noMatches:'Geen passende antwoorden.',submit:'Dien gok in',hint:'Toon hint',newPractice:'Nieuwe oefenronde',share:'Deel resultaat',copied:'Resultaat gekopieerd',invalid:'Kies een geldig antwoord uit deze categorie.',duplicate:'Je hebt dit antwoord al gekozen.',win:'Juist!',loss:'Ronde voorbij',answer:'Het antwoord was',noHint:'Na meer pogingen komt een hint vrij.',hintReady:'Er is een hint beschikbaar.',dailyDone:'De dagelijkse uitdaging is voltooid.',practiceNote:'Oefenrondes beïnvloeden je dagelijkse reeks niet.',dailyNote:'Iedereen krijgt tot 00:00 UTC dezelfde categorie en hetzelfde antwoord.',instructions:'Vergelijk elke eigenschap. Pijlen tonen of de verborgen waarde hoger of lager ligt.',correct:'Exact gelijk',close:'Dichte waarde',partial:'Gedeeltelijk gelijk',higher:'Verborgen waarde is hoger',lower:'Verborgen waarde is lager',wrong:'Anders',notComparable:'Niet vergelijkbaar',selectCategory:'Oefencategorie',question:'Welk Clash-item is verborgen?',phase:'Entity Guesser',guess:'Gok',boardContext:'Categorievergelijkingen · twee optionele hints',type:'Type',move:'Beweging',targets:'Doelen',favorite:'Voorkeur',housing:'Ruimte',attack:'Aanval',role:'Rol',effect:'Effect',affects:'Beïnvloedt',timing:'Timing',source:'Bron',rarity:'Zeldzaamheid',range:'Bereik',special:'Speciaal',merged:'Samengevoegd',state:'Status',function:'Functie',size:'Grootte',count:'Aantal',system:'Systeem',capacity:'Capaciteit'},
de:{daily:'Täglich',practice:'Üben',attempts:'Versuche',score:'Punkte',streak:'Serie',best:'Bestwert',input:'Antworten suchen',chooseAnswer:'Antwort auswählen',availableAnswers:'Antworten verfügbar. Tippen zum Filtern oder Auswählen.',scrollHelp:'Vergleiche seitlich scrollen, um jeden Hinweis zu sehen.',noMatches:'Keine passenden Antworten.',submit:'Tipp abgeben',hint:'Hinweis zeigen',newPractice:'Neue Übungsrunde',share:'Ergebnis teilen',copied:'Ergebnis kopiert',invalid:'Wähle eine gültige Antwort aus dieser Kategorie.',duplicate:'Diese Antwort wurde bereits gewählt.',win:'Richtig!',loss:'Runde beendet',answer:'Die Antwort war',noHint:'Nach weiteren Versuchen wird ein Hinweis freigeschaltet.',hintReady:'Ein Hinweis ist verfügbar.',dailyDone:'Die tägliche Aufgabe ist abgeschlossen.',practiceNote:'Übungsrunden beeinflussen deine tägliche Serie nicht.',dailyNote:'Bis 00:00 UTC erhalten alle dieselbe Kategorie und Antwort.',instructions:'Vergleiche jede Eigenschaft. Pfeile zeigen, ob der versteckte Wert höher oder niedriger ist.',correct:'Genau gleich',close:'Naher Wert',partial:'Teilweise gleich',higher:'Versteckter Wert ist höher',lower:'Versteckter Wert ist niedriger',wrong:'Anders',notComparable:'Nicht vergleichbar',selectCategory:'Übungskategorie',question:'Welches Clash-Element ist verborgen?',phase:'Entity Guesser',guess:'Tipp',boardContext:'Kategorievergleiche · zwei optionale Hinweise',type:'Typ',move:'Bewegung',targets:'Ziele',favorite:'Lieblingsziel',housing:'Wohnraum',attack:'Angriff',role:'Rolle',effect:'Effekt',affects:'Wirkt auf',timing:'Dauer',source:'Quelle',rarity:'Seltenheit',range:'Reichweite',special:'Besonderheit',merged:'Verschmolzen',state:'Status',function:'Funktion',size:'Größe',count:'Anzahl',system:'System',capacity:'Kapazität'},
fr:{daily:'Quotidien',practice:'Entraînement',attempts:'Essais',score:'Score',streak:'Série',best:'Record',input:'Rechercher une réponse',chooseAnswer:'Choisir une réponse',availableAnswers:'réponses disponibles. Saisissez pour filtrer ou touchez une réponse.',scrollHelp:'Faites défiler la comparaison horizontalement pour voir chaque indice.',noMatches:'Aucune réponse correspondante.',submit:'Valider',hint:'Afficher un indice',newPractice:'Nouvelle partie',share:'Partager',copied:'Résultat copié',invalid:'Choisissez une réponse valide dans cette catégorie.',duplicate:'Cette réponse a déjà été proposée.',win:'Correct !',loss:'Partie terminée',answer:'La réponse était',noHint:'Un indice se débloque après plusieurs essais.',hintReady:'Un indice est disponible.',dailyDone:'Le défi du jour est terminé.',practiceNote:'L’entraînement ne modifie pas votre série quotidienne.',dailyNote:'Tout le monde reçoit la même catégorie et la même réponse jusqu’à 00:00 UTC.',instructions:'Comparez chaque propriété. Les flèches indiquent si la valeur cachée est supérieure ou inférieure.',correct:'Identique',close:'Valeur proche',partial:'Correspondance partielle',higher:'La valeur cachée est supérieure',lower:'La valeur cachée est inférieure',wrong:'Différent',notComparable:'Non comparable',selectCategory:'Catégorie d’entraînement',question:'Quel élément Clash est caché ?',phase:'Entity Guesser',guess:'Essai',boardContext:'Comparaisons par catégorie · deux indices optionnels',type:'Type',move:'Mouvement',targets:'Cibles',favorite:'Cible favorite',housing:'Places',attack:'Attaque',role:'Rôle',effect:'Effet',affects:'Affecte',timing:'Durée',source:'Source',rarity:'Rareté',range:'Portée',special:'Spécial',merged:'Fusionné',state:'État',function:'Fonction',size:'Taille',count:'Nombre',system:'Système',capacity:'Capacité'},
es:{daily:'Diario',practice:'Práctica',attempts:'Intentos',score:'Puntos',streak:'Racha',best:'Mejor',input:'Buscar respuestas',chooseAnswer:'Elige una respuesta',availableAnswers:'respuestas disponibles. Escribe para filtrar o toca una.',scrollHelp:'Desliza la comparación para ver todas las pistas.',noMatches:'No hay respuestas coincidentes.',submit:'Enviar intento',hint:'Mostrar pista',newPractice:'Nueva práctica',share:'Compartir',copied:'Resultado copiado',invalid:'Elige una respuesta válida de esta categoría.',duplicate:'Ya elegiste esa respuesta.',win:'¡Correcto!',loss:'Fin de la ronda',answer:'La respuesta era',noHint:'Se desbloqueará una pista después de más intentos.',hintReady:'Hay una pista disponible.',dailyDone:'El reto diario está completado.',practiceNote:'La práctica no afecta tu racha diaria.',dailyNote:'Todos reciben la misma categoría y respuesta hasta las 00:00 UTC.',instructions:'Compara cada propiedad. Las flechas indican si el valor oculto es mayor o menor.',correct:'Coincide',close:'Valor cercano',partial:'Coincidencia parcial',higher:'El valor oculto es mayor',lower:'El valor oculto es menor',wrong:'Diferente',notComparable:'No comparable',selectCategory:'Categoría de práctica',question:'¿Qué elemento de Clash está oculto?',phase:'Entity Guesser',guess:'Intento',boardContext:'Comparaciones por categoría · dos pistas opcionales',type:'Tipo',move:'Movimiento',targets:'Objetivos',favorite:'Objetivo favorito',housing:'Espacio',attack:'Ataque',role:'Rol',effect:'Efecto',affects:'Afecta',timing:'Duración',source:'Fuente',rarity:'Rareza',range:'Alcance',special:'Especial',merged:'Fusionada',state:'Estado',function:'Función',size:'Tamaño',count:'Cantidad',system:'Sistema',capacity:'Capacidad'}};

const CATEGORY_LABELS={en:{defenses:'Defenses',otherBuildings:'Other Buildings',troopsHeroes:'Troops & Heroes',spellsEquipment:'Spells & Equipment'},nl:{defenses:'Verdedigingen',otherBuildings:'Andere gebouwen',troopsHeroes:'Troepen & helden',spellsEquipment:'Spreuken & uitrusting'},de:{defenses:'Verteidigungen',otherBuildings:'Andere Gebäude',troopsHeroes:'Truppen & Helden',spellsEquipment:'Zauber & Ausrüstung'},fr:{defenses:'Défenses',otherBuildings:'Autres bâtiments',troopsHeroes:'Troupes et héros',spellsEquipment:'Sorts et équipements'},es:{defenses:'Defensas',otherBuildings:'Otros edificios',troopsHeroes:'Tropas y héroes',spellsEquipment:'Hechizos y equipamiento'}};
const $=selector=>document.querySelector(selector);
const result=$('[data-result]');
const E={root:$('.game-shell[data-minigame-view="entity"]'),board:$('[data-entity-board]')||$('.game-shell[data-minigame-view="entity"] .game-board'),form:$('[data-guess-form]'),picker:$('[data-answer-picker]'),input:$('[data-guess-input]'),inputLabel:$('[data-guess-input-label]'),suggestions:$('[data-guess-suggestions]'),pickerHelp:$('[data-picker-help]'),message:$('[data-game-message]'),rows:$('[data-guess-rows]'),header:$('[data-guess-header]'),hint:$('[data-hint-button]'),hints:$('[data-hints]'),result,resultImage:$('[data-result-image]')||result?.querySelector('img'),modes:[...document.querySelectorAll('[data-game-mode]')],attempts:$('[data-attempts-value]'),score:$('[data-score-value]'),streak:$('[data-streak-value]'),best:$('[data-best-value]'),newPractice:$('[data-new-practice]'),share:$('[data-share-result]'),modeNote:$('[data-mode-note]'),categoryTitle:$('[data-category-title]'),categorySelect:$('[data-category-select]'),categoryPicker:$('[data-category-picker]'),gameTitle:$('[data-game-title]')};
let state;
let category;
let entities;
let answer;
let comparisonRows=[];
let suggestedEntities=[];
let activeSuggestion=-1;
let selectedSuggestionId='';
let fixtureActive=isRedesignFixtureRequested();

const lang=()=>{const code=document.documentElement.lang?.slice(0,2).toLowerCase();return COPY[code]?code:'en';};
const text=key=>COPY[lang()]?.[key]||COPY.en[key]||key;
const categoryLabel=id=>CATEGORY_LABELS[lang()]?.[id]||CATEGORY_LABELS.en[id]||id;

function load(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing can deny storage. */}}
function saveDailyState(){if(state.mode==='daily'&&!fixtureActive)save(DAILY_STORAGE_KEY,state);}
function announce(){window.dispatchEvent(new CustomEvent('clashpanel:minigame-state-changed',{detail:{game:'entity'}}));}
function practiceCategoryId(id){if(ENTITY_CATEGORIES.some(item=>item.id===id))return id;let saved='';try{saved=localStorage.getItem(PRACTICE_CATEGORY_KEY)||'';}catch{/* Storage is optional. */}return ENTITY_CATEGORIES.some(item=>item.id===saved)?saved:'troopsHeroes';}

function isValidDailyState(saved,dateKey,dailyCategory){
    return Boolean(saved?.mode==='daily'&&saved.dateKey===dateKey&&saved.dataVersion===ENTITY_GUESSER_DATA_VERSION&&saved.categoryId===dailyCategory.id&&typeof saved.answerId==='string'&&Array.isArray(saved.guesses)&&Array.isArray(saved.hints)&&saved.guesses.length<=dailyCategory.maxAttempts&&saved.hints.length<=2&&typeof saved.completed==='boolean'&&typeof saved.won==='boolean');
}

function createState(mode,requested){
    const dateKey=utcDateKey();
    if(mode==='daily'){
        const dailyCategory=getDailyCategory(dateKey);
        const saved=load(DAILY_STORAGE_KEY);
        if(isValidDailyState(saved,dateKey,dailyCategory))return saved;
        return{mode,dateKey,dataVersion:ENTITY_GUESSER_DATA_VERSION,categoryId:dailyCategory.id,answerId:getDailyEntity(dateKey,dailyCategory).id,guesses:[],hints:[],completed:false,won:false,score:0};
    }
    const categoryId=practiceCategoryId(requested);
    if(!fixtureActive){try{localStorage.setItem(PRACTICE_CATEGORY_KEY,categoryId);}catch{/* Storage is optional. */}}
    const selected=getCategory(categoryId);
    return{mode,dateKey,dataVersion:ENTITY_GUESSER_DATA_VERSION,categoryId,answerId:getPracticeEntity(selected).id,guesses:[],hints:[],completed:false,won:false,score:0};
}

function hydrate(next){
    state=next;
    category=getCategory(state.categoryId);
    entities=getEntities(category.id);
    selectedSuggestionId='';
    E.input.value='';
    answer=entities.find(entity=>entity.id===state.answerId);
    if(!answer){state=createState(state.mode,category.id);category=getCategory(state.categoryId);entities=getEntities(category.id);answer=entities.find(entity=>entity.id===state.answerId);}
}

function message(value,type='neutral'){E.message.textContent=value;E.message.dataset.type=type;}

function setImage(image,entity,alt=''){
    if(!image||!entity)return;
    const entityId=entity.id;
    if(image.dataset.entityId===entityId&&image.getAttribute('src'))return;
    image.dataset.entityId=entityId;
    image.alt=alt;
    void getEntityAsset(entity).then(asset=>{
        if(!image.isConnected||image.dataset.entityId!==entityId)return;
        image.src=asset.image;
        installImageFallback(image);
    });
}

function appendImage(parent,entity,className){
    const image=document.createElement('img');
    image.className=className;
    image.alt='';
    image.width=28;
    image.height=28;
    image.loading='lazy';
    image.setAttribute('aria-hidden','true');
    parent.prepend(image);
    setImage(image,entity);
}

function translate(){
    document.querySelectorAll('[data-game-i18n]').forEach(node=>{node.textContent=text(node.dataset.gameI18n);});
    E.input.placeholder=`${text('input')} — ${categoryLabel(category.id)}`;
    E.inputLabel.textContent=text('chooseAnswer');
    E.categoryTitle.textContent=categoryLabel(category.id);
    E.gameTitle.textContent=text('question');
    E.suggestions.setAttribute('aria-label',`${categoryLabel(category.id)} ${text('availableAnswers')}`);
}

function grid(node){
    node.style.gridTemplateColumns=`minmax(8.5rem,1.35fr) repeat(${category.columns.length},minmax(6.6rem,1fr))`;
    node.style.minWidth=`${10+category.columns.length*7.25}rem`;
}

function renderHeader(){
    E.header.replaceChildren();
    grid(E.header);
    const first=document.createElement('div');
    first.textContent=text('guess');
    E.header.append(first);
    category.columns.forEach(column=>{
        const node=document.createElement('div');
        node.textContent=text(column.labelKey);
        E.header.append(node);
    });
}

function cellLabel(cell,column){
    const direction=cell.direction==='higher'?`↑ ${text('higher')}`:cell.direction==='lower'?`↓ ${text('lower')}`:'';
    return`${text(column.labelKey)}: ${cell.displayValue}. ${text(cell.state)}${direction?`. ${direction}`:''}`;
}

function renderRows(){
    E.rows.replaceChildren();
    comparisonRows=[];
    state.guesses.forEach((id,rowIndex)=>{
        const guessed=entities.find(entity=>entity.id===id);
        if(!guessed)return;
        const comparison=compareEntity(guessed,answer,category);
        comparisonRows.push(comparison);
        const row=document.createElement('div');
        row.className='guess-grid guess-grid-row';
        if(rowIndex===state.guesses.length-1)row.classList.add('is-latest');
        grid(row);
        const name=document.createElement('div');
        name.className='guess-cell guess-name';
        name.setAttribute('aria-label',guessed.name);
        const nameText=document.createElement('span');
        nameText.textContent=guessed.name;
        name.append(nameText);
        appendImage(name,guessed,'guess-entity-image');
        row.append(name);
        category.columns.forEach((column,index)=>{
            const cell=comparison[index];
            const node=document.createElement('div');
            node.className=`guess-cell is-${cell.state}`;
            node.dataset.state=cell.state;
            const value=document.createElement('span');
            value.textContent=cell.displayValue;
            node.append(value);
            const glyph=document.createElement('span');
            glyph.className='guess-state-glyph';
            glyph.setAttribute('aria-hidden','true');
            glyph.textContent=cell.state==='correct'?'✓':cell.state==='close'||cell.state==='partial'?'≈':cell.state==='notComparable'?'—':'×';
            node.append(glyph);
            if(cell.direction){const arrow=document.createElement('b');arrow.textContent=cell.direction==='higher'?'↑':'↓';arrow.setAttribute('aria-hidden','true');node.append(arrow);}
            node.title=cellLabel(cell,column);
            node.setAttribute('aria-label',cellLabel(cell,column));
            row.append(node);
        });
        E.rows.append(row);
    });
}

function renderHints(){
    E.hints.replaceChildren();
    state.hints.forEach(value=>{const item=document.createElement('li');item.textContent=value;E.hints.append(item);});
    const available=availableHintCount(state.guesses.length,state.hints.length,category.maxAttempts);
    E.hint.disabled=state.completed||available===0;
    E.hint.hidden=state.completed;
    if(!state.completed)message(available>0?text('hintReady'):text('noHint'));
}

function renderResult(){
    E.result.hidden=!state.completed;
    E.share.hidden=!state.completed||state.mode!=='daily';
    E.result.classList.toggle('is-visible',state.completed);
    if(!state.completed){if(E.resultImage){E.resultImage.removeAttribute('src');delete E.resultImage.dataset.entityId;E.resultImage.alt='';}return;}
    E.result.querySelector('[data-result-heading]').textContent=state.won?text('win'):text('loss');
    E.result.querySelector('[data-result-body]').textContent=`${text('answer')}: ${answer.name}.`;
    setImage(E.resultImage,answer,answer.name);
    message(state.mode==='daily'?text('dailyDone'):text('practiceNote'),state.won?'success':'warning');
}

function renderCategory(){
    E.categorySelect.replaceChildren();
    ENTITY_CATEGORIES.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=categoryLabel(item.id);E.categorySelect.append(option);});
    E.categorySelect.value=category.id;
    E.categorySelect.disabled=state.mode==='daily';
    E.categoryPicker.hidden=state.mode==='daily';
}

function setPickerOpen(open){
    const next=Boolean(open&&!state.completed);
    E.suggestions.hidden=!next;
    E.input.setAttribute('aria-expanded',String(next));
    if(!next){activeSuggestion=-1;E.input.removeAttribute('aria-activedescendant');}
}

function chooseSuggestion(entity){
    if(!entity)return;
    selectedSuggestionId=entity.id;
    E.input.value=entity.name;
    setPickerOpen(false);
    message('');
}

function suggestions(open=true,query=E.input.value){
    E.suggestions.replaceChildren();
    suggestedEntities=searchEntities(query,entities,entities.length);
    activeSuggestion=-1;
    E.input.removeAttribute('aria-activedescendant');
    E.pickerHelp.textContent=`${entities.length} ${text('availableAnswers')}`;
    if(!suggestedEntities.length){
        const empty=document.createElement('div');
        empty.className='entity-suggestions-empty';
        empty.setAttribute('role','option');
        empty.setAttribute('aria-disabled','true');
        empty.textContent=text('noMatches');
        E.suggestions.append(empty);
    }else suggestedEntities.forEach((entity,index)=>{
        const option=document.createElement('button');
        option.type='button';
        option.tabIndex=-1;
        option.id=`entity-suggestion-${entity.id}`;
        option.className='entity-suggestion';
        option.setAttribute('role','option');
        option.setAttribute('aria-selected','false');
        option.dataset.entityId=entity.id;
        const label=document.createElement('span');
        label.textContent=entity.name;
        option.append(label);
        appendImage(option,entity,'suggestion-entity-image');
        option.addEventListener('pointerdown',event=>event.preventDefault());
        option.addEventListener('click',()=>chooseSuggestion(entity));
        E.suggestions.append(option);
    });
    setPickerOpen(open);
}

function reopenSuggestions(){
    const selected=entities.find(entity=>entity.id===selectedSuggestionId&&entity.name===E.input.value);
    if(selected){E.input.select();suggestions(true,'');return;}
    suggestions(true);
}

function moveSuggestion(direction){
    if(E.suggestions.hidden)suggestions(true,selectedSuggestionId?'':E.input.value);
    if(!suggestedEntities.length)return;
    activeSuggestion=(activeSuggestion+direction+suggestedEntities.length)%suggestedEntities.length;
    const options=[...E.suggestions.querySelectorAll('.entity-suggestion')];
    options.forEach((option,index)=>{const active=index===activeSuggestion;option.classList.toggle('is-active',active);option.setAttribute('aria-selected',String(active));});
    const active=options[activeSuggestion];
    E.input.setAttribute('aria-activedescendant',active.id);
    active.scrollIntoView({block:'nearest'});
}

function render(){
    translate();
    E.modes.forEach(button=>{const active=button.dataset.gameMode===state.mode;button.classList.toggle('is-active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    E.newPractice.hidden=state.mode!=='practice';
    renderCategory();
    renderHeader();
    renderRows();
    renderHints();
    renderResult();
    const stats=load(STATS_STORAGE_KEY,{currentStreak:0,bestStreak:0});
    E.attempts.textContent=`${state.guesses.length}/${category.maxAttempts}`;
    E.score.textContent=String(state.score||0);
    E.streak.textContent=String(stats?.currentStreak||0);
    E.best.textContent=String(stats?.bestStreak||0);
    E.modeNote.textContent=state.mode==='daily'?text('dailyNote'):text('practiceNote');
    E.input.disabled=state.completed;
    E.form.querySelector('button[type="submit"]').disabled=state.completed;
    E.board.dataset.state=state.completed?(state.won?'won':'lost'):state.guesses.length?'in-progress':'fresh';
    if(E.root.hidden){E.suggestions.replaceChildren();E.suggestions.hidden=true;}
    else suggestions(false);
}

function complete(won){
    state.completed=true;
    state.won=won;
    state.score=calculateScore(state.guesses.length,state.hints.length,won,category.maxAttempts);
    if(state.mode==='daily'&&!fixtureActive){save(STATS_STORAGE_KEY,updateStreak(load(STATS_STORAGE_KEY,{}),state.dateKey,won,category.id));}
    saveDailyState();
    announce();
}

function submit(event){
    event.preventDefault();
    if(state.completed)return;
    const guess=findEntity(E.input.value,entities);
    if(!guess){selectedSuggestionId='';message(text('invalid'),'error');suggestions(true);E.input.focus();return;}
    if(state.guesses.includes(guess.id)){message(text('duplicate'),'error');return;}
    selectedSuggestionId='';
    setPickerOpen(false);
    state.guesses.push(guess.id);
    E.input.value='';
    if(isWinningGuess(guess,answer))complete(true);
    else if(state.guesses.length>=category.maxAttempts)complete(false);
    saveDailyState();
    render();
}

function setMode(mode,categoryId=state?.categoryId){
    E.modes.forEach(button=>{button.tabIndex=button.dataset.gameMode===mode?0:-1;});
    hydrate(createState(mode,categoryId));
    render();
    E.input.focus();
}

function revealHint(){
    if(availableHintCount(state.guesses.length,state.hints.length,category.maxAttempts)<=0||state.completed)return;
    state.hints.push(buildHint(answer,category,state.hints.length+1));
    saveDailyState();
    announce();
    render();
}

async function share(){
    const result=state.won?`${state.guesses.length}/${category.maxAttempts}`:`X/${category.maxAttempts}`;
    const value=[`ClashPanel Daily Entity Guesser · ${category.shortLabel}`,`${state.dateKey} · ${result} · ${state.score} points`,...resultSquares(comparisonRows),`Streak: ${load(STATS_STORAGE_KEY,{})?.currentStreak||0}`,'https://clashpanel.com/minigames'].join('\n');
    try{
        if(navigator.share)await navigator.share({text:value});
        else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
        message(text('copied'),'success');
    }catch(error){if(error?.name!=='AbortError')message(value);}
}

function handleFixture(fixture){
    if(!isLocalFixtureHost()||fixture?.module!=='minigames'||!fixture.id?.startsWith('entity-'))return;
    const fixtureState=getEntityGameFixture(fixture.id,utcDateKey());
    if(!fixtureState)return;
    fixtureActive=true;
    hydrate(fixtureState);
    render();
}

E.form.addEventListener('submit',submit);
E.input.addEventListener('focus',reopenSuggestions);
E.input.addEventListener('click',reopenSuggestions);
E.input.addEventListener('input',()=>{selectedSuggestionId='';suggestions(true);});
E.input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();moveSuggestion(event.key==='ArrowDown'?1:-1);}
    else if(event.key==='Enter'&&!E.suggestions.hidden&&activeSuggestion>=0){event.preventDefault();chooseSuggestion(suggestedEntities[activeSuggestion]);}
    else if(event.key==='Escape'){event.preventDefault();setPickerOpen(false);}
});
document.addEventListener('pointerdown',event=>{if(!E.picker.contains(event.target))setPickerOpen(false);});
E.hint.addEventListener('click',revealHint);
E.newPractice.addEventListener('click',()=>setMode('practice'));
E.share.addEventListener('click',share);
E.categorySelect.addEventListener('change',()=>setMode('practice',E.categorySelect.value));
E.modes.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.gameMode)));
window.addEventListener('clashpanel:fixture-ready',event=>handleFixture(event.detail));
window.addEventListener('clashpanel:minigame-selected',event=>{if(event.detail?.game==='entity')render();});
window.addEventListener('clashtools:language-changed',render);

getRedesignFixture().then(handleFixture).catch(()=>{});
hydrate(createState(new URLSearchParams(location.search).get('mode')==='practice'?'practice':'daily'));
render();
