import { getLanguage } from '../i18n/i18n.js';

const COPY = Object.freeze({
    en: Object.freeze({
        overview: 'Overview',
        settings: 'Settings',
        readiness: 'Readiness',
        ready: 'Ready',
        needsAttention: 'Needs attention',
        nextActions: 'Next actions',
        attention: 'Needs attention',
        linkedPreview: 'Linked clans',
        permissionMember: 'Members can view family information and answer polls. Leaders and co-leaders manage members.',
        permissionCoLeader: 'Co-leaders can manage normal members. Leaders manage roles and transfer leadership.',
        permissionLeader: 'Leaders manage roles, members, linked clans and family settings.',
        noManagement: 'You can view this family, its clans and poll results. Management controls are limited by your role.',
        memberDrawer: 'Member details',
        joined: 'Joined',
        actions: 'Actions',
        noActions: 'No actions are available for this member.',
        copyInvite: 'Copy invite code',
        inviteHelp: 'Share this code with someone who should join the Clan Family.',
        auditNotRun: 'Run a scan to compare live clan members with linked family accounts.',
        auditClean: 'All live clan accounts are linked to a family member.',
        auditIssues: 'Some live clan accounts are not linked to a family member.',
        familyEmptyTitle: 'Create or join a Clan Family',
        familyEmptyBody: 'Bring members, linked accounts, clans and CWL availability into one shared workspace.',
        open: 'Open',
        view: 'View',
        retry: 'Retry',
        responses: 'responses',
        response: 'response',
        activePoll: 'Active availability poll',
        noActivePoll: 'No active availability poll',
        pollHelp: 'Create a CWL availability poll so members can answer for each linked account and day.'
    }),
    nl: Object.freeze({
        overview: 'Overzicht', settings: 'Instellingen', readiness: 'Gereedheid', ready: 'Klaar',
        needsAttention: 'Aandacht nodig', nextActions: 'Volgende acties', attention: 'Aandacht nodig',
        linkedPreview: 'Gekoppelde clans',
        permissionMember: 'Leden kunnen familie-informatie bekijken en polls beantwoorden. Leaders en co-leaders beheren leden.',
        permissionCoLeader: 'Co-leaders kunnen gewone leden beheren. Leaders beheren rollen en leiderschapsoverdracht.',
        permissionLeader: 'Leaders beheren rollen, leden, gekoppelde clans en familie-instellingen.',
        noManagement: 'Je kunt deze familie, clans en pollresultaten bekijken. Beheeracties hangen af van je rol.',
        memberDrawer: 'Lidgegevens', joined: 'Lid sinds', actions: 'Acties', noActions: 'Voor dit lid zijn geen acties beschikbaar.',
        copyInvite: 'Uitnodigingscode kopiëren', inviteHelp: 'Deel deze code met iemand die lid moet worden van de Clan Family.',
        auditNotRun: 'Start een scan om live clanleden met gekoppelde familieaccounts te vergelijken.',
        auditClean: 'Alle live clanaccounts zijn aan een familielid gekoppeld.',
        auditIssues: 'Sommige live clanaccounts zijn niet aan een familielid gekoppeld.',
        familyEmptyTitle: 'Maak een Clan Family of word lid',
        familyEmptyBody: 'Breng leden, gekoppelde accounts, clans en CWL-beschikbaarheid samen in één werkruimte.',
        open: 'Openen', view: 'Bekijken', retry: 'Opnieuw proberen', responses: 'antwoorden', response: 'antwoord',
        activePoll: 'Actieve beschikbaarheidspoll', noActivePoll: 'Geen actieve beschikbaarheidspoll',
        pollHelp: 'Maak een CWL-beschikbaarheidspoll zodat leden per gekoppeld account en dag kunnen antwoorden.'
    }),
    fr: Object.freeze({
        overview: 'Vue d’ensemble', settings: 'Paramètres', readiness: 'Préparation', ready: 'Prêt',
        needsAttention: 'À surveiller', nextActions: 'Prochaines actions', attention: 'À surveiller',
        linkedPreview: 'Clans liés',
        permissionMember: 'Les membres peuvent consulter la famille et répondre aux sondages. Les leaders et co-leaders gèrent les membres.',
        permissionCoLeader: 'Les co-leaders peuvent gérer les membres ordinaires. Les leaders gèrent les rôles et le transfert de direction.',
        permissionLeader: 'Les leaders gèrent les rôles, les membres, les clans liés et les paramètres de la famille.',
        noManagement: 'Vous pouvez consulter cette famille, ses clans et ses résultats. Les actions de gestion dépendent de votre rôle.',
        memberDrawer: 'Détails du membre', joined: 'Membre depuis', actions: 'Actions', noActions: 'Aucune action n’est disponible pour ce membre.',
        copyInvite: 'Copier le code d’invitation', inviteHelp: 'Partagez ce code avec une personne qui doit rejoindre la Clan Family.',
        auditNotRun: 'Lancez une analyse pour comparer les membres des clans aux comptes liés de la famille.',
        auditClean: 'Tous les comptes des clans sont liés à un membre de la famille.',
        auditIssues: 'Certains comptes des clans ne sont pas liés à un membre de la famille.',
        familyEmptyTitle: 'Créer ou rejoindre une Clan Family',
        familyEmptyBody: 'Réunissez membres, comptes liés, clans et disponibilités CWL dans un espace partagé.',
        open: 'Ouvrir', view: 'Voir', retry: 'Réessayer', responses: 'réponses', response: 'réponse',
        activePoll: 'Sondage de disponibilité actif', noActivePoll: 'Aucun sondage de disponibilité actif',
        pollHelp: 'Créez un sondage de disponibilité CWL pour que chaque membre réponde par compte et par jour.'
    }),
    de: Object.freeze({
        overview: 'Übersicht', settings: 'Einstellungen', readiness: 'Bereitschaft', ready: 'Bereit',
        needsAttention: 'Aufmerksamkeit erforderlich', nextActions: 'Nächste Schritte', attention: 'Aufmerksamkeit erforderlich',
        linkedPreview: 'Verknüpfte Clans',
        permissionMember: 'Mitglieder sehen Familieninformationen und beantworten Umfragen. Leader und Co-Leader verwalten Mitglieder.',
        permissionCoLeader: 'Co-Leader können normale Mitglieder verwalten. Leader verwalten Rollen und übertragen die Leitung.',
        permissionLeader: 'Leader verwalten Rollen, Mitglieder, verknüpfte Clans und Familieneinstellungen.',
        noManagement: 'Du kannst diese Familie, ihre Clans und Ergebnisse sehen. Verwaltungsaktionen hängen von deiner Rolle ab.',
        memberDrawer: 'Mitgliederdetails', joined: 'Dabei seit', actions: 'Aktionen', noActions: 'Für dieses Mitglied sind keine Aktionen verfügbar.',
        copyInvite: 'Einladungscode kopieren', inviteHelp: 'Teile diesen Code mit einer Person, die der Clan Family beitreten soll.',
        auditNotRun: 'Starte eine Prüfung, um Live-Clanmitglieder mit verknüpften Familienkonten zu vergleichen.',
        auditClean: 'Alle Live-Clankonten sind einem Familienmitglied zugeordnet.',
        auditIssues: 'Einige Live-Clankonten sind keinem Familienmitglied zugeordnet.',
        familyEmptyTitle: 'Clan Family erstellen oder beitreten',
        familyEmptyBody: 'Mitglieder, verknüpfte Konten, Clans und CWL-Verfügbarkeit an einem Ort koordinieren.',
        open: 'Öffnen', view: 'Ansehen', retry: 'Erneut versuchen', responses: 'Antworten', response: 'Antwort',
        activePoll: 'Aktive Verfügbarkeitsumfrage', noActivePoll: 'Keine aktive Verfügbarkeitsumfrage',
        pollHelp: 'Erstelle eine CWL-Verfügbarkeitsumfrage für Antworten pro Konto und Tag.'
    }),
    es: Object.freeze({
        overview: 'Resumen', settings: 'Ajustes', readiness: 'Preparación', ready: 'Lista',
        needsAttention: 'Requiere atención', nextActions: 'Próximas acciones', attention: 'Requiere atención',
        linkedPreview: 'Clanes vinculados',
        permissionMember: 'Los miembros pueden consultar la familia y responder encuestas. Los líderes y colíderes gestionan miembros.',
        permissionCoLeader: 'Los colíderes pueden gestionar miembros normales. Los líderes gestionan roles y transfieren el liderazgo.',
        permissionLeader: 'Los líderes gestionan roles, miembros, clanes vinculados y ajustes de la familia.',
        noManagement: 'Puedes consultar esta familia, sus clanes y resultados. Las acciones de gestión dependen de tu rol.',
        memberDrawer: 'Detalles del miembro', joined: 'Miembro desde', actions: 'Acciones', noActions: 'No hay acciones disponibles para este miembro.',
        copyInvite: 'Copiar código de invitación', inviteHelp: 'Comparte este código con quien deba unirse al Clan Family.',
        auditNotRun: 'Ejecuta un escaneo para comparar miembros activos de los clanes con cuentas familiares vinculadas.',
        auditClean: 'Todas las cuentas activas de los clanes están vinculadas a un miembro de la familia.',
        auditIssues: 'Algunas cuentas activas de los clanes no están vinculadas a un miembro de la familia.',
        familyEmptyTitle: 'Crea o únete a un Clan Family',
        familyEmptyBody: 'Coordina miembros, cuentas vinculadas, clanes y disponibilidad CWL en un espacio compartido.',
        open: 'Abrir', view: 'Ver', retry: 'Reintentar', responses: 'respuestas', response: 'respuesta',
        activePoll: 'Encuesta de disponibilidad activa', noActivePoll: 'No hay encuesta de disponibilidad activa',
        pollHelp: 'Crea una encuesta de disponibilidad CWL para responder por cuenta vinculada y día.'
    })
});

