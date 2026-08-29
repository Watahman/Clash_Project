import { getLanguage } from '../i18n/i18n.js?v=20260829-public-auth-v1';

const copy = Object.freeze({
    en: Object.freeze({
        kicker: 'Compete · Brackets',
        title: 'Build the bracket. Follow every winner.',
        lead: 'Create a seeded or shuffled knockout bracket in your workspace, choose winners match by match, and carry the path to a champion.',
        primary: 'Open bracket editor',
        secondary: 'Sign in to continue',
        note: 'Runs locally in your workspace. Export JSON when you need a portable copy.',
        signalSeeded: 'Seeded order',
        signalShuffle: 'Shuffle opening round',
        signalByes: 'Automatic BYEs',
        signalProgression: 'Winner progression',
        signalJson: 'JSON import & export',
        workflowKicker: 'A clear tournament flow',
        workflowTitle: 'From roster to champion, one decision at a time.',
        workflowIntro: 'The editor keeps setup compact and gives every round enough room to stay readable. Choose a participant, then move forward when the next match is ready.',
        workflowCaption: 'Example bracket preview · no production data',
        step1Title: 'Add participants',
        step1Desc: 'Enter 4–128 unique player or clan names, one per line.',
        step2Title: 'Seed or shuffle',
        step2Desc: 'Keep an existing order or create a neutral opening draw.',
        step3Title: 'Advance winners',
        step3Desc: 'Pick a winner in each match and let the next round update automatically.',
        seedTitle: 'Start with the right opening round.',
        seedCopy: 'Use supplied order when your event already has seeds. Shuffle when the draw should be neutral. BYEs are placed and advanced for you.',
        seedLabel: 'Seeded or shuffled',
        seedValue: 'Opening round ready',
        changeTitle: 'Change a winner without rebuilding.',
        changeCopy: 'If a result changes, the affected path is cleared and the bracket stays honest. The final card only carries a champion when every decision is complete.',
        changeLabel: 'Winner change',
        changeValue: 'Path updated',
        ctaKicker: 'Ready to run the bracket?',
        ctaTitle: 'Open the editor in your workspace.',
        ctaCopy: 'Brackets are a local workspace tool with browser restore and JSON export. Cloud saves and spectator links are not part of this release.',
        ctaButton: 'Open bracket editor',
        preview: 'Example bracket preview',
        metaTitle: 'Clash of Clans Bracket Generator | ClashPanel',
        metaDescription: 'Create seeded or shuffled Clash of Clans knockout brackets, advance winners, handle BYEs, and export a local JSON bracket from ClashPanel.'
    }),
    nl: Object.freeze({
        kicker: 'Compete · Brackets', title: 'Bouw de bracket. Volg elke winnaar.',
        lead: 'Maak in je workspace een seeded of willekeurige knock-outbracket, kies winnaars per match en volg het pad naar de kampioen.',
        primary: 'Bracketeditor openen', secondary: 'Inloggen om door te gaan',
        note: 'Draait lokaal in je workspace. Exporteer JSON wanneer je een draagbare kopie nodig hebt.',
        signalSeeded: 'Volgorde behouden', signalShuffle: 'Openingsronde shuffelen', signalByes: 'Automatische BYEs', signalProgression: 'Winnaars gaan door', signalJson: 'JSON import & export',
        workflowKicker: 'Een duidelijke toernooiflow', workflowTitle: 'Van roster naar kampioen, één beslissing per keer.', workflowIntro: 'De editor houdt de setup compact en geeft elke ronde genoeg ruimte om leesbaar te blijven. Kies een deelnemer en ga verder zodra de volgende match klaar is.', workflowCaption: 'Voorbeeldbracket · geen productiedata', step1Title: 'Deelnemers toevoegen', step1Desc: 'Voer 4–128 unieke spelers of clans in, één per regel.', step2Title: 'Seeden of shuffelen', step2Desc: 'Behoud een bestaande volgorde of maak een neutrale openingsloting.', step3Title: 'Winnaars laten doorgaan', step3Desc: 'Kies per match een winnaar en werk de volgende ronde automatisch bij.', seedTitle: 'Begin met de juiste openingsronde.', seedCopy: 'Gebruik de ingevoerde volgorde voor bestaande seeds. Shuffle wanneer de loting neutraal moet zijn. BYEs worden automatisch geplaatst en verwerkt.', seedLabel: 'Seeded of geshuffled', seedValue: 'Openingsronde klaar', changeTitle: 'Wijzig een winnaar zonder opnieuw te bouwen.', changeCopy: 'Bij een gewijzigde uitslag wordt het getroffen pad leeggemaakt. De finale toont alleen een kampioen wanneer alle beslissingen klaar zijn.', changeLabel: 'Winnaar wijzigen', changeValue: 'Pad bijgewerkt', ctaKicker: 'Klaar om de bracket te draaien?', ctaTitle: 'Open de editor in je workspace.', ctaCopy: 'Brackets zijn een lokale workspace-tool met browserherstel en JSON-export. Cloud saves en spectatorlinks maken geen deel uit van deze release.', ctaButton: 'Bracketeditor openen', preview: 'Voorbeeld van bracket', metaTitle: 'Clash of Clans-bracketgenerator | ClashPanel', metaDescription: 'Maak seeded of willekeurige Clash of Clans-knock-outbrackets, verwerk BYEs, laat winnaars doorgaan en exporteer een lokale JSON-bracket vanuit ClashPanel.'
    }),
    fr: Object.freeze({
        kicker: 'Compete · Brackets', title: 'Construisez le bracket. Suivez chaque vainqueur.',
        lead: 'Créez un bracket à élimination directe dans votre espace de travail, choisissez les vainqueurs match après match et suivez le chemin vers le champion.', primary: 'Ouvrir l’éditeur de bracket', secondary: 'Se connecter pour continuer', note: 'Fonctionne localement dans votre espace. Exportez le JSON pour conserver une copie portable.', signalSeeded: 'Ordre des seeds', signalShuffle: 'Mélanger le premier tour', signalByes: 'BYEs automatiques', signalProgression: 'Progression des vainqueurs', signalJson: 'Import et export JSON', workflowKicker: 'Un tournoi lisible', workflowTitle: 'Du roster au champion, une décision à la fois.', workflowIntro: 'L’éditeur garde la configuration compacte et laisse à chaque tour assez d’espace pour rester lisible. Choisissez un participant, puis avancez quand le match suivant est prêt.', workflowCaption: 'Aperçu d’un bracket · aucune donnée de production', step1Title: 'Ajouter les participants', step1Desc: 'Saisissez 4–128 joueurs ou clans uniques, un par ligne.', step2Title: 'Seder ou mélanger', step2Desc: 'Conservez un ordre existant ou créez un tirage neutre.', step3Title: 'Faire avancer les vainqueurs', step3Desc: 'Choisissez le vainqueur de chaque match et mettez à jour le tour suivant automatiquement.', seedTitle: 'Commencez par un premier tour cohérent.', seedCopy: 'Utilisez l’ordre fourni lorsque votre événement possède déjà des seeds. Mélangez pour un tirage neutre. Les BYEs sont placés et avancent automatiquement.', seedLabel: 'Seed ou mélange', seedValue: 'Premier tour prêt', changeTitle: 'Changez un vainqueur sans reconstruire.', changeCopy: 'Si un résultat change, le chemin concerné est vidé et le bracket reste cohérent. La finale n’affiche un champion que lorsque chaque décision est terminée.', changeLabel: 'Changement de vainqueur', changeValue: 'Chemin mis à jour', ctaKicker: 'Prêt à lancer le bracket ?', ctaTitle: 'Ouvrez l’éditeur dans votre espace.', ctaCopy: 'Les brackets sont un outil local avec restauration navigateur et export JSON. Les sauvegardes cloud et liens spectateurs ne font pas partie de cette version.', ctaButton: 'Ouvrir l’éditeur', preview: 'Aperçu d’un bracket', metaTitle: 'Générateur de bracket Clash of Clans | ClashPanel', metaDescription: 'Créez des brackets Clash of Clans ordonnés ou mélangés, gérez les BYEs, faites progresser les vainqueurs et exportez un JSON local avec ClashPanel.'
    }),
    de: Object.freeze({
        kicker: 'Compete · Turnierbäume', title: 'Erstelle den Turnierbaum. Folge jedem Sieger.',
        lead: 'Erstelle in deinem Workspace einen gesetzten oder gemischten K.-o.-Turnierbaum, wähle Match-Sieger und verfolge den Weg zum Champion.', primary: 'Turnierbaum öffnen', secondary: 'Anmelden und fortfahren', note: 'Läuft lokal in deinem Workspace. Exportiere JSON für eine portable Kopie.', signalSeeded: 'Gesetzte Reihenfolge', signalShuffle: 'Eröffnungsrunde mischen', signalByes: 'Automatische Freilose', signalProgression: 'Siegerfortschritt', signalJson: 'JSON-Import und -Export', workflowKicker: 'Ein klarer Turnierablauf', workflowTitle: 'Vom Roster zum Champion, eine Entscheidung nach der anderen.', workflowIntro: 'Die Einrichtung bleibt kompakt und jede Runde erhält genug Platz. Wähle einen Teilnehmer und gehe weiter, sobald das nächste Match bereit ist.', workflowCaption: 'Beispiel-Turnierbaum · keine Produktionsdaten', step1Title: 'Teilnehmer hinzufügen', step1Desc: 'Gib 4–128 eindeutige Spieler oder Clans ein, einen pro Zeile.', step2Title: 'Setzen oder mischen', step2Desc: 'Behalte eine vorhandene Reihenfolge oder erstelle eine neutrale Auslosung.', step3Title: 'Sieger weiterführen', step3Desc: 'Wähle pro Match einen Sieger und aktualisiere die nächste Runde automatisch.', seedTitle: 'Mit einer klaren Eröffnungsrunde beginnen.', seedCopy: 'Verwende die Eingabereihenfolge für vorhandene Seeds. Mische für eine neutrale Auslosung. Freilose werden automatisch platziert und weitergeführt.', seedLabel: 'Gesetzt oder gemischt', seedValue: 'Eröffnungsrunde bereit', changeTitle: 'Sieger ändern, ohne neu aufzubauen.', changeCopy: 'Wenn sich ein Ergebnis ändert, wird der betroffene Pfad geleert. Der letzte Match zeigt erst nach allen Entscheidungen einen Champion.', changeLabel: 'Sieger ändern', changeValue: 'Pfad aktualisiert', ctaKicker: 'Bereit für den Turnierbaum?', ctaTitle: 'Öffne den Editor in deinem Workspace.', ctaCopy: 'Turnierbäume sind ein lokales Workspace-Tool mit Browser-Wiederherstellung und JSON-Export. Cloud-Speicher und Zuschauerlinks gehören nicht zu dieser Version.', ctaButton: 'Turnierbaum öffnen', preview: 'Beispiel-Turnierbaum', metaTitle: 'Clash-of-Clans-Turnierbaumgenerator | ClashPanel', metaDescription: 'Erstelle gesetzte oder gemischte Clash-of-Clans-Turnierbäume, verwalte Freilose, führe Sieger weiter und exportiere einen lokalen JSON-Turnierbaum.'
    }),
    es: Object.freeze({
        kicker: 'Compete · Cuadros', title: 'Crea el cuadro. Sigue a cada ganador.',
        lead: 'Crea en tu espacio un cuadro eliminatorio ordenado o mezclado, elige ganadores partida a partida y sigue el camino hasta el campeón.', primary: 'Abrir editor de cuadros', secondary: 'Inicia sesión para continuar', note: 'Funciona localmente en tu espacio. Exporta JSON cuando necesites una copia portable.', signalSeeded: 'Orden de seeds', signalShuffle: 'Mezclar ronda inicial', signalByes: 'BYEs automáticos', signalProgression: 'Progresión de ganadores', signalJson: 'Importar y exportar JSON', workflowKicker: 'Un flujo de torneo claro', workflowTitle: 'Del roster al campeón, una decisión cada vez.', workflowIntro: 'El editor mantiene la configuración compacta y deja espacio suficiente para cada ronda. Elige un participante y avanza cuando la siguiente partida esté lista.', workflowCaption: 'Vista previa de ejemplo · sin datos de producción', step1Title: 'Añadir participantes', step1Desc: 'Introduce 4–128 jugadores o clanes únicos, uno por línea.', step2Title: 'Ordenar o mezclar', step2Desc: 'Conserva un orden existente o crea un sorteo neutral.', step3Title: 'Avanzar ganadores', step3Desc: 'Elige un ganador por partida y actualiza la siguiente ronda automáticamente.', seedTitle: 'Empieza con una ronda inicial clara.', seedCopy: 'Usa el orden introducido cuando ya existan seeds. Mezcla cuando el sorteo deba ser neutral. Los BYEs se colocan y avanzan automáticamente.', seedLabel: 'Ordenado o mezclado', seedValue: 'Ronda inicial lista', changeTitle: 'Cambia un ganador sin reconstruir.', changeCopy: 'Si cambia un resultado, se limpia el camino afectado y el cuadro sigue siendo coherente. La final solo muestra un campeón cuando todas las decisiones están completas.', changeLabel: 'Cambio de ganador', changeValue: 'Camino actualizado', ctaKicker: '¿Listo para ejecutar el cuadro?', ctaTitle: 'Abre el editor en tu espacio.', ctaCopy: 'Los cuadros son una herramienta local con restauración del navegador y exportación JSON. Los guardados en la nube y los enlaces de espectadores no forman parte de esta versión.', ctaButton: 'Abrir editor', preview: 'Vista previa de cuadro', metaTitle: 'Generador de cuadros de Clash of Clans | ClashPanel', metaDescription: 'Crea cuadros eliminatorios de Clash of Clans ordenados o mezclados, gestiona BYEs, avanza ganadores y exporta un JSON local desde ClashPanel.'
    })
});

function currentCopy() {
    return copy[getLanguage()] || copy.en;
}

function renderCopy() {
    const value = currentCopy();
    document.querySelectorAll('[data-bracket-copy]').forEach(element => {
        const key = element.dataset.bracketCopy;
        if (value[key]) element.textContent = value[key];
    });
    document.title = value.metaTitle;
    ['description', 'og:description', 'twitter:description'].forEach(name => {
        document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
            ?.setAttribute('content', value.metaDescription);
    });
    ['og:title', 'twitter:title'].forEach(name => {
        document.querySelector(`meta[property="${name}"]`)?.setAttribute('content', value.metaTitle);
    });
}

function init() {
    renderCopy();
    window.addEventListener('clashtools:language-changed', renderCopy);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
