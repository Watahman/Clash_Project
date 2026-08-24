import { buildFamilyLocaleMaps } from '../achievement-family-locale-utils.js';

const families = {
    BB_HALL: {
        title: { en: 'Builder Hall Pioneer', nl: 'Pionier van de Bouwershal', fr: 'Pionnier de la maison des ouvriers', de: 'Pionier der Bauarbeiterbasis', es: 'Pionero del Taller del Constructor' },
        description: { en: 'Reach Builder Hall milestones.', nl: 'Bereik mijlpalen voor de Bouwershal.', fr: 'Atteignez les paliers de la maison des ouvriers.', de: 'Erreiche Meilensteine der Bauarbeiterbasis.', es: 'Alcanza hitos del Taller del Constructor.' }
    },
    BB_TROPHIES: {
        title: { en: 'Builder Climber', nl: 'Bouwersklimmer', fr: 'Grimpeur des ouvriers', de: 'Kletterer der Bauarbeiterbasis', es: 'Escalador del Taller' },
        description: { en: 'Reach current Builder Base trophy milestones.', nl: 'Bereik de huidige trofeemijlpalen van de Bouwersbasis.', fr: 'Atteignez les paliers de trophées actuels de la base des ouvriers.', de: 'Erreiche die aktuellen Trophäenmeilensteine der Bauarbeiterbasis.', es: 'Alcanza los hitos actuales de trofeos de la Base del Constructor.' }
    },
    BB_BEST: {
        title: { en: 'Builder Peak', nl: 'Bouwerspiek', fr: 'Sommet des ouvriers', de: 'Bauarbeiter-Bestmarke', es: 'Cima del Constructor' },
        description: { en: 'Reach your all-time Builder Base trophy best.', nl: 'Bereik je beste trofeeënaantal ooit in de Bouwersbasis.', fr: 'Atteignez votre meilleur total de trophées historique dans la base des ouvriers.', de: 'Erreiche deinen bisherigen Trophäenrekord in der Bauarbeiterbasis.', es: 'Alcanza tu mejor marca histórica de trofeos de la Base del Constructor.' }
    },
    BB_HERO_SUM: {
        title: { en: 'Machine Master', nl: 'Machinemeester', fr: 'Maître des machines', de: 'Maschinenmeister', es: 'Maestro de las máquinas' },
        description: { en: 'Reach cumulative Builder Base hero levels.', nl: 'Bereik een cumulatief aantal heldenniveaus in de Bouwersbasis.', fr: 'Atteignez un total cumulé de niveaux de héros dans la base des ouvriers.', de: 'Erreiche eine kumulierte Anzahl an Heldenstufen in der Bauarbeiterbasis.', es: 'Alcanza niveles de héroe acumulados en la Base del Constructor.' }
    },
    BB_TROOP_MAX: {
        title: { en: 'Builder Army Expert', nl: 'Legerexpert van de Bouwersbasis', fr: 'Expert de l’armée des ouvriers', de: 'Armeeexperte der Bauarbeiterbasis', es: 'Experto del ejército del Constructor' },
        description: { en: 'Max a tiered number of Builder Base troops (3, 6, 9 or 12) for the current Builder Hall.', nl: 'Maximaliseer een aantal Bouwersbasis-troepen volgens de mijlpalen (3, 6, 9 of 12) voor je huidige Bouwershal.', fr: 'Maxez un nombre progressif de troupes (3, 6, 9 ou 12) pour votre maison des ouvriers actuelle.', de: 'Maximiere je nach Meilenstein 3, 6, 9 oder 12 Truppen für deine aktuelle Bauarbeiterbasis.', es: 'Maximiza una cantidad escalonada de tropas (3, 6, 9 o 12) para tu Taller actual.' }
    },
    BB_ALL_TROOPS_MAX: {
        title: { en: 'Complete Builder Army', nl: 'Volledig bouwersleger', fr: 'Armée des ouvriers complète', de: 'Vollständige Bauarbeiterarmee', es: 'Ejército completo del Constructor' },
        description: { en: 'Max every Builder Base troop eligible for the current Builder Hall.', nl: 'Maximaliseer elke troep die voor je huidige Bouwershal in aanmerking komt.', fr: 'Maxez toutes les troupes disponibles pour votre maison des ouvriers actuelle.', de: 'Maximiere jede für deine aktuelle Bauarbeiterbasis verfügbare Truppe.', es: 'Maximiza todas las tropas disponibles para tu Taller actual.' }
    },
    BB_ALL_HEROES_MAX: {
        title: { en: 'Builder Hero Complete', nl: 'Bouwersheld compleet', fr: 'Héros des ouvriers au maximum', de: 'Bauarbeiterhelden komplett', es: 'Héroes completos del Constructor' },
        description: { en: 'Max all Builder Base heroes eligible for the current Builder Hall.', nl: 'Maximaliseer alle helden die voor je huidige Bouwershal in aanmerking komen.', fr: 'Maxez tous les héros disponibles pour votre maison des ouvriers actuelle.', de: 'Maximiere alle für deine aktuelle Bauarbeiterbasis verfügbaren Helden.', es: 'Maximiza todos los héroes disponibles para tu Taller actual.' }
    },
    BB_GAIN_7D: {
        title: { en: 'Builder Rush', nl: 'Bouwerssprint', fr: 'Ruée des ouvriers', de: 'Bauarbeiter-Sprint', es: 'Sprint del Constructor' },
        description: { en: 'Gain Builder Base trophies across seven rolling days.', nl: 'Verdien Bouwersbasistrofeeën over zeven opeenvolgende dagen.', fr: 'Gagnez des trophées de la base des ouvriers sur sept jours glissants.', de: 'Sammle über sieben rollierende Tage Trophäen der Bauarbeiterbasis.', es: 'Consigue trofeos de la Base del Constructor durante siete días consecutivos.' }
    },
    BB_NEW_BEST: {
        title: { en: 'Builder Record', nl: 'Bouwersrecord', fr: 'Record des ouvriers', de: 'Bauarbeiterrekord', es: 'Récord del Constructor' },
        description: { en: 'Set a new tracked Builder Base trophy best.', nl: 'Vestig een nieuw gevolgd trofeeënrecord in de Bouwersbasis.', fr: 'Établissez un nouveau record de trophées suivi dans la base des ouvriers.', de: 'Setze einen neuen aufgezeichneten Trophäenrekord in der Bauarbeiterbasis.', es: 'Establece un nuevo récord de trofeos registrado en la Base del Constructor.' }
    },
    BB_GLOBAL_RANK: {
        title: { en: 'Builder World Ranked', nl: 'Wereldranglijst bouwersbasis', fr: 'Classement mondial des ouvriers', de: 'Weltrangliste der Bauarbeiterbasis', es: 'Clasificación mundial del Constructor' },
        description: { en: 'Reach a global Builder Base ranking.', nl: 'Bereik een wereldrangschikking in de Bouwersbasis.', fr: 'Atteignez un classement mondial dans la base des ouvriers.', de: 'Erreiche eine weltweite Platzierung der Bauarbeiterbasis.', es: 'Alcanza una posición mundial en la Base del Constructor.' }
    },
    BB_PROGRESS_PCT: {
        title: { en: 'Builder Offense Completion', nl: 'Aanval van de bouwersbasis voltooid', fr: 'Offensive des ouvriers terminée', de: 'Offensive der Bauarbeiterbasis abgeschlossen', es: 'Ofensiva del Constructor completada' },
        description: { en: 'Reach Builder Base offense completion milestones shown in your imported progress.', nl: 'Bereik mijlpalen voor de voltooiing van je Bouwersbasisaanval in je geïmporteerde voortgang.', fr: 'Atteignez les paliers de progression offensive de la base des ouvriers dans vos données importées.', de: 'Erreiche Meilensteine für den Offensivfortschritt der Bauarbeiterbasis in deinem Import.', es: 'Alcanza hitos de progreso ofensivo de la Base del Constructor en tus datos importados.' }
    }
};

export const builderBaseAchievementLocales = buildFamilyLocaleMaps(families);
