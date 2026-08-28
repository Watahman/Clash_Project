const SUPPORT_EMAIL = 'support.clashpanel@gmail.com';

export default Object.freeze({
    lastUpdated: '27 de agosto de 2026',
    tocLabel: 'Contenido',
    tocTitle: 'En esta página',
    privacy: Object.freeze({
        title: 'Política de privacidad',
        description: 'Cómo procesa ClashPanel los datos de cuenta, Clash vinculado, seguimiento de Advanced Stats, Planner, Clan Family, publicidad y datos técnicos.',
        summary: 'Esta política explica qué datos personales procesa ClashPanel, por qué se usan, quién puede recibirlos y qué opciones y derechos tienes.',
        sections: Object.freeze([
            ['Responsable del tratamiento', [
                `ClashPanel gestiona este sitio web y determina cómo se usan los datos personales para el servicio ClashPanel. Las solicitudes de privacidad pueden enviarse a ${SUPPORT_EMAIL}.`,
                'ClashPanel es un proyecto no oficial de fans de Clash of Clans y no está afiliado, aprobado ni patrocinado por Supercell.'
            ]],
            ['Datos que podemos procesar', [
                'Datos de cuenta y autenticación, incluidos tu correo electrónico, nombre visible, identificadores internos e información necesaria para mantener una sesión autenticada.',
                'Datos de Clash of Clans que proporcionas o vinculas, como etiquetas de jugador y clan, junto con la información pública devuelta para esas etiquetas por la API oficial de Clash of Clans.',
                'Si activas Advanced Stats para una cuenta vinculada, ClashPanel puede conservar observaciones de battlelog a largo plazo y estadísticas derivadas de esa cuenta. Pueden incluir la hora del ataque o de la primera observación, la etiqueta o el nombre público del oponente, información del Ayuntamiento, estrellas, destrucción, recursos saqueados o disponibles cuando se proporcionen desde el origen, la composición registrada del ejército y los identificadores de unidades, estadísticas agregadas de uso o rendimiento, el estado del seguimiento y metadatos sobre lagunas conocidas. Los datos históricos de battlelog, ataques de guerra y battlelog clasificatorio pueden ser proporcionados por ClashKing V2, un servicio histórico externo, según el alcance activado y la disponibilidad del origen.',
                'Contenido y ajustes creados en ClashPanel, como planes CWL, Clan Families, membresías, encuestas, recordatorios, borradores del Planner y configuración relacionada.',
                'Información técnica y del dispositivo generada al usar el servicio, como dirección IP, navegador o dispositivo, metadatos de solicitud, eventos de seguridad y registros de diagnóstico producidos por proveedores de alojamiento o infraestructura.',
                'Datos de cookies, almacenamiento local y tecnologías similares usados para autenticación, preferencias, caché, decisiones de consentimiento y, cuando la publicidad está activa, entrega y medición de anuncios.'
            ]],
            ['Cómo obtenemos los datos', [
                'Recibimos información directamente de ti cuando creas una cuenta, inicias sesión, vinculas un jugador, creas contenido o contactas con soporte.',
                'La información pública actual de jugadores y clanes puede obtenerse mediante la API oficial de Clash of Clans después de enviar una etiqueta relevante a través de ClashPanel.',
                'La recopilación de Advanced Stats solo comienza después de activarla para una cuenta vinculada. Mientras el seguimiento está activo, ClashPanel puede solicitar a ClashKing V2 datos históricos de battlelog, ataques de guerra y battlelog clasificatorio para ese jugador. Ese servicio externo puede devolver registros que conservó de observaciones anteriores; por ello, la cobertura, los campos y la actualidad pueden ser parciales, retrasados o no estar disponibles. ClashPanel conserva observaciones seleccionadas y estadísticas derivadas devueltas por el origen configurado.',
                'Tu navegador, la infraestructura de ClashPanel y los proveedores de servicios pueden recopilar automáticamente información técnica cuando accedes al sitio.'
            ]],
            ['Finalidades y bases legales', [
                'Procesamos datos de cuenta, Planner y Clan Family para proporcionar las funciones solicitadas, mantener tu cuenta y prestar el servicio ClashPanel.',
                'Podemos procesar datos técnicos y de seguridad limitados cuando sean necesarios para intereses legítimos como proteger cuentas, evitar abusos, solucionar fallos y mantener la fiabilidad del servicio, teniendo en cuenta los derechos e intereses de los usuarios.',
                'Cuando la ley exige consentimiento, se utiliza para cookies publicitarias opcionales, almacenamiento local o finalidades publicitarias relacionadas. Puedes retirar el consentimiento mediante los controles disponibles sin afectar al tratamiento realizado antes de retirarlo.',
                'También podemos procesar información cuando sea necesario para cumplir obligaciones legales o para formular, ejercer o defender reclamaciones.'
            ]],
            ['Proveedores y uso compartido de datos', [
                'ClashPanel no vende datos personales. La información solo se comparte cuando es necesaria para prestar el servicio, cumplir la ley, proteger el servicio o cuando tú lo indicas.',
                'Los proveedores de infraestructura y aplicación pueden incluir Supabase para autenticación y datos de aplicación, Google Cloud para alojamiento del backend, Cloudflare para entrega y seguridad del sitio, Google para inicio de sesión o fuentes, servicios de Supercell para datos actuales de la API de Clash of Clans y ClashKing V2 para solicitudes históricas de Advanced Stats.',
                'Cuando se solicita Advanced Stats histórico, la etiqueta del jugador vinculado y el alcance histórico solicitado pueden enviarse a ClashKing V2. Ese proveedor externo puede conservar o devolver registros históricos según sus propias condiciones de servicio; ClashPanel no controla su conservación, disponibilidad o integridad.',
                'ClashPanel usa o puede usar Google AdSense en determinadas páginas. Google y sus socios publicitarios pueden recibir datos como dirección IP, URL de la página, información del navegador o dispositivo, cookies, identificadores de almacenamiento local e interacciones con anuncios.'
            ]],
            ['Publicidad de Google', [
                'Proveedores externos, incluido Google, pueden utilizar cookies o tecnologías similares para mostrar, limitar, medir y proteger anuncios. Cuando se permite publicidad personalizada, las cookies publicitarias de Google también pueden mostrar anuncios según visitas a ClashPanel y/o a otros sitios.',
                'Google explica cómo utiliza la información de sitios que usan sus servicios en su información sobre sitios asociados. También puedes controlar la publicidad personalizada mediante la configuración de anuncios de Google.',
                'Para visitantes del EEE, Reino Unido y Suiza, el consentimiento publicitario se gestiona conforme a las opciones presentadas por la solución de gestión del consentimiento configurada y los requisitos aplicables de Google.'
            ]],
            ['Tratamiento internacional', [
                'Algunos proveedores pueden procesar información fuera de Bélgica o del Espacio Económico Europeo. Cuando sea necesario, esos tratamientos y transferencias están sujetos a los mecanismos y garantías aplicables descritos en las condiciones y documentos de privacidad de los proveedores.',
                'Como ClashPanel depende de infraestructura externa, la ubicación exacta del tratamiento puede variar según el proveedor y el servicio.'
            ]],
            ['Conservación', [
                'Los datos de cuenta y aplicación se conservan mientras sean necesarios para prestar el servicio o hasta que se eliminen, sujetos a requisitos de seguridad, copias de respaldo, resolución de disputas y obligaciones legales.',
                'En Advanced Stats, pausar o detener el seguimiento impide futuras recopilaciones programadas y conserva el historial ya almacenado. La acción de eliminación de Advanced Stats elimina el seguimiento y su historial de ClashPanel y restablece el progreso de logros derivado exclusivamente del seguimiento; no elimina registros que ya conserve un proveedor externo como ClashKing V2. Los datos de aplicación de Advanced Stats de la cuenta propietaria también se eliminan al borrar esa cuenta. Las copias de seguridad o conservadas por motivos legales pueden seguir otros plazos.',
                'Los registros técnicos, datos en caché e información de autenticación pueden tener plazos más cortos según las necesidades operativas y el proveedor correspondiente. Los datos que ya no sean necesarios deben eliminarse o anonimizarse cuando sea razonablemente posible.'
            ]],
            ['Tus derechos de privacidad', [
                `Según la ley aplicable, puedes tener derechos de acceso, corrección, supresión, limitación, oposición, portabilidad y retirada del consentimiento. Envía solicitudes a ${SUPPORT_EMAIL}. Puede ser necesario verificar que la solicitud corresponde a tu cuenta antes de actuar.`,
                'También tienes derecho a presentar una reclamación ante la autoridad de protección de datos competente. Para usuarios de Bélgica, es la Autoridad de Protección de Datos belga. Esta política no limita derechos legales obligatorios.'
            ]],
            ['Seguridad', [
                'ClashPanel usa medidas como credenciales del lado del servidor, sesiones autenticadas, controles de acceso y protecciones de base de datos. Sin embargo, ningún sitio, red o sistema de almacenamiento puede garantizar seguridad absoluta.',
                'No envíes contraseñas, tokens de acceso, códigos de verificación ni otros secretos de autenticación por correo electrónico.'
            ]],
            ['Cambios en esta política', [
                'Esta política puede actualizarse cuando cambien las funciones, la publicidad, los proveedores, los requisitos legales o las prácticas de datos. La fecha mostrada arriba identifica la última versión publicada.'
            ]]
        ]),
        links: Object.freeze([
            ['Contacto de privacidad', `mailto:${SUPPORT_EMAIL}?subject=Solicitud%20de%20privacidad%20ClashPanel`],
            ['Cómo usa Google los datos de sitios asociados', 'https://policies.google.com/technologies/partner-sites'],
            ['Configuración de anuncios de Google', 'https://adssettings.google.com/']
        ])
    }),
    cookies: Object.freeze({
        title: 'Política de cookies',
        description: 'Cookies, almacenamiento local, tecnologías publicitarias y opciones de consentimiento usadas por ClashPanel.',
        summary: 'ClashPanel utiliza tecnologías esenciales del navegador para el servicio y puede usar tecnologías publicitarias de Google en páginas donde hay anuncios.',
        sections: Object.freeze([
            ['Ámbito de esta política', [
                'Esta política cubre cookies, almacenamiento local, IndexedDB y tecnologías similares usadas directamente por ClashPanel o por servicios externos cargados mediante ClashPanel.',
                'Algunas tecnologías son necesarias para las funciones solicitadas. Otras, especialmente las publicitarias, pueden requerir consentimiento según tu ubicación y su finalidad.'
            ]],
            ['Cookies esenciales de autenticación', [
                'ClashPanel usa cookies HttpOnly de autenticación como ct_access y ct_refresh para mantener las sesiones iniciadas. También pueden usarse cookies temporales durante el inicio de sesión con Google.',
                'Las cookies de autenticación son necesarias para las funciones de cuenta. Cerrar sesión o borrar los datos relevantes del navegador puede eliminar o invalidar la información de sesión.'
            ]],
            ['Almacenamiento local e IndexedDB', [
                'El almacenamiento local puede recordar preferencias de interfaz como idioma, tema y contexto seleccionado de ClashPanel. IndexedDB puede guardar respuestas recientes en caché para mejorar la carga y reducir solicitudes repetidas.',
                'Puedes borrar el almacenamiento del navegador desde su configuración. Esto puede restablecer preferencias o caché, pero no elimina por sí solo los registros de cuenta almacenados en el servidor.'
            ]],
            ['Google AdSense y tecnologías publicitarias', [
                'Determinadas páginas de ClashPanel incluyen o pueden incluir Google AdSense. Proveedores externos, incluido Google, pueden colocar o leer cookies o usar tecnologías similares, direcciones IP y otros identificadores para mostrar anuncios, controlar su frecuencia, medir el rendimiento y detectar fraude o abuso.',
                'Cuando se permite publicidad personalizada, las cookies publicitarias pueden seleccionar anuncios según visitas anteriores a ClashPanel y/o a otros sitios. Si no se permite, todavía pueden mostrarse anuncios contextuales o no personalizados y usarse almacenamiento o identificadores limitados cuando esté permitido.',
                'Google ofrece información sobre cómo usa datos de sitios asociados y una configuración para controlar la publicidad personalizada.'
            ]],
            ['Consentimiento y cambio de elección', [
                'Cuando la ley aplicable exige consentimiento, la interfaz de consentimiento publicitario o plataforma de gestión determina si se permiten el almacenamiento y las finalidades publicitarias opcionales.',
                'Puedes rechazar o retirar el consentimiento opcional sin perder acceso al servicio principal de ClashPanel. También puedes borrar o bloquear cookies desde el navegador, aunque bloquear almacenamiento esencial puede impedir que algunas funciones de cuenta funcionen correctamente.'
            ]],
            ['Otros recursos externos', [
                'ClashPanel puede cargar servicios como Google Fonts o inicio de sesión con Google. Las solicitudes a servicios externos pueden revelarles información técnica como dirección IP, datos del navegador y el recurso solicitado.',
                'Los proveedores externos procesan información conforme a sus propias condiciones de privacidad, además de las opciones y protecciones descritas aquí.'
            ]],
            ['Cambios', [
                'Las tecnologías usadas por ClashPanel pueden cambiar con las funciones, la publicidad y los proveedores. Esta política se actualizará cuando cambien de forma importante las prácticas de cookies o almacenamiento.'
            ]]
        ]),
        links: Object.freeze([
            ['Cómo usa Google los datos de sitios asociados', 'https://policies.google.com/technologies/partner-sites'],
            ['Configuración de anuncios de Google', 'https://adssettings.google.com/'],
            ['Contacto de privacidad', `mailto:${SUPPORT_EMAIL}?subject=Pregunta%20sobre%20cookies%20o%20privacidad%20ClashPanel`]
        ])
    }),
    terms: Object.freeze({
        title: 'Condiciones de uso',
        description: 'Condiciones que regulan el acceso a ClashPanel y su uso responsable.',
        summary: 'Al usar ClashPanel aceptas utilizar el servicio de forma responsable y conforme a estas condiciones y a la legislación aplicable.',
        sections: Object.freeze([
            ['Acerca de ClashPanel', [
                'ClashPanel es una herramienta no oficial creada por fans para organizar y planificar actividades de Clash of Clans. ClashPanel no está afiliado, aprobado ni patrocinado por Supercell.',
                'Las referencias a Clash of Clans, Supercell y contenido relacionado siguen siendo propiedad de sus respectivos titulares y el uso de contenido de fans está sujeto a las políticas aplicables de Supercell.'
            ]],
            ['Uso del servicio', [
                'Puedes usar ClashPanel para fines personales legales o de organización de clan. Eres responsable de la actividad realizada mediante tu cuenta y de proteger tus métodos de inicio de sesión.',
                'No intentes acceder a datos sin autorización, eludir seguridad o límites de uso, interferir con el servicio, crear tráfico automatizado abusivo, extraer datos de forma dañina, distribuir malware, suplantar a otros ni usar ClashPanel para facilitar trampas, compraventa de cuentas o actividades ilegales.',
                'No debes usar el servicio de forma que infrinja la ley aplicable, derechos de terceros, reglas de Supercell o políticas aplicables al juego o API subyacentes.'
            ]],
            ['Cuentas y acceso', [
                'Eres responsable de proporcionar información correcta cuando sea necesaria y de mantener el control de tu cuenta. Nunca compartas tokens de autenticación ni códigos de verificación.',
                'ClashPanel puede limitar, suspender o cancelar el acceso cuando sea razonablemente necesario para proteger a usuarios o infraestructura, investigar abusos, cumplir la ley o abordar una infracción grave de estas condiciones.'
            ]],
            ['Tu contenido y datos de Clan Family', [
                'Sigues siendo responsable de los nombres de planes, contenido de Clan Family, encuestas, datos importados de hojas de cálculo y otra información enviada. No envíes información confidencial que no puedas compartir, material ilegal ni contenido que infrinja derechos ajenos.',
                'Concedes a ClashPanel únicamente el permiso razonablemente necesario para almacenar, procesar, copiar y mostrar el contenido enviado con el fin de operar, proteger y mejorar las funciones que eliges usar.'
            ]],
            ['Datos del juego y de terceros', [
                'La información pública actual de jugadores y clanes puede proceder de la API oficial de Clash of Clans, mientras que los datos históricos de battlelog, ataques de guerra y battlelog clasificatorio usados por Advanced Stats pueden proceder de ClashKing V2. Los datos externos pueden retrasarse, estar incompletos, no disponibles o cambiar por decisión de su proveedor, y los datos de ClashKing V2 pueden reflejar observaciones conservadas anteriormente en lugar de un registro completo en tiempo real.',
                'Advanced Stats es una función de seguimiento histórico que se activa voluntariamente para cuentas vinculadas. Comienza con los datos disponibles cuando se activa y no promete reconstruir el historial completo anterior. Cuando el battlelog de origen no incluye una hora o un identificador duradero, ClashPanel puede usar la hora de primera observación y el contenido estable del ataque para representar y deduplicar la observación disponible. Las interrupciones conocidas se muestran como posibles lagunas y no como datos completos.',
                'Pausar o detener Advanced Stats impide futuras recopilaciones programadas y conserva el historial existente. La acción de eliminación de Advanced Stats elimina el seguimiento y su historial guardado de ClashPanel y restablece el progreso de logros derivado exclusivamente del seguimiento; no elimina los registros que ya conserve un proveedor externo.',
                'Las sugerencias del Planner, predicciones, información de estado o datos importados deben revisarse antes de usarlos para tomar decisiones de clan.'
            ]],
            ['Publicidad y servicios externos', [
                'ClashPanel puede mostrar publicidad de terceros, incluido Google AdSense. Un anuncio no significa que ClashPanel recomiende al anunciante, producto o sitio externo.',
                'Los servicios y enlaces externos se rigen por sus propias condiciones y prácticas de privacidad. ClashPanel no es responsable del contenido o transacciones ofrecidos exclusivamente por un tercero independiente.'
            ]],
            ['Disponibilidad y cambios', [
                'ClashPanel puede añadir, modificar o eliminar funciones y limitar temporalmente la disponibilidad por mantenimiento, seguridad, capacidad, motivos legales o problemas de servicios externos.',
                'El servicio se ofrece sin promesa de disponibilidad ininterrumpida o sin errores. Nada de estas condiciones excluye garantías o derechos que legalmente no puedan excluirse.'
            ]],
            ['Responsabilidad', [
                'En la medida permitida por la ley aplicable, ClashPanel no es responsable de pérdidas indirectas derivadas únicamente de APIs externas no disponibles, datos de juego inexactos, contenido creado por usuarios o decisiones tomadas con resultados del Planner. Esto no limita responsabilidades cuando la ley no permite dicha limitación.',
                'Sigues siendo responsable de conservar tus propias copias de información importante y de comprobar las acciones del juego antes de realizarlas.'
            ]],
            ['Privacidad', [
                'El uso de ClashPanel también está sujeto a la Política de privacidad y la Política de cookies, que explican el tratamiento de datos, las tecnologías publicitarias y las opciones del usuario.'
            ]],
            ['Cambios y ley aplicable', [
                'Estas condiciones pueden actualizarse cuando cambien el servicio o los requisitos legales. Los cambios importantes se aplicarán desde la publicación de la nueva versión o desde una fecha posterior indicada junto con la actualización.',
                'Estas condiciones se rigen por la legislación belga en la medida permitida por la ley aplicable. Si eres consumidor, se mantienen las protecciones y derechos obligatorios de la legislación de tu país de residencia.'
            ]],
            ['Contacto', [
                `Las preguntas sobre estas condiciones pueden enviarse a ${SUPPORT_EMAIL}.`
            ]]
        ]),
        links: Object.freeze([
            ['Contactar con ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=Pregunta%20sobre%20condiciones%20de%20ClashPanel`],
            ['Política de contenido de fans de Supercell', 'https://supercell.com/en/fan-content-policy/']
        ])
    }),
    contact: Object.freeze({
        title: 'Contacto',
        description: 'Contacta con ClashPanel por correo para soporte, privacidad, seguridad y preguntas generales.',
        summary: `El método de contacto oficial de ClashPanel es el correo electrónico: ${SUPPORT_EMAIL}.`,
        sections: Object.freeze([
            ['Soporte por correo', [
                `Para errores, solicitudes de funciones, preguntas de cuenta, solicitudes de privacidad, preguntas sobre AdSense o publicidad y consultas generales, escribe a ${SUPPORT_EMAIL}.`,
                'Para informar de un error, incluye la página afectada, lo que esperabas, lo que ocurrió y cualquier mensaje útil del navegador. Elimina información privada de las capturas antes de enviarlas.'
            ]],
            ['Solicitudes de privacidad y cuenta', [
                'Para acceso, corrección, eliminación u otras solicitudes de privacidad, explica lo que solicitas y qué correo de cuenta está afectado. Puede ser necesaria una verificación adicional antes de modificar o revelar datos relacionados con la cuenta.',
                'Nunca envíes contraseñas, tokens de acceso, tokens de actualización, códigos de verificación ni otros secretos de autenticación por correo.'
            ]],
            ['Informes de seguridad', [
                'Si crees haber encontrado un problema de seguridad, describe el problema y los pasos mínimos para reproducirlo. No accedas, modifiques ni publiques datos de otros usuarios para demostrar una vulnerabilidad.'
            ]]
        ]),
        links: Object.freeze([
            ['Enviar correo a ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=Contacto%20ClashPanel`]
        ]),
        feedback: Object.freeze({
            title: 'Enviar comentarios',
            category: 'Categoría',
            feature: 'Solicitud de función',
            other: 'Otro',
            page: 'Página',
            description: 'Descripción',
            email: 'Correo de respuesta (opcional)',
            screenshot: 'Captura de pantalla (opcional, máximo 500 KB)',
            privacy: 'Usamos estos datos solo para gestionar tu informe. No compartas contraseñas, tokens ni otros secretos.',
            send: 'Enviar comentarios',
            sending: 'Enviando…',
            sent: 'Gracias. Hemos recibido tu informe.',
            failed: 'No se pudieron enviar los comentarios.',
            honeypot: 'Deja este campo vacío',
            imageError: 'Elige una imagen de menos de 500 KB.',
            readError: 'No se pudo leer la captura de pantalla.'
        })
    })
});
