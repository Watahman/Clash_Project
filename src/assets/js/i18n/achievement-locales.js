import nl from './achievement-locales/nl.js';
import en from './achievement-locales/en.js';
import fr from './achievement-locales/fr.js';
import de from './achievement-locales/de.js';
import es from './achievement-locales/es.js';
import { achievementBattleLocales } from './achievement-battle-locales.js';
import { achievementExpandedLocales } from './achievement-expanded-locales.js';

const v2UiLocales = Object.freeze({
    en: {
        'achievements.uncommon': 'Uncommon',
        'achievements.mythic': 'Mythic',
        'achievements.waitingForData': 'Waiting for data',
        'achievements.lastKnown': 'Last known',
        'achievements.source.raid_history': 'Raid history',
        'achievements.source.legend_history': 'Legend / Ranked history',
        'achievements.source.clashking_history': 'ClashKing history',
        'achievements.source.clan_profile': 'Clan profile'
    },
    nl: {
        'achievements.uncommon': 'Ongewoon',
        'achievements.mythic': 'Mythisch',
        'achievements.waitingForData': 'Wacht op data',
        'achievements.lastKnown': 'Laatst bekend',
        'achievements.source.raid_history': 'Raidgeschiedenis',
        'achievements.source.legend_history': 'Legend / Ranked-geschiedenis',
        'achievements.source.clashking_history': 'ClashKing-geschiedenis',
        'achievements.source.clan_profile': 'Clanprofiel'
    },
    fr: {
        'achievements.uncommon': 'Peu commun',
        'achievements.mythic': 'Mythique',
        'achievements.waitingForData': 'En attente de données',
        'achievements.lastKnown': 'Dernière valeur',
        'achievements.source.raid_history': 'Historique des raids',
        'achievements.source.legend_history': 'Historique Legend / Ranked',
        'achievements.source.clashking_history': 'Historique ClashKing',
        'achievements.source.clan_profile': 'Profil du clan'
    },
    de: {
        'achievements.uncommon': 'Ungewöhnlich',
        'achievements.mythic': 'Mythisch',
        'achievements.waitingForData': 'Warten auf Daten',
        'achievements.lastKnown': 'Zuletzt bekannt',
        'achievements.source.raid_history': 'Raid-Verlauf',
        'achievements.source.legend_history': 'Legend-/Ranked-Verlauf',
        'achievements.source.clashking_history': 'ClashKing-Verlauf',
        'achievements.source.clan_profile': 'Clanprofil'
    },
    es: {
        'achievements.uncommon': 'Poco común',
        'achievements.mythic': 'Mítico',
        'achievements.waitingForData': 'Esperando datos',
        'achievements.lastKnown': 'Último valor',
        'achievements.source.raid_history': 'Historial de asaltos',
        'achievements.source.legend_history': 'Historial Legend / Ranked',
        'achievements.source.clashking_history': 'Historial de ClashKing',
        'achievements.source.clan_profile': 'Perfil del clan'
    }
});

function withExpandedCopy(language, base) {
    return Object.freeze({
        ...base,
        ...(achievementBattleLocales[language] || achievementBattleLocales.en),
        ...(achievementExpandedLocales[language] || achievementExpandedLocales.en),
        ...(v2UiLocales[language] || v2UiLocales.en)
    });
}

export const achievementLocales = Object.freeze({
    nl: withExpandedCopy('nl', nl),
    en: withExpandedCopy('en', en),
    fr: withExpandedCopy('fr', fr),
    de: withExpandedCopy('de', de),
    es: withExpandedCopy('es', es)
});
