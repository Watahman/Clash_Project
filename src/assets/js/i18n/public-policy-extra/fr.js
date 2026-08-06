const SUPPORT_EMAIL = 'support.clashpanel@gmail.com';

export default Object.freeze({
    lastUpdated: '25 juillet 2026',
    tocLabel: 'Sommaire',
    tocTitle: 'Sur cette page',
    privacy: Object.freeze({
        title: 'Politique de confidentialité',
        description: 'Comment ClashPanel traite les données de compte, de planification, de Clan Family, de publicité et les données techniques.',
        summary: 'Cette politique explique quelles données personnelles ClashPanel traite, pourquoi elles sont utilisées, qui peut les recevoir et quels choix et droits vous possédez.',
        sections: Object.freeze([
            ['Responsable du traitement', [
                `ClashPanel exploite ce site et détermine comment les données personnelles sont utilisées pour le service ClashPanel. Les demandes relatives à la confidentialité peuvent être envoyées à ${SUPPORT_EMAIL}.`,
                'ClashPanel est un projet de fans non officiel consacré à Clash of Clans et n’est ni affilié, ni approuvé, ni sponsorisé par Supercell.'
            ]],
            ['Données que nous pouvons traiter', [
                'Données de compte et d’authentification, notamment votre adresse e-mail, votre nom d’affichage, les identifiants internes et les informations nécessaires au maintien d’une session authentifiée.',
                'Données Clash of Clans que vous fournissez ou associez, comme les tags de joueur et de clan, ainsi que les informations publiques renvoyées pour ces tags par l’API officielle Clash of Clans.',
                'Contenu et paramètres créés dans ClashPanel, comme les plans CWL, Clan Families, adhésions, sondages, rappels, brouillons du Planner et configurations associées.',
                'Informations techniques générées lorsque vous utilisez le service, comme l’adresse IP, les informations de navigateur ou d’appareil, les métadonnées de requête, les événements de sécurité et les journaux de diagnostic produits par les fournisseurs d’hébergement ou d’infrastructure.',
                'Données de cookies, stockage local et technologies similaires utilisées pour l’authentification, les préférences, le cache, les choix de consentement et, lorsque la publicité est activée, la diffusion et la mesure des annonces.'
            ]],
            ['Comment nous obtenons les données', [
                'Nous recevons des informations directement de votre part lorsque vous créez un compte, vous connectez, associez un joueur, créez du contenu ou contactez l’assistance.',
                'Les informations publiques sur les joueurs et les clans proviennent de l’API officielle Clash of Clans après l’envoi d’un tag pertinent dans ClashPanel.',
                'Des informations techniques peuvent être collectées automatiquement par votre navigateur, l’infrastructure ClashPanel et les fournisseurs de services lorsque vous accédez au site.'
            ]],
            ['Finalités et bases juridiques', [
                'Nous traitons les données de compte, du Planner et des Clan Families pour fournir les fonctions demandées, maintenir votre compte et exploiter le service ClashPanel.',
                'Nous pouvons traiter des données techniques et de sécurité limitées lorsque cela est nécessaire pour des intérêts légitimes tels que la protection des comptes, la prévention des abus, le diagnostic des pannes et le maintien de la fiabilité du service, en tenant compte des droits et intérêts des utilisateurs.',
                'Lorsque la loi exige un consentement, celui-ci est utilisé pour les cookies publicitaires facultatifs, le stockage local ou les finalités publicitaires associées. Vous pouvez retirer votre consentement au moyen des contrôles disponibles sans affecter le traitement effectué avant ce retrait.',
                'Nous pouvons également traiter des informations lorsque cela est nécessaire pour respecter une obligation légale ou pour établir, exercer ou défendre des droits en justice.'
            ]],
            ['Fournisseurs et partage des données', [
                'ClashPanel ne vend pas les données personnelles. Les informations ne sont partagées que lorsque cela est nécessaire pour fournir le service, respecter la loi, protéger le service ou lorsque vous nous le demandez.',
                'Les fournisseurs d’infrastructure et d’application peuvent inclure Supabase pour l’authentification et les données d’application, Google Cloud pour l’hébergement du backend, Cloudflare pour la livraison et la sécurité du site, Google pour la connexion ou les polices, et les services Supercell pour les données de l’API Clash of Clans.',
                'ClashPanel utilise ou peut utiliser Google AdSense sur certaines pages. Google et ses partenaires publicitaires peuvent recevoir des informations telles que l’adresse IP, l’URL de la page, les informations de navigateur ou d’appareil, les cookies, les identifiants de stockage local et les données d’interaction avec les annonces.'
            ]],
            ['Publicité Google', [
                'Des fournisseurs tiers, dont Google, peuvent utiliser des cookies ou technologies similaires pour diffuser, limiter, mesurer et protéger les annonces. Lorsque la publicité personnalisée est autorisée, les cookies publicitaires Google peuvent également servir à afficher des annonces en fonction de visites sur ClashPanel et/ou d’autres sites.',
                'Google explique comment il utilise les informations provenant de sites utilisant ses services dans sa documentation relative aux sites partenaires. Vous pouvez aussi contrôler la publicité personnalisée dans les paramètres des annonces Google.',
                'Pour les visiteurs de l’EEE, du Royaume-Uni et de la Suisse, le consentement publicitaire est géré selon les choix présentés par la solution de gestion du consentement configurée et les exigences Google applicables.'
            ]],
            ['Traitement international', [
                'Certains fournisseurs peuvent traiter des informations en dehors de la Belgique ou de l’Espace économique européen. Lorsque cela est requis, ces traitements et transferts sont soumis aux mécanismes et garanties applicables décrits dans les conditions et documents de confidentialité des fournisseurs.',
                'ClashPanel reposant sur une infrastructure tierce, le lieu exact de traitement peut dépendre du fournisseur et du service concerné.'
            ]],
            ['Conservation', [
                'Les données de compte et d’application sont conservées aussi longtemps que nécessaire pour fournir le service ou jusqu’à leur suppression, sous réserve des besoins de sécurité, de sauvegarde, de règlement des litiges et des obligations légales.',
                'Les journaux techniques, données en cache et informations d’authentification peuvent avoir des durées de conservation plus courtes déterminées par les besoins opérationnels et le fournisseur concerné. Les données devenues inutiles doivent être supprimées ou anonymisées lorsque cela est raisonnablement possible.'
            ]],
            ['Vos droits', [
                `Selon la législation applicable, vous pouvez disposer de droits d’accès, de rectification, d’effacement, de limitation, d’opposition, de portabilité et de retrait du consentement. Envoyez vos demandes à ${SUPPORT_EMAIL}. Nous pouvons devoir vérifier que la demande concerne bien votre compte avant d’y donner suite.`,
                'Vous avez également le droit d’introduire une réclamation auprès de l’autorité de protection des données compétente. Pour les utilisateurs en Belgique, il s’agit de l’Autorité de protection des données. Les droits légaux obligatoires ne sont pas limités par cette politique.'
            ]],
            ['Sécurité', [
                'ClashPanel utilise des mesures telles que des identifiants côté serveur, des sessions authentifiées, des contrôles d’accès et des protections de base de données. Aucun site, réseau ou système de stockage ne peut toutefois garantir une sécurité absolue.',
                'N’envoyez jamais de mots de passe, jetons d’accès, codes de vérification ou autres secrets d’authentification par e-mail.'
            ]],
            ['Modifications de cette politique', [
                'Cette politique peut être mise à jour lorsque les fonctions, la publicité, les fournisseurs, les exigences légales ou les pratiques de traitement changent. La date affichée en haut indique la dernière version publiée.'
            ]]
        ]),
        links: Object.freeze([
            ['Contacter pour la confidentialité', `mailto:${SUPPORT_EMAIL}?subject=Demande%20de%20confidentialite%20ClashPanel`],
            ['Utilisation des données des sites partenaires par Google', 'https://policies.google.com/technologies/partner-sites'],
            ['Paramètres des annonces Google', 'https://adssettings.google.com/']
        ])
    }),
    cookies: Object.freeze({
        title: 'Politique relative aux cookies',
        description: 'Cookies, stockage local, technologies publicitaires et choix de consentement utilisés par ClashPanel.',
        summary: 'ClashPanel utilise des technologies de navigateur essentielles au service et peut utiliser des technologies publicitaires Google sur les pages où les annonces sont activées.',
        sections: Object.freeze([
            ['Champ d’application', [
                'Cette politique couvre les cookies, le stockage local, IndexedDB et les technologies similaires utilisés directement par ClashPanel ou par des services tiers chargés via ClashPanel.',
                'Certaines technologies sont nécessaires aux fonctions demandées. D’autres, en particulier les technologies publicitaires, peuvent nécessiter votre consentement selon votre localisation et leur finalité.'
            ]],
            ['Cookies d’authentification essentiels', [
                'ClashPanel utilise des cookies d’authentification HttpOnly tels que ct_access et ct_refresh pour maintenir les sessions connectées. Des cookies temporaires peuvent aussi être utilisés pendant la connexion Google.',
                'Ces cookies sont nécessaires aux fonctions de compte. La déconnexion ou la suppression des données de navigateur concernées peut supprimer ou invalider les informations de session.'
            ]],
            ['Stockage local et IndexedDB', [
                'Le stockage local peut mémoriser des préférences d’interface comme la langue, le thème et le contexte ClashPanel sélectionné. IndexedDB peut mettre en cache des réponses récentes pour accélérer le chargement et réduire les requêtes répétées.',
                'Vous pouvez effacer le stockage du navigateur dans ses paramètres. Cela peut réinitialiser les préférences ou les données en cache, mais ne supprime pas à lui seul les données de compte conservées sur le serveur.'
            ]],
            ['Google AdSense et technologies publicitaires', [
                'Certaines pages ClashPanel incluent ou peuvent inclure Google AdSense. Des fournisseurs tiers, dont Google, peuvent placer ou lire des cookies, ou utiliser des technologies similaires, des adresses IP et d’autres identifiants pour diffuser des annonces, limiter leur fréquence, mesurer les performances et détecter la fraude ou les abus.',
                'Lorsque la publicité personnalisée est autorisée, des cookies publicitaires peuvent sélectionner des annonces en fonction de visites antérieures sur ClashPanel et/ou d’autres sites. Lorsque cette personnalisation n’est pas autorisée, des annonces contextuelles ou non personnalisées peuvent encore être affichées, avec un stockage ou des identifiants limités lorsque cela est permis.',
                'Google fournit des informations sur l’utilisation des données provenant de sites partenaires et des paramètres permettant de contrôler la publicité personnalisée.'
            ]],
            ['Consentement et modification de votre choix', [
                'Lorsque la loi applicable exige un consentement, l’interface de consentement publicitaire ou la plateforme de gestion du consentement détermine si le stockage et les finalités publicitaires facultatives sont autorisés.',
                'Vous pouvez refuser ou retirer un consentement facultatif sans perdre l’accès au service principal de ClashPanel. Vous pouvez également supprimer ou bloquer les cookies dans votre navigateur, mais le blocage du stockage essentiel peut empêcher certaines fonctions de compte.'
            ]],
            ['Autres ressources tierces', [
                'ClashPanel peut charger des services tels que Google Fonts ou la connexion Google. Les requêtes adressées à des tiers peuvent leur communiquer des informations techniques comme l’adresse IP, les informations de navigateur et la ressource demandée.',
                'Les fournisseurs tiers traitent les informations conformément à leurs propres conditions de confidentialité, en plus des choix et protections décrits ici.'
            ]],
            ['Modifications', [
                'Les technologies utilisées par ClashPanel peuvent évoluer avec les fonctions, la publicité et les fournisseurs. Cette politique sera mise à jour lorsque les pratiques importantes relatives aux cookies ou au stockage changeront.'
            ]]
        ]),
        links: Object.freeze([
            ['Utilisation des données des sites partenaires par Google', 'https://policies.google.com/technologies/partner-sites'],
            ['Paramètres des annonces Google', 'https://adssettings.google.com/'],
            ['Contacter pour la confidentialité', `mailto:${SUPPORT_EMAIL}?subject=Question%20cookies%20ou%20confidentialite%20ClashPanel`]
        ])
    }),
    terms: Object.freeze({
        title: 'Conditions d’utilisation',
        description: 'Conditions régissant l’accès à ClashPanel et son utilisation responsable.',
        summary: 'En utilisant ClashPanel, vous acceptez d’utiliser le service de manière responsable et conformément à ces conditions et à la loi applicable.',
        sections: Object.freeze([
            ['À propos de ClashPanel', [
                'ClashPanel est un outil non officiel créé par des fans pour organiser et planifier des activités Clash of Clans. ClashPanel n’est ni affilié, ni approuvé, ni sponsorisé par Supercell.',
                'Les références à Clash of Clans, Supercell et aux contenus associés restent la propriété de leurs détenteurs respectifs et l’utilisation de contenu de fans est soumise aux politiques Supercell applicables.'
            ]],
            ['Utilisation du service', [
                'Vous pouvez utiliser ClashPanel à des fins personnelles légales ou pour l’organisation d’un clan. Vous êtes responsable des activités effectuées avec votre compte et de la sécurité de vos méthodes de connexion.',
                'N’essayez pas d’accéder à des données sans autorisation, de contourner la sécurité ou les limites de débit, de perturber le service, de créer du trafic automatisé abusif, de collecter le service de manière nuisible, de distribuer des logiciels malveillants, d’usurper une identité ou d’utiliser ClashPanel pour faciliter la triche, le commerce de comptes ou des activités illégales.',
                'Vous ne devez pas utiliser le service d’une manière contraire à la loi applicable, aux droits de tiers, aux règles de Supercell ou aux politiques applicables au jeu ou à l’API sous-jacents.'
            ]],
            ['Comptes et accès', [
                'Vous êtes responsable de l’exactitude des informations requises et du maintien du contrôle de votre compte. Ne partagez jamais de jetons d’authentification ou de codes de vérification.',
                'ClashPanel peut limiter, suspendre ou mettre fin à l’accès lorsque cela est raisonnablement nécessaire pour protéger les utilisateurs ou l’infrastructure, enquêter sur un abus, respecter la loi ou traiter une violation grave de ces conditions.'
            ]],
            ['Votre contenu et les données Clan Family', [
                'Vous restez responsable des noms de plans, du contenu des Clan Families, des sondages, des données de feuilles de calcul importées et des autres informations soumises. Ne transmettez pas d’informations confidentielles que vous n’êtes pas autorisé à partager, de contenu illégal ou de contenu portant atteinte aux droits d’autrui.',
                'Vous accordez uniquement à ClashPanel l’autorisation raisonnablement nécessaire pour stocker, traiter, copier et afficher le contenu soumis afin d’exploiter, sécuriser et améliorer les fonctions que vous choisissez d’utiliser.'
            ]],
            ['Données du jeu et de tiers', [
                'Les informations sur les joueurs, clans, guerres et autres données du jeu peuvent dépendre de services externes, dont l’API officielle Clash of Clans. Les données externes peuvent être retardées, incomplètes, indisponibles ou modifiées par leur fournisseur.',
                'Les suggestions du Planner, prédictions, informations de statut ou données importées doivent être vérifiées avant de servir à une décision de clan.'
            ]],
            ['Publicité et services externes', [
                'ClashPanel peut afficher des publicités tierces, dont Google AdSense. Une publicité ne signifie pas que ClashPanel approuve l’annonceur, le produit ou le site externe.',
                'Les services et liens externes sont régis par leurs propres conditions et pratiques de confidentialité. ClashPanel n’est pas responsable des contenus ou transactions fournis uniquement par un tiers indépendant.'
            ]],
            ['Disponibilité et modifications', [
                'ClashPanel peut ajouter, modifier ou supprimer des fonctions et limiter temporairement la disponibilité pour des raisons de maintenance, de sécurité, de capacité, de droit ou liées à des services tiers.',
                'Le service est fourni sans promesse de disponibilité continue ou exempte d’erreurs. Rien dans ces conditions n’exclut les garanties ou droits qui ne peuvent légalement être exclus.'
            ]],
            ['Responsabilité', [
                'Dans la mesure permise par la loi applicable, ClashPanel n’est pas responsable des pertes indirectes résultant uniquement de l’indisponibilité d’API tierces, de données de jeu inexactes, de contenu créé par les utilisateurs ou de décisions prises à partir des résultats du Planner. Cela ne limite pas la responsabilité lorsque la loi applicable interdit une telle limitation.',
                'Vous restez responsable de conserver vos propres copies des informations importantes et de vérifier les actions dans le jeu avant de les exécuter.'
            ]],
            ['Confidentialité', [
                'L’utilisation de ClashPanel est également soumise à la Politique de confidentialité et à la Politique relative aux cookies, qui expliquent le traitement des données, les technologies publicitaires et les choix des utilisateurs.'
            ]],
            ['Modifications et droit applicable', [
                'Ces conditions peuvent être mises à jour lorsque le service ou les exigences légales changent. Les modifications importantes s’appliquent à compter de la publication de la nouvelle version ou d’une date ultérieure indiquée avec la mise à jour.',
                'Ces conditions sont régies par le droit belge dans la mesure permise par la loi applicable. Si vous êtes consommateur, les protections et droits impératifs prévus par le droit de votre pays de résidence restent applicables.'
            ]],
            ['Contact', [
                `Les questions relatives à ces conditions peuvent être envoyées à ${SUPPORT_EMAIL}.`
            ]]
        ]),
        links: Object.freeze([
            ['Contacter ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=Question%20sur%20les%20conditions%20ClashPanel`],
            ['Politique de contenu de fans Supercell', 'https://supercell.com/en/fan-content-policy/']
        ])
    }),
    contact: Object.freeze({
        title: 'Contact',
        description: 'Contactez ClashPanel par e-mail pour l’assistance, la confidentialité, la sécurité et les questions générales.',
        summary: `La méthode de contact officielle de ClashPanel est l’e-mail : ${SUPPORT_EMAIL}.`,
        sections: Object.freeze([
            ['Assistance par e-mail', [
                `Pour les bugs, demandes de fonctions, questions de compte, demandes de confidentialité, questions AdSense ou publicitaires et demandes générales, écrivez à ${SUPPORT_EMAIL}.`,
                'Pour signaler un bug, indiquez la page concernée, ce que vous attendiez, ce qui s’est produit et tout message d’erreur utile du navigateur. Supprimez les informations privées des captures d’écran avant de les envoyer.'
            ]],
            ['Demandes relatives à la confidentialité et au compte', [
                'Pour les demandes d’accès, de rectification, de suppression ou autres demandes de confidentialité, expliquez votre demande et indiquez l’adresse e-mail du compte concerné. Une vérification supplémentaire peut être requise avant de modifier ou communiquer des données liées au compte.',
                'N’envoyez jamais de mots de passe, jetons d’accès, jetons d’actualisation, codes de vérification ou autres secrets d’authentification par e-mail.'
            ]],
            ['Signalements de sécurité', [
                'Si vous pensez avoir découvert un problème de sécurité, décrivez-le et indiquez le minimum d’étapes nécessaires pour le reproduire. N’accédez pas aux données d’autres utilisateurs, ne les modifiez pas et ne les publiez pas pour démontrer une vulnérabilité.'
            ]]
        ]),
        links: Object.freeze([
            ['Envoyer un e-mail à ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=Contact%20ClashPanel`]
        ]),
        feedback: Object.freeze({
            title: 'Envoyer un retour',
            category: 'Catégorie',
            feature: 'Demande de fonction',
            other: 'Autre',
            page: 'Page',
            description: 'Description',
            email: 'E-mail de réponse (facultatif)',
            screenshot: 'Capture d’écran (facultative, 500 Ko maximum)',
            privacy: 'Nous utilisons ces informations uniquement pour traiter votre signalement. Ne partagez pas de mots de passe, jetons ou autres secrets.',
            send: 'Envoyer le retour',
            sending: 'Envoi en cours…',
            sent: 'Merci. Votre signalement a été reçu.',
            failed: 'Impossible d’envoyer le retour.',
            honeypot: 'Laissez ce champ vide',
            imageError: 'Choisissez une image de moins de 500 Ko.',
            readError: 'La capture d’écran n’a pas pu être lue.'
        })
    })
});
