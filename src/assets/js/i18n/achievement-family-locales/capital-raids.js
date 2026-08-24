import { buildFamilyLocaleMaps } from '../achievement-family-locale-utils.js';

const families = {
    RAID_WEEKENDS: {
        title: { en: 'Raid Regular', nl: 'Raidregular', fr: 'Habitué des raids', de: 'Raid-Stammgast', es: 'Habitual de incursiones' },
        description: { en: 'Participate in Clan Capital raid weekends.', nl: 'Neem deel aan raidweekends in de Clan Capital.', fr: 'Participez aux week-ends de raids de la capitale de clan.', de: 'Nimm an Raid-Wochenenden der Clan-Hauptstadt teil.', es: 'Participa en fines de semana de incursiones de la Capital del Clan.' }
    },
    RAID_ATTACKS: {
        title: { en: 'Capital Attacker', nl: 'Hoofdstadaanvaller', fr: 'Attaquant de la capitale', de: 'Hauptstadtangreifer', es: 'Atacante de la Capital' },
        description: { en: 'Complete Clan Capital raid attacks.', nl: 'Voltooi aanvallen in Clan Capital-raids.', fr: 'Terminez des attaques de raid dans la capitale de clan.', de: 'Schließe Angriffe in der Clan-Hauptstadt ab.', es: 'Completa ataques de incursión en la Capital del Clan.' }
    },
    RAID_LOOT: {
        title: { en: 'Capital Raider', nl: 'Hoofdstadraider', fr: 'Pilleur de capitale', de: 'Hauptstadtplünderer', es: 'Saqueador de la Capital' },
        description: { en: 'Loot Capital Gold across observed raid weekends.', nl: 'Verzamel Capital Gold over de gevolgde raidweekends.', fr: 'Récupérez de l’or de capitale sur les week-ends de raids observés.', de: 'Sammle Hauptstadtgold über die erfassten Raid-Wochenenden.', es: 'Consigue Oro de la Capital durante los fines de semana observados.' }
    },
    RAID_WEEKEND_LOOT: {
        title: { en: 'Weekend Haul', nl: 'Weekendbuit', fr: 'Butin du week-end', de: 'Wochenendbeute', es: 'Botín del fin de semana' },
        description: { en: 'Loot Capital Gold in a single raid weekend.', nl: 'Verzamel Capital Gold tijdens één raidweekend.', fr: 'Récupérez de l’or de capitale pendant un seul week-end de raids.', de: 'Sammle Hauptstadtgold an einem einzigen Raid-Wochenende.', es: 'Consigue Oro de la Capital en un solo fin de semana de incursiones.' }
    },
    RAID_FULL_ATTACKS: {
        title: { en: 'Full Raid Slate', nl: 'Volledige raidronde', fr: 'Carnet de raids complet', de: 'Vollständige Raid-Runde', es: 'Ronda de incursión completa' },
        description: { en: 'Use every available Capital attack in a raid weekend.', nl: 'Gebruik elke beschikbare Capital-aanval tijdens een raidweekend.', fr: 'Utilisez toutes les attaques de capitale disponibles lors d’un week-end de raids.', de: 'Nutze an einem Raid-Wochenende jeden verfügbaren Hauptstadtangriff.', es: 'Usa todos los ataques de Capital disponibles en un fin de semana de incursiones.' }
    },
    RAID_FULL_STREAK: {
        title: { en: 'Raid Reliability', nl: 'Raidbetrouwbaarheid', fr: 'Fiabilité en raid', de: 'Raid-Zuverlässigkeit', es: 'Fiabilidad en incursiones' },
        description: { en: 'Use every available attack in consecutive raid weekends.', nl: 'Gebruik elke beschikbare aanval tijdens opeenvolgende raidweekends.', fr: 'Utilisez toutes les attaques disponibles sur plusieurs week-ends de raids consécutifs.', de: 'Nutze an aufeinanderfolgenden Raid-Wochenenden jeden verfügbaren Angriff.', es: 'Usa todos los ataques disponibles en fines de semana consecutivos.' }
    },
    RAID_BONUS: {
        title: { en: 'Bonus Earner', nl: 'Bonusverdiener', fr: 'Gagnant de bonus', de: 'Bonusverdiener', es: 'Ganador de bonificación' },
        description: { en: 'Earn a bonus Capital attack in raid weekends.', nl: 'Verdien een bonusaanval in de Clan Capital tijdens raidweekends.', fr: 'Gagnez une attaque bonus de capitale pendant des week-ends de raids.', de: 'Verdiene einen Bonusangriff der Clan-Hauptstadt an Raid-Wochenenden.', es: 'Consigue un ataque adicional de Capital en fines de semana de incursiones.' }
    },
    RAID_EFFICIENCY: {
        title: { en: 'Capital Efficiency', nl: 'Hoofdstadefficiëntie', fr: 'Efficacité de la capitale', de: 'Hauptstadteffizienz', es: 'Eficiencia de la Capital' },
        description: { en: 'Reach the target average Capital Gold per attack over at least 25 attacks.', nl: 'Bereik het doelgemiddelde Capital Gold per aanval over minstens 25 aanvallen.', fr: 'Atteignez le rendement moyen cible en or de capitale par attaque sur au moins 25 attaques.', de: 'Erreiche über mindestens 25 Angriffe den Zielwert für Hauptstadtgold pro Angriff.', es: 'Alcanza el promedio objetivo de Oro de la Capital por ataque en al menos 25 ataques.' }
    },
    RAID_TOP_LOOTER: {
        title: { en: 'Weekend Top Looter', nl: 'Topplunderaar van het weekend', fr: 'Meilleur pilleur du week-end', de: 'Top-Plünderer des Wochenendes', es: 'Mayor saqueador del fin de semana' },
        description: { en: 'Lead the clan in Capital Gold looted during a raid weekend, with at least five attacks.', nl: 'Buit tijdens een raidweekend het meeste Capital Gold van de clan met minstens vijf aanvallen.', fr: 'Soyez en tête du clan pour l’or de capitale pillé lors d’un week-end, avec au moins cinq attaques.', de: 'Führe den Clan bei Hauptstadtgold an einem Raid-Wochenende mit mindestens fünf Angriffen an.', es: 'Lidera al clan en Oro de la Capital saqueado durante un fin de semana con al menos cinco ataques.' }
    },
    RAID_TOP_LOOTER_COUNT: {
        title: { en: 'Capital MVP', nl: 'Hoofdstad-MVP', fr: 'MVP de la capitale', de: 'Hauptstadt-MVP', es: 'MVP de la Capital' },
        description: { en: 'Lead the clan in raid loot during raid weekends; higher tiers count repeated top finishes.', nl: 'Voer de clan tijdens raidweekends aan in raidbuit; hogere tiers tellen herhaalde topprestaties.', fr: 'Menez le clan pour le butin des raids ; les paliers supérieurs comptent les premières places répétées.', de: 'Führe den Clan bei der Raidbeute an; höhere Stufen zählen wiederholte Spitzenplätze.', es: 'Lidera al clan en botín de incursiones; los niveles superiores cuentan primeros puestos repetidos.' }
    },
    RAID_DISTRICT_FINISH: {
        title: { en: 'District Finisher', nl: 'Districtvoltooier', fr: 'Finisseur de district', de: 'Distrikt-Finisher', es: 'Rematador de distrito' },
        description: { en: 'Land the final attack that destroys any Capital district.', nl: 'Voer de laatste aanval uit die een willekeurig Capital-district vernietigt.', fr: 'Portez l’attaque finale qui détruit n’importe quel district de capitale.', de: 'Führe den letzten Angriff aus, der einen beliebigen Hauptstadtbezirk zerstört.', es: 'Realiza el ataque final que destruye cualquier distrito de la Capital.' }
    },
    RAID_CAPITAL_FINISH: {
        title: { en: 'Capital Hall Finisher', nl: 'Hoofdstadhalvoltooier', fr: 'Finisseur de salle de capitale', de: 'Hauptstadt-Hallen-Finisher', es: 'Rematador del Distrito de la Capital' },
        description: { en: 'Land the final attack that specifically destroys the enemy Capital Hall district.', nl: 'Voer de laatste aanval uit die specifiek het vijandelijke hoofdstaddistrict vernietigt.', fr: 'Portez l’attaque finale qui détruit précisément le district de la salle de capitale ennemie.', de: 'Führe den letzten Angriff aus, der gezielt den feindlichen Hauptstadt-Hallenbezirk zerstört.', es: 'Realiza el ataque final que destruye específicamente el distrito de la Sala de la Capital enemiga.' }
    },
    RAID_PERFECT_WEEKEND: {
        title: { en: 'Perfect Attendance Raider', nl: 'Perfecte raiddeelname', fr: 'Raider assidu parfait', de: 'Perfekter Raid-Teilnehmer', es: 'Asaltante de asistencia perfecta' },
        description: { en: 'Use every attack, earn a bonus attack and rank in the clan top ten for loot in one weekend.', nl: 'Gebruik elke aanval, verdien een bonusaanval en eindig in één weekend in de clan-top tien voor buit.', fr: 'Utilisez toutes vos attaques, gagnez une attaque bonus et entrez dans le top 10 du butin du clan en un week-end.', de: 'Nutze jeden Angriff, verdiene einen Bonusangriff und lande an einem Wochenende bei der Beute unter den zehn Besten des Clans.', es: 'Usa todos los ataques, consigue uno adicional y entra en el top diez del clan por botín en un fin de semana.' }
    },
    RAID_CONTRIB_AND_LOOT: {
        title: { en: 'Capital All-Rounder', nl: 'Hoofdstadallrounder', fr: 'Polyvalent de la capitale', de: 'Hauptstadt-Allrounder', es: 'Todoterreno de la Capital' },
        description: { en: 'Combine lifetime Clan Capital contributions with raid loot earned over your tracked weekends.', nl: 'Combineer levenslange bijdragen aan de Clan Capital met raidbuit uit je gevolgde weekends.', fr: 'Combinez vos contributions à vie à la capitale de clan avec le butin gagné lors de vos week-ends suivis.', de: 'Verbinde lebenslange Beiträge zur Clan-Hauptstadt mit Raidbeute aus deinen erfassten Wochenenden.', es: 'Combina tus contribuciones de por vida a la Capital del Clan con el botín de tus fines de semana registrados.' }
    },
    RAID_100_WEEKENDS_FULL: {
        title: { en: 'Capital Centurion', nl: 'Hoofdstadcenturio', fr: 'Centurion de la capitale', de: 'Hauptstadtzenturio', es: 'Centurión de la Capital' },
        description: { en: 'Use every available attack in 100 raid weekends.', nl: 'Gebruik elke beschikbare aanval tijdens 100 raidweekends.', fr: 'Utilisez toutes les attaques disponibles lors de 100 week-ends de raids.', de: 'Nutze an 100 Raid-Wochenenden jeden verfügbaren Angriff.', es: 'Usa todos los ataques disponibles en 100 fines de semana de incursiones.' }
    }
};

export const capitalRaidAchievementLocales = buildFamilyLocaleMaps(families);