const STATUS_COPY = Object.freeze({
    en: { openStatus: 'Open', closedStatus: 'Closed', invite: 'Invite', keepReady: 'Keep the family ready', searchMembers: 'Search members', accountLinkStatus: 'Account link status', familySettings: 'Clan Family settings', identity: 'Identity', familyName: 'Clan Family name', dangerZone: 'Leave Clan Family', createJoin: 'Clan Family', createJoinTitle: 'Create or join a Clan Family', cwlDays: 'CWL days', moreActions: 'More Clan Family actions', close: 'Close', role: 'Role', pending: 'pending' },
    nl: { openStatus: 'Open', closedStatus: 'Gesloten', invite: 'Uitnodigen', keepReady: 'Houd de familie klaar', searchMembers: 'Leden zoeken', accountLinkStatus: 'Accountkoppeling', familySettings: 'Clan Family-instellingen', identity: 'Identiteit', familyName: 'Naam van Clan Family', dangerZone: 'Clan Family verlaten', createJoin: 'Clan Family', createJoinTitle: 'Maak een Clan Family of word lid', cwlDays: 'CWL-dagen', moreActions: 'Meer Clan Family-acties', close: 'Sluiten', role: 'Rol', pending: 'in afwachting' },
    fr: { openStatus: 'Ouvert', closedStatus: 'Ferme', invite: 'Inviter', keepReady: 'Garder la famille prête', searchMembers: 'Rechercher des membres', accountLinkStatus: 'État du lien de compte', familySettings: 'Paramètres de la Clan Family', identity: 'Identité', familyName: 'Nom de la Clan Family', dangerZone: 'Quitter la Clan Family', createJoin: 'Clan Family', createJoinTitle: 'Créer ou rejoindre une Clan Family', cwlDays: 'Jours CWL', moreActions: 'Plus d’actions Clan Family', close: 'Fermer', role: 'Rôle', pending: 'en attente' },
    de: { openStatus: 'Offen', closedStatus: 'Geschlossen', invite: 'Einladen', keepReady: 'Familie bereit halten', searchMembers: 'Mitglieder suchen', accountLinkStatus: 'Kontoverknüpfung', familySettings: 'Clan-Family-Einstellungen', identity: 'Identität', familyName: 'Name der Clan Family', dangerZone: 'Clan Family verlassen', createJoin: 'Clan Family', createJoinTitle: 'Clan Family erstellen oder beitreten', cwlDays: 'CWL-Tage', moreActions: 'Weitere Clan-Family-Aktionen', close: 'Schließen', role: 'Rolle', pending: 'ausstehend' },
    es: { openStatus: 'Abierta', closedStatus: 'Cerrada', invite: 'Invitar', keepReady: 'Mantén la familia preparada', searchMembers: 'Buscar miembros', accountLinkStatus: 'Estado de cuenta vinculada', familySettings: 'Ajustes del Clan Family', identity: 'Identidad', familyName: 'Nombre del Clan Family', dangerZone: 'Salir del Clan Family', createJoin: 'Clan Family', createJoinTitle: 'Crea o únete a un Clan Family', cwlDays: 'Días de CWL', moreActions: 'Más acciones del Clan Family', close: 'Cerrar', role: 'Rol', pending: 'pendientes' }
});

function languageCopy() {
    return COPY[getLanguage()] || COPY.en;
}

export function familyCopy(key, params = {}) {
    let value = languageCopy()[key] || COPY.en[key] || STATUS_COPY[getLanguage()]?.[key] || STATUS_COPY.en[key] || key;
    Object.entries(params).forEach(([name, replacement]) => {
        value = value.replaceAll(`{${name}}`, replacement ?? '');
    });
    return value;
}

export function applyFamilyCopy(root = document) {
    root.querySelectorAll('[data-family-copy]').forEach(element => {
        element.textContent = familyCopy(element.dataset.familyCopy);
    });
    root.querySelectorAll('[data-family-aria-label]').forEach(element => {
        element.setAttribute('aria-label', familyCopy(element.dataset.familyAriaLabel));
    });
    root.querySelectorAll('[data-family-placeholder]').forEach(element => {
        element.setAttribute('placeholder', familyCopy(element.dataset.familyPlaceholder));
    });
}

window.addEventListener('clashtools:language-changed', () => applyFamilyCopy(document));
