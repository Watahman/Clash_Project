const SUPPORT_EMAIL = 'support.clashpanel@gmail.com';

export default Object.freeze({
    lastUpdated: '25. Juli 2026',
    tocLabel: 'Inhalt',
    tocTitle: 'Auf dieser Seite',
    privacy: Object.freeze({
        title: 'Datenschutzerklärung',
        description: 'Wie ClashPanel Konto-, Planner-, Clan-Family-, Werbe- und technische Daten verarbeitet.',
        summary: 'Diese Erklärung erläutert, welche personenbezogenen Daten ClashPanel verarbeitet, warum sie verwendet werden, wer sie erhalten kann und welche Wahlmöglichkeiten und Rechte du hast.',
        sections: Object.freeze([
            ['Verantwortliche Stelle', [
                `ClashPanel betreibt diese Website und entscheidet, wie personenbezogene Daten für den ClashPanel-Dienst verwendet werden. Datenschutzanfragen können an ${SUPPORT_EMAIL} gesendet werden.`,
                'ClashPanel ist ein inoffizielles Clash of Clans-Fanprojekt und ist weder mit Supercell verbunden noch von Supercell unterstützt oder gesponsert.'
            ]],
            ['Daten, die wir verarbeiten können', [
                'Konto- und Authentifizierungsdaten, darunter E-Mail-Adresse, Anzeigename, interne Benutzerkennungen und Informationen, die zur Aufrechterhaltung einer authentifizierten Sitzung erforderlich sind.',
                'Von dir angegebene oder verknüpfte Clash of Clans-Daten wie Spieler- und Clan-Tags sowie öffentliche Spielinformationen, die für diese Tags von der offiziellen Clash of Clans API zurückgegeben werden.',
                'Inhalte und Einstellungen, die du in ClashPanel erstellst, beispielsweise CWL-Pläne, Clan Families, Mitgliedschaften, Umfragen, Erinnerungen, Planner-Entwürfe und zugehörige Konfigurationen.',
                'Geräte- und technische Informationen, die bei der Nutzung des Dienstes entstehen, beispielsweise IP-Adresse, Browser- oder Geräteinformationen, Anfragemetadaten, Sicherheitsereignisse und Diagnoseprotokolle von Hosting- oder Infrastrukturanbietern.',
                'Cookie-, Local-Storage- und ähnliche Daten für Authentifizierung, Einstellungen, Caching, Einwilligungsentscheidungen und, sofern Werbung aktiviert ist, Auslieferung und Messung von Anzeigen.'
            ]],
            ['Wie wir Daten erhalten', [
                'Wir erhalten Informationen direkt von dir, wenn du ein Konto erstellst, dich anmeldest, einen Spieler verknüpfst, Inhalte erstellst oder den Support kontaktierst.',
                'Öffentliche Spieler- und Claninformationen werden über die offizielle Clash of Clans API abgerufen, nachdem ein entsprechender Tag über ClashPanel übermittelt wurde.',
                'Technische Informationen können automatisch durch deinen Browser, die ClashPanel-Infrastruktur und Dienstanbieter verarbeitet werden, wenn du die Website aufrufst.'
            ]],
            ['Zwecke und Rechtsgrundlagen', [
                'Wir verarbeiten Konto-, Planner- und Clan-Family-Daten, um die von dir angeforderten Funktionen bereitzustellen, dein Konto zu verwalten und den ClashPanel-Dienst zu betreiben.',
                'Begrenzte technische und Sicherheitsdaten können verarbeitet werden, wenn dies für berechtigte Interessen wie Kontoschutz, Missbrauchsprävention, Fehleranalyse und Dienstzuverlässigkeit erforderlich ist, wobei die Rechte und Interessen der Nutzer berücksichtigt werden.',
                'Wenn eine Einwilligung gesetzlich erforderlich ist, wird sie für optionale Werbe-Cookies, lokalen Speicher oder damit verbundene Werbezwecke verwendet. Du kannst die Einwilligung über die verfügbaren Steuerelemente widerrufen, ohne dass frühere rechtmäßige Verarbeitungen dadurch unwirksam werden.',
                'Informationen können außerdem verarbeitet werden, wenn dies zur Erfüllung gesetzlicher Pflichten oder zur Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen erforderlich ist.'
            ]],
            ['Dienstanbieter und Datenweitergabe', [
                'ClashPanel verkauft keine personenbezogenen Daten. Informationen werden nur weitergegeben, wenn dies zur Bereitstellung des Dienstes, zur Einhaltung von Gesetzen, zum Schutz des Dienstes oder auf deine Anweisung hin erforderlich ist.',
                'Infrastruktur- und Anwendungsanbieter können Supabase für Authentifizierung und Anwendungsdaten, Google Cloud für Backend-Hosting, Cloudflare für Websitebereitstellung und Sicherheit, Google für Anmeldung oder Schriftarten sowie Supercell-Dienste für Daten der Clash of Clans API umfassen.',
                'ClashPanel verwendet oder kann Google AdSense auf ausgewählten Seiten verwenden. Google und Werbepartner können dabei Informationen wie IP-Adresse, Seiten-URL, Browser- oder Geräteinformationen, Cookies, lokale Kennungen und Daten zu Werbeinteraktionen erhalten.'
            ]],
            ['Google-Werbung', [
                'Drittanbieter, darunter Google, können Cookies oder ähnliche Technologien verwenden, um Anzeigen auszuliefern, zu begrenzen, zu messen und zu schützen. Wenn personalisierte Werbung erlaubt ist, können Google-Werbe-Cookies Anzeigen anhand von Besuchen bei ClashPanel und/oder anderen Websites auswählen.',
                'Google erklärt in seinen Informationen zu Partnerwebsites, wie Daten von Websites verarbeitet werden, die Google-Dienste nutzen. Personalisierte Werbung kann außerdem über die Google-Anzeigeneinstellungen verwaltet werden.',
                'Für Besucher im EWR, im Vereinigten Königreich und in der Schweiz wird die Werbeeinwilligung entsprechend den Auswahlmöglichkeiten der konfigurierten Consent-Management-Lösung und den geltenden Google-Anforderungen behandelt.'
            ]],
            ['Internationale Verarbeitung', [
                'Einige Dienstanbieter können Informationen außerhalb Belgiens oder des Europäischen Wirtschaftsraums verarbeiten. Soweit erforderlich, unterliegen solche Verarbeitungen und Übermittlungen den geltenden Übermittlungsmechanismen und Schutzmaßnahmen, die in den Bedingungen und Datenschutzunterlagen der Anbieter beschrieben sind.',
                'Da ClashPanel Infrastruktur von Drittanbietern nutzt, kann der genaue Verarbeitungsort vom jeweiligen Anbieter und Dienst abhängen.'
            ]],
            ['Speicherdauer', [
                'Konto- und Anwendungsdaten werden so lange aufbewahrt, wie dies zur Bereitstellung des Dienstes erforderlich ist oder bis sie gelöscht werden, vorbehaltlich von Sicherheits-, Sicherungs-, Streitbeilegungs- und gesetzlichen Anforderungen.',
                'Technische Protokolle, Cache-Daten und Authentifizierungsinformationen können aufgrund betrieblicher Bedürfnisse und der Einstellungen des jeweiligen Dienstanbieters kürzere Speicherfristen haben. Nicht mehr benötigte Daten sollen, soweit vernünftig möglich, gelöscht oder anonymisiert werden.'
            ]],
            ['Deine Datenschutzrechte', [
                `Je nach anwendbarem Recht kannst du Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit und Widerruf einer Einwilligung haben. Sende Anfragen an ${SUPPORT_EMAIL}. Vor der Bearbeitung kann eine Überprüfung erforderlich sein, ob die Anfrage dein Konto betrifft.`,
                'Du hast außerdem das Recht, eine Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde einzureichen. Für Nutzer in Belgien ist dies die belgische Datenschutzbehörde. Zwingende gesetzliche Rechte werden durch diese Erklärung nicht eingeschränkt.'
            ]],
            ['Sicherheit', [
                'ClashPanel nutzt Maßnahmen wie serverseitige Zugangsdaten, authentifizierte Sitzungen, Zugriffskontrollen und Datenbankschutz. Keine Website, Netzwerkverbindung oder Speichermethode kann jedoch absolute Sicherheit garantieren.',
                'Sende niemals Passwörter, Zugriffstoken, Verifizierungscodes oder andere Authentifizierungsgeheimnisse per E-Mail.'
            ]],
            ['Änderungen dieser Erklärung', [
                'Diese Erklärung kann aktualisiert werden, wenn sich Funktionen, Werbung, Anbieter, gesetzliche Anforderungen oder Datenpraktiken ändern. Das oben angezeigte Datum kennzeichnet die zuletzt veröffentlichte Version.'
            ]]
        ]),
        links: Object.freeze([
            ['Datenschutzkontakt', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20Datenschutzanfrage`],
            ['So verwendet Google Daten von Partnerwebsites', 'https://policies.google.com/technologies/partner-sites'],
            ['Google-Anzeigeneinstellungen', 'https://adssettings.google.com/']
        ])
    }),
    cookies: Object.freeze({
        title: 'Cookie-Richtlinie',
        description: 'Cookies, lokaler Speicher, Werbetechnologien und Einwilligungsentscheidungen, die ClashPanel verwendet.',
        summary: 'ClashPanel verwendet für den Dienst erforderliche Browsertechnologien und kann auf Seiten mit Werbung Google-Werbetechnologien verwenden.',
        sections: Object.freeze([
            ['Geltungsbereich', [
                'Diese Richtlinie betrifft Cookies, Local Storage, IndexedDB und ähnliche Browsertechnologien, die direkt durch ClashPanel oder durch über ClashPanel geladene Drittanbieter verwendet werden.',
                'Einige Technologien sind für angeforderte Funktionen erforderlich. Andere, insbesondere Werbetechnologien, können je nach Standort und Verwendungszweck eine Einwilligung erfordern.'
            ]],
            ['Erforderliche Authentifizierungs-Cookies', [
                'ClashPanel verwendet HttpOnly-Authentifizierungs-Cookies wie ct_access und ct_refresh, damit angemeldete Sitzungen funktionieren. Während der Google-Anmeldung können zudem temporäre Cookies eingesetzt werden.',
                'Authentifizierungs-Cookies sind für Kontofunktionen erforderlich. Durch Abmelden oder Löschen relevanter Browserdaten können Sitzungsinformationen entfernt oder ungültig werden.'
            ]],
            ['Local Storage und IndexedDB', [
                'Local Storage kann Oberflächeneinstellungen wie Sprache, Theme und ausgewählten ClashPanel-Kontext speichern. IndexedDB kann aktuelle Anwendungsantworten zwischenspeichern, um schneller zu laden und wiederholte Anfragen zu reduzieren.',
                'Du kannst Browserspeicher über die Browsereinstellungen löschen. Dadurch können Einstellungen oder Cache-Daten zurückgesetzt werden; serverseitige Kontodaten werden dadurch allein nicht gelöscht.'
            ]],
            ['Google AdSense und Werbetechnologien', [
                'Ausgewählte ClashPanel-Seiten enthalten oder können Google AdSense enthalten. Drittanbieter, darunter Google, können Cookies setzen oder lesen oder ähnliche Technologien, IP-Adressen und andere Kennungen verwenden, um Anzeigen auszuliefern, die Anzeigenhäufigkeit zu steuern, Leistungen zu messen und Betrug oder Missbrauch zu erkennen.',
                'Wenn personalisierte Werbung erlaubt ist, können Werbe-Cookies Anzeigen anhand früherer Besuche bei ClashPanel und/oder anderen Websites auswählen. Wenn personalisierte Werbung nicht erlaubt ist, können weiterhin kontextbezogene oder andere nicht personalisierte Anzeigen erscheinen und begrenzter Speicher oder Kennungen genutzt werden, soweit dies zulässig ist.',
                'Google stellt Informationen zur Verwendung von Daten von Partnerwebsites und Anzeigeneinstellungen zur Verwaltung personalisierter Werbung bereit.'
            ]],
            ['Einwilligung und Änderung deiner Auswahl', [
                'Wenn das anwendbare Recht eine Einwilligung verlangt, bestimmt die Werbeeinwilligungsoberfläche oder Consent-Management-Plattform, ob optionaler Werbespeicher und Werbezwecke erlaubt sind.',
                'Du kannst optionale Einwilligungen verweigern oder widerrufen, ohne den Zugang zum Kerndienst von ClashPanel zu verlieren. Cookies können auch über den Browser gelöscht oder blockiert werden; das Blockieren erforderlichen Speichers kann jedoch Kontofunktionen beeinträchtigen.'
            ]],
            ['Weitere Drittanbieterressourcen', [
                'ClashPanel kann Dienste wie Google Fonts oder Google-Anmeldung laden. Anfragen an Drittanbieter können technische Verbindungsinformationen wie IP-Adresse, Browserinformationen und die angeforderte Ressource an den Anbieter übertragen.',
                'Drittanbieter verarbeiten Informationen nach ihren eigenen Datenschutzbedingungen zusätzlich zu den hier beschriebenen Auswahlmöglichkeiten und Schutzmaßnahmen.'
            ]],
            ['Änderungen', [
                'Die von ClashPanel verwendeten Technologien können sich mit Funktionen, Werbung und Anbietern ändern. Diese Richtlinie wird aktualisiert, wenn sich wesentliche Cookie- oder Speicherpraktiken ändern.'
            ]]
        ]),
        links: Object.freeze([
            ['So verwendet Google Daten von Partnerwebsites', 'https://policies.google.com/technologies/partner-sites'],
            ['Google-Anzeigeneinstellungen', 'https://adssettings.google.com/'],
            ['Datenschutzkontakt', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20Cookie-%20oder%20Datenschutzfrage`]
        ])
    }),
    terms: Object.freeze({
        title: 'Nutzungsbedingungen',
        description: 'Bedingungen für den Zugang zu ClashPanel und dessen verantwortungsvolle Nutzung.',
        summary: 'Mit der Nutzung von ClashPanel stimmst du zu, den Dienst verantwortungsvoll und im Einklang mit diesen Bedingungen und dem anwendbaren Recht zu verwenden.',
        sections: Object.freeze([
            ['Über ClashPanel', [
                'ClashPanel ist ein inoffizielles, von Fans erstelltes Tool zur Organisation und Planung von Clash of Clans-Aktivitäten. ClashPanel ist weder mit Supercell verbunden noch von Supercell unterstützt oder gesponsert.',
                'Verweise auf Clash of Clans, Supercell und zugehörige Spielinhalte bleiben Eigentum der jeweiligen Rechteinhaber; die Nutzung von Faninhalten unterliegt den geltenden Supercell-Richtlinien.'
            ]],
            ['Nutzung des Dienstes', [
                'Du darfst ClashPanel für rechtmäßige persönliche Zwecke oder zur Clanorganisation verwenden. Du bist für Aktivitäten über dein Konto und für die Sicherheit deiner Anmeldemethoden verantwortlich.',
                'Versuche nicht, unbefugt auf Daten zuzugreifen, Sicherheitsmaßnahmen oder Ratenbegrenzungen zu umgehen, den Betrieb zu stören, missbräuchlichen automatisierten Datenverkehr zu erzeugen, den Dienst schädlich zu scrapen, Schadsoftware zu verbreiten, dich als andere Person auszugeben oder ClashPanel für Cheats, Account-Handel oder rechtswidriges Verhalten zu verwenden.',
                'Der Dienst darf nicht in einer Weise verwendet werden, die gegen anwendbares Recht, Rechte Dritter, Supercell-Regeln oder Richtlinien für das zugrunde liegende Spiel oder die API verstößt.'
            ]],
            ['Konten und Zugang', [
                'Du bist dafür verantwortlich, erforderliche Informationen korrekt anzugeben und die Kontrolle über dein Konto zu behalten. Teile niemals Authentifizierungstoken oder Verifizierungscodes mit anderen.',
                'ClashPanel kann den Zugang einschränken, aussetzen oder beenden, wenn dies zum Schutz von Nutzern oder Infrastruktur, zur Untersuchung von Missbrauch, zur Einhaltung von Gesetzen oder zur Behandlung eines schweren Verstoßes gegen diese Bedingungen vernünftigerweise erforderlich ist.'
            ]],
            ['Deine Inhalte und Clan-Family-Daten', [
                'Du bleibst für Plannamen, Clan-Family-Inhalte, Umfragen, importierte Tabellendaten und andere eingereichte Informationen verantwortlich. Übermittle keine vertraulichen Informationen, zu deren Weitergabe du nicht berechtigt bist, keine rechtswidrigen Inhalte und keine Inhalte, die Rechte anderer verletzen.',
                'Du erteilst ClashPanel nur die vernünftigerweise erforderliche Erlaubnis, eingereichte Inhalte zu speichern, zu verarbeiten, zu kopieren und anzuzeigen, um die von dir gewählten Funktionen zu betreiben, zu sichern und zu verbessern.'
            ]],
            ['Spiel- und Drittanbieterdaten', [
                'Spieler-, Clan-, Kriegs- und ähnliche Spielinformationen können von externen Diensten einschließlich der offiziellen Clash of Clans API abhängen. Externe Daten können verspätet, unvollständig, nicht verfügbar oder durch den Anbieter geändert sein.',
                'Planner-Vorschläge, Prognosen, Statusinformationen und importierte Daten sollten geprüft werden, bevor sie für Clanentscheidungen verwendet werden.'
            ]],
            ['Werbung und externe Dienste', [
                'ClashPanel kann Drittanbieterwerbung einschließlich Google AdSense anzeigen. Eine Anzeige bedeutet nicht, dass ClashPanel den Werbetreibenden, das Produkt oder die externe Website empfiehlt.',
                'Externe Dienste und Links unterliegen ihren eigenen Bedingungen und Datenschutzpraktiken. ClashPanel ist nicht für Inhalte oder Transaktionen verantwortlich, die ausschließlich von einem unabhängigen Dritten angeboten werden.'
            ]],
            ['Verfügbarkeit und Änderungen', [
                'ClashPanel kann Funktionen hinzufügen, ändern oder entfernen und die Verfügbarkeit aus Wartungs-, Sicherheits-, Kapazitäts-, rechtlichen oder Drittanbietergründen vorübergehend begrenzen.',
                'Der Dienst wird ohne Zusage ununterbrochener oder fehlerfreier Verfügbarkeit angeboten. Diese Bedingungen schließen keine Garantien oder Rechte aus, die gesetzlich nicht ausgeschlossen werden dürfen.'
            ]],
            ['Haftung', [
                'Soweit nach anwendbarem Recht zulässig, haftet ClashPanel nicht für indirekte Verluste, die ausschließlich aus nicht verfügbaren Drittanbieter-APIs, unzutreffenden Spieldaten, nutzergenerierten Inhalten oder Entscheidungen auf Grundlage von Planner-Ausgaben entstehen. Dies begrenzt keine Haftung, wenn eine solche Begrenzung gesetzlich unzulässig ist.',
                'Du bleibst dafür verantwortlich, eigene Kopien wichtiger Informationen aufzubewahren und Spielaktionen vor ihrer Durchführung zu überprüfen.'
            ]],
            ['Datenschutz', [
                'Die Nutzung von ClashPanel unterliegt ebenfalls der Datenschutzerklärung und der Cookie-Richtlinie, die Datenverarbeitung, Werbetechnologien und Nutzerentscheidungen erläutern.'
            ]],
            ['Änderungen und anwendbares Recht', [
                'Diese Bedingungen können aktualisiert werden, wenn sich der Dienst oder gesetzliche Anforderungen ändern. Wesentliche Änderungen gelten ab Veröffentlichung der aktualisierten Version oder ab einem späteren, mit der Änderung angegebenen Datum.',
                'Diese Bedingungen unterliegen belgischem Recht, soweit dies nach anwendbarem Recht zulässig ist. Wenn du Verbraucher bist, bleiben zwingende Verbraucherschutzrechte nach dem Recht deines Wohnsitzlandes unberührt.'
            ]],
            ['Kontakt', [
                `Fragen zu diesen Bedingungen können an ${SUPPORT_EMAIL} gesendet werden.`
            ]]
        ]),
        links: Object.freeze([
            ['ClashPanel kontaktieren', `mailto:${SUPPORT_EMAIL}?subject=Frage%20zu%20ClashPanel-Nutzungsbedingungen`],
            ['Supercell-Richtlinie für Faninhalte', 'https://supercell.com/en/fan-content-policy/']
        ])
    }),
    contact: Object.freeze({
        title: 'Kontakt',
        description: 'Kontaktiere ClashPanel per E-Mail für Support, Datenschutz, Sicherheit und allgemeine Fragen.',
        summary: `Die offizielle Kontaktmethode für ClashPanel ist E-Mail: ${SUPPORT_EMAIL}.`,
        sections: Object.freeze([
            ['Support per E-Mail', [
                `Für Fehler, Funktionswünsche, Kontofragen, Datenschutzanfragen, AdSense- oder Werbefragen und allgemeine Projektanfragen schreibe an ${SUPPORT_EMAIL}.`,
                'Gib bei einer Fehlermeldung die betroffene Seite, das erwartete Verhalten, das tatsächliche Verhalten und nützliche Browserfehlermeldungen an. Entferne private Informationen aus Screenshots, bevor du sie sendest.'
            ]],
            ['Datenschutz- und Kontoanfragen', [
                'Erkläre bei Auskunfts-, Berichtigungs-, Lösch- oder anderen Datenschutzanfragen, was du beantragst und welche Konto-E-Mail-Adresse betroffen ist. Vor Änderung oder Offenlegung kontobezogener Daten kann eine zusätzliche Überprüfung erforderlich sein.',
                'Sende niemals Passwörter, Zugriffstoken, Refresh-Token, Verifizierungscodes oder andere Authentifizierungsgeheimnisse per E-Mail.'
            ]],
            ['Sicherheitsmeldungen', [
                'Wenn du glaubst, ein Sicherheitsproblem gefunden zu haben, beschreibe das Problem und die minimalen Schritte zur Reproduktion. Greife nicht auf Daten anderer Nutzer zu, ändere sie nicht und veröffentliche sie nicht, um eine Schwachstelle zu beweisen.'
            ]]
        ]),
        links: Object.freeze([
            ['E-Mail an ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20Kontakt`]
        ]),
        feedback: Object.freeze({
            title: 'Feedback senden',
            category: 'Kategorie',
            feature: 'Funktionswunsch',
            other: 'Sonstiges',
            page: 'Seite',
            description: 'Beschreibung',
            email: 'Antwort-E-Mail (optional)',
            screenshot: 'Screenshot (optional, höchstens 500 KB)',
            privacy: 'Wir verwenden diese Angaben nur zur Bearbeitung deiner Meldung. Teile keine Passwörter, Token oder anderen Geheimnisse.',
            send: 'Feedback senden',
            sending: 'Wird gesendet…',
            sent: 'Danke. Deine Meldung wurde empfangen.',
            failed: 'Feedback konnte nicht gesendet werden.',
            honeypot: 'Dieses Feld leer lassen',
            imageError: 'Bitte wähle ein Bild unter 500 KB.',
            readError: 'Der Screenshot konnte nicht gelesen werden.'
        })
    })
});
