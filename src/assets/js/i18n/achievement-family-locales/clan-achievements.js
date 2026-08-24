import { buildFamilyLocaleMaps } from '../achievement-family-locale-utils.js';

const families = {
    CL_LEVEL: {
        title: { en: 'Clan Legacy', nl: 'Clanerfenis', fr: 'Héritage du clan', de: 'Clan-Vermächtnis', es: 'Legado del clan' },
        description: { en: 'Reach clan-level milestones.', nl: 'Bereik mijlpalen voor het clanniveau.', fr: 'Atteignez des paliers de niveau de clan.', de: 'Erreiche Meilensteine der Clanstufe.', es: 'Alcanza hitos de nivel del clan.' }
    },
    CL_MEMBERS: {
        title: { en: 'Full House', nl: 'Vol huis', fr: 'Clan au complet', de: 'Volles Haus', es: 'Casa llena' },
        description: { en: 'Reach member-count milestones.', nl: 'Bereik mijlpalen voor het aantal clanleden.', fr: 'Atteignez des paliers du nombre de membres.', de: 'Erreiche Meilensteine bei der Mitgliederzahl.', es: 'Alcanza hitos de cantidad de miembros.' }
    },
    CL_WAR_WINS: {
        title: { en: 'War Dynasty', nl: 'Wardynastie', fr: 'Dynastie de guerre', de: 'Kriegsdynastie', es: 'Dinastía bélica' },
        description: { en: 'Accumulate regular-war wins.', nl: 'Verzamel overwinningen in gewone clanwars.', fr: 'Accumulez des victoires en guerres classiques.', de: 'Sammle Siege in normalen Clankriegen.', es: 'Acumula victorias en guerras normales.' }
    },
    CL_WIN_STREAK: {
        title: { en: 'Winning Streak', nl: 'Winstreeks', fr: 'Série de victoires', de: 'Siegesserie', es: 'Racha de victorias' },
        description: { en: 'Reach the current official regular-war win streak.', nl: 'Evenaar de huidige officiële winstreeks in gewone clanwars.', fr: 'Atteignez la série officielle actuelle de victoires en guerres classiques.', de: 'Erreiche die aktuelle offizielle Siegesserie normaler Clankriege.', es: 'Alcanza la racha oficial actual de victorias en guerras normales.' }
    },
    CL_PERFECT_WARS: {
        title: { en: 'Perfect Clan War', nl: 'Perfecte clanwar', fr: 'Guerre de clan parfaite', de: 'Perfekter Clankrieg', es: 'Guerra de clan perfecta' },
        description: { en: 'Finish regular wars with the maximum possible stars.', nl: 'Beëindig gewone clanwars met het maximaal mogelijke aantal sterren.', fr: 'Terminez des guerres classiques avec le maximum d’étoiles possible.', de: 'Beende normale Clankriege mit der höchstmöglichen Sternzahl.', es: 'Termina guerras normales con el máximo de estrellas posible.' }
    },
    CL_WAR_WINRATE: {
        title: { en: 'Winning Culture', nl: 'Winnende cultuur', fr: 'Culture de la victoire', de: 'Siegerkultur', es: 'Cultura ganadora' },
        description: { en: 'Maintain a regular-war win rate over at least 50 captured wars.', nl: 'Behoud een winstpercentage boven de drempel over minstens 50 geregistreerde clanwars.', fr: 'Maintenez un taux de victoire supérieur au seuil sur au moins 50 guerres enregistrées.', de: 'Halte eine Gewinnquote über dem Zielwert in mindestens 50 erfassten Kriegen.', es: 'Mantén una tasa de victorias por encima del objetivo en al menos 50 guerras registradas.' }
    },
    CL_NO_MISS_WARS: {
        title: { en: 'Fully Deployed', nl: 'Volledig ingezet', fr: 'Déploiement complet', de: 'Vollständig eingesetzt', es: 'Despliegue completo' },
        description: { en: 'Finish regular wars with every available attack used.', nl: 'Beëindig gewone clanwars nadat elke beschikbare aanval is gebruikt.', fr: 'Terminez les guerres classiques après avoir utilisé toutes les attaques disponibles.', de: 'Beende normale Clankriege mit allen verfügbaren Angriffen.', es: 'Termina guerras normales usando todos los ataques disponibles.' }
    },
    CL_HARD_WINS: {
        title: { en: 'Hard Mode Winners', nl: 'Winnaars van de harde modus', fr: 'Vainqueurs du mode difficile', de: 'Sieger im schweren Modus', es: 'Ganadores del modo difícil' },
        description: { en: 'Win regular wars with a Hard Mode or battle modifier marker.', nl: 'Win gewone clanwars met een markering voor de harde modus of een gevechtsmodifier.', fr: 'Gagnez des guerres classiques avec un marqueur de mode difficile ou de modificateur de combat.', de: 'Gewinne normale Clankriege mit einer Markierung für schweren Modus oder Kampfmodifikator.', es: 'Gana guerras normales con un marcador de modo difícil o modificador de batalla.' }
    },
    CL_CWL_PROMOTIONS: {
        title: { en: 'League Climbers', nl: 'Ligaklimmers', fr: 'Grimpeurs de ligue', de: 'Ligenaufsteiger', es: 'Ascensos de liga' },
        description: { en: 'Earn CWL promotions.', nl: 'Verdien promoties in de CWL.', fr: 'Obtenez des promotions en CWL.', de: 'Erreiche Aufstiege in der CWL.', es: 'Consigue ascensos en la CWL.' }
    },
    CL_CWL_TOP3: {
        title: { en: 'CWL Podium Clan', nl: 'CWL-podiumclan', fr: 'Clan sur le podium CWL', de: 'CWL-Podium-Clan', es: 'Clan del podio de CWL' },
        description: { en: 'Finish CWL in the top three.', nl: 'Eindig in de top drie van de CWL.', fr: 'Terminez la CWL dans les trois premiers.', de: 'Beende die CWL unter den ersten drei.', es: 'Termina la CWL entre los tres primeros.' }
    },
    CL_CWL_PERFECT_ROUND: {
        title: { en: 'Perfect League Round', nl: 'Perfecte leagueronde', fr: 'Manche de ligue parfaite', de: 'Perfekte Ligarunde', es: 'Ronda de liga perfecta' },
        description: { en: 'Earn maximum stars in one CWL round.', nl: 'Verdien het maximale aantal sterren in één CWL-ronde.', fr: 'Gagnez le maximum d’étoiles lors d’une manche CWL.', de: 'Hole die maximale Sternzahl in einer CWL-Runde.', es: 'Consigue el máximo de estrellas en una ronda de CWL.' }
    },
    CL_DONATIONS: {
        title: { en: 'Donation Network', nl: 'Donatienetwerk', fr: 'Réseau de dons', de: 'Spendenetzwerk', es: 'Red de donaciones' },
        description: { en: 'Reach combined member donations in one season.', nl: 'Bereik het gezamenlijke aantal donaties van leden in één seizoen.', fr: 'Atteignez le total cumulé des dons des membres en une saison.', de: 'Erreiche die gemeinsamen Spenden aller Mitglieder in einer Saison.', es: 'Alcanza el total combinado de donaciones de los miembros en una temporada.' }
    },
    CL_DONOR_PARTICIPATION: {
        title: { en: 'Everyone Gives', nl: 'Iedereen doneert', fr: 'Tout le monde donne', de: 'Alle spenden', es: 'Todos donan' },
        description: { en: 'Reach the share of members with at least 1,000 seasonal donations.', nl: 'Bereik het aandeel leden met minstens 1.000 seizoensdonaties.', fr: 'Atteignez la part de membres ayant au moins 1 000 dons pendant la saison.', de: 'Erreiche den Anteil der Mitglieder mit mindestens 1.000 Saisonspenden.', es: 'Alcanza la proporción de miembros con al menos 1.000 donaciones de temporada.' }
    },
    CL_CAPITAL_POINTS: {
        title: { en: 'Capital Power', nl: 'Hoofdstadmacht', fr: 'Puissance de la capitale', de: 'Hauptstadtmacht', es: 'Poder de la capital' },
        description: { en: 'Reach Clan Capital trophy or point milestones.', nl: 'Bereik mijlpalen voor Clan Capital-trofeeën of -punten.', fr: 'Atteignez des paliers de trophées ou de points de capitale de clan.', de: 'Erreiche Meilensteine bei Trophäen oder Punkten der Clan-Hauptstadt.', es: 'Alcanza hitos de trofeos o puntos de la Capital del Clan.' }
    },
    CL_RAID_LOOT: {
        title: { en: 'Clan Raid Haul', nl: 'Clanraidbuit', fr: 'Butin de raid du clan', de: 'Clan-Raidbeute', es: 'Botín de incursión del clan' },
        description: { en: 'Loot Capital Gold in one raid weekend.', nl: 'Verzamel Capital Gold in één raidweekend.', fr: 'Récupérez de l’or de capitale lors d’un week-end de raids.', de: 'Sammle an einem Raid-Wochenende Hauptstadtgold.', es: 'Consigue Oro de la Capital en un fin de semana de incursiones.' }
    },
    CL_RAID_ATTACKS: {
        title: { en: 'Raid Mobilization', nl: 'Raidmobilisatie', fr: 'Mobilisation de raid', de: 'Raidmobilisierung', es: 'Movilización de incursión' },
        description: { en: 'Use attacks in one raid weekend.', nl: 'Gebruik aanvallen tijdens één raidweekend.', fr: 'Utilisez des attaques pendant un week-end de raids.', de: 'Nutze Angriffe an einem Raid-Wochenende.', es: 'Usa ataques durante un fin de semana de incursiones.' }
    },
    CL_RAID_PARTICIPATION: {
        title: { en: 'Capital Turnout', nl: 'Hoofdstadopkomst', fr: 'Participation à la capitale', de: 'Hauptstadtbeteiligung', es: 'Participación en la Capital' },
        description: { en: 'Reach a member-participation milestone in one raid weekend.', nl: 'Bereik een mijlpaal voor ledenparticipatie in één raidweekend.', fr: 'Atteignez un palier de participation des membres lors d’un week-end de raids.', de: 'Erreiche einen Meilenstein bei der Mitgliederbeteiligung an einem Raid-Wochenende.', es: 'Alcanza un hito de participación de miembros en un fin de semana de incursiones.' }
    },
    CL_RAIDS_COMPLETED: {
        title: { en: 'Capital Conquerors', nl: 'Hoofdstadveroveraars', fr: 'Conquérants de la capitale', de: 'Hauptstadteroberer', es: 'Conquistadores de la Capital' },
        description: { en: 'Complete enemy Capital raids during one weekend.', nl: 'Voltooi vijandelijke Capital-raids tijdens één weekend.', fr: 'Terminez les raids de capitale ennemis pendant un week-end.', de: 'Schließe an einem Wochenende feindliche Hauptstadt-Raids ab.', es: 'Completa incursiones de Capital enemigas durante un fin de semana.' }
    },
    CL_DISTRICTS_DESTROYED: {
        title: { en: 'District Demolition', nl: 'Districtsloop', fr: 'Démolition de districts', de: 'Distriktzerstörung', es: 'Demolición de distritos' },
        description: { en: 'Destroy enemy Capital districts during one weekend.', nl: 'Vernietig vijandelijke Capital-districten tijdens één weekend.', fr: 'Détruisez des districts de capitale ennemis pendant un week-end.', de: 'Zerstöre an einem Wochenende feindliche Hauptstadtbezirke.', es: 'Destruye distritos de Capital enemigos durante un fin de semana.' }
    },
    CL_BALANCED_ROSTER: {
        title: { en: 'Balanced Roster', nl: 'Gebalanceerde opstelling', fr: 'Roster équilibré', de: 'Ausgewogene Aufstellung', es: 'Plantilla equilibrada' },
        description: { en: 'Have at least 30 members and no Town Hall level above half the roster.', nl: 'Heb minstens 30 leden en geen enkel stadhuisniveau in meer dan de helft van de opstelling.', fr: 'Comptez au moins 30 membres sans qu’un niveau d’hôtel de ville dépasse la moitié du roster.', de: 'Habe mindestens 30 Mitglieder, ohne dass eine Rathausstufe mehr als die Hälfte der Aufstellung bildet.', es: 'Ten al menos 30 miembros sin que un nivel de Ayuntamiento supere la mitad de la plantilla.' }
    },
    CL_WAR_READY_ROSTER: {
        title: { en: 'War Ready Clan', nl: 'Oorlogsklare clan', fr: 'Clan prêt pour la guerre', de: 'Kriegsbereiter Clan', es: 'Clan listo para la guerra' },
        description: { en: 'Have at least 80% of members opted into war.', nl: 'Heb minstens 80% van de leden ingeschreven voor clanwars.', fr: 'Ayez au moins 80 % des membres inscrits aux guerres.', de: 'Habe mindestens 80 % der Mitglieder für Kriege angemeldet.', es: 'Ten al menos al 80 % de los miembros inscritos en guerras.' }
    },
    CL_STABLE_MONTH: {
        title: { en: 'Stable Roster', nl: 'Stabiele opstelling', fr: 'Roster stable', de: 'Stabile Aufstellung', es: 'Plantilla estable' },
        description: { en: 'Keep at least 90% of the roster unchanged over 30 days.', nl: 'Behoud minstens 90% van de opstelling gedurende 30 dagen.', fr: 'Conservez au moins 90 % du roster inchangé pendant 30 jours.', de: 'Halte mindestens 90 % der Aufstellung 30 Tage lang unverändert.', es: 'Mantén al menos el 90 % de la plantilla sin cambios durante 30 días.' }
    },
    CL_RETENTION: {
        title: { en: 'Clan Retention', nl: 'Clanbehoud', fr: 'Fidélisation du clan', de: 'Clanbindung', es: 'Retención del clan' },
        description: { en: 'Retain a share of the starting roster for 90 days.', nl: 'Behoud een deel van de startopstelling gedurende 90 dagen.', fr: 'Conservez une part du roster initial pendant 90 jours.', de: 'Halte einen Teil der Startaufstellung 90 Tage lang.', es: 'Conserva parte de la plantilla inicial durante 90 días.' }
    },
    CL_ALL_MODES: {
        title: { en: 'Complete Clan', nl: 'Volledige clan', fr: 'Clan complet', de: 'Vollständiger Clan', es: 'Clan completo' },
        description: { en: 'In one season, win a regular war, place top three in CWL and complete at least ten Capital raids.', nl: 'Win in één seizoen een gewone clanwar, eindig top drie in CWL en voltooi minstens tien Capital-raids.', fr: 'En une saison, gagnez une guerre classique, terminez dans les trois premiers en CWL et achevez au moins dix raids de capitale.', de: 'Gewinne in einer Saison einen normalen Clankrieg, werde Dritter oder besser in der CWL und schließe mindestens zehn Hauptstadt-Raids ab.', es: 'En una temporada, gana una guerra normal, queda entre los tres primeros de CWL y completa al menos diez incursiones de Capital.' }
    }
};

export const clanAchievementLocales = buildFamilyLocaleMaps(families);
