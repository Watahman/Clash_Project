import {
    formatLocalizedValue,
    resolveEntityLocale
} from './entity-guesser-value-copy.js?v=20260811-2';

export const ENTITY_GUESSER_HINT_COPY = Object.freeze({
    en: {
        defenses: [
            values => `${values.kind} · targets ${values.targets} · ${values.impact} effect.`,
            values => `${values.coverage} coverage · ${values.feature} · ${values.visibility}.`
        ],
        otherBuildings: [
            values => `${values.kind} building · ${values.system} system.`,
            values => `${values.function} · ${values.footprint} footprint · ${values.countClass} count.`
        ],
        troopsHeroes: [
            values => `${values.kind} · ${values.movement} movement · targets ${values.targets}.`,
            values => `${values.role} role · ${values.attackStyle} attack · favors ${values.favorite}.`
        ],
        spellsEquipment: [
            values => `${values.kind} · ${values.activation} activation · ${values.effect} effect.`,
            values => `${values.role} role · affects ${values.affects} · ${values.origin} source.`
        ],
        fallback: first => `Starts with “${first}”.`
    },
    nl: {
        defenses: [
            values => `${values.kind} · doelen ${values.targets} · ${values.impact}-effect.`,
            values => `${values.coverage}-bereik · ${values.feature} · ${values.visibility}.`
        ],
        otherBuildings: [
            values => `${values.kind}-gebouw · ${values.system}-systeem.`,
            values => `${values.function} · formaat ${values.footprint} · ${values.countClass} aantal.`
        ],
        troopsHeroes: [
            values => `${values.kind} · ${values.movement}-beweging · doelen ${values.targets}.`,
            values => `${values.role}-rol · ${values.attackStyle}-aanval · voorkeur voor ${values.favorite}.`
        ],
        spellsEquipment: [
            values => `${values.kind} · ${values.activation}-activering · ${values.effect}-effect.`,
            values => `${values.role}-rol · beïnvloedt ${values.affects} · bron: ${values.origin}.`
        ],
        fallback: first => `Begint met “${first}”.`
    },
    fr: {
        defenses: [
            values => `${values.kind} · cibles : ${values.targets} · effet ${values.impact}.`,
            values => `Portée ${values.coverage} · ${values.feature} · ${values.visibility}.`
        ],
        otherBuildings: [
            values => `Bâtiment ${values.kind} · système ${values.system}.`,
            values => `${values.function} · format ${values.footprint} · quantité ${values.countClass}.`
        ],
        troopsHeroes: [
            values => `${values.kind} · mouvement ${values.movement} · cibles : ${values.targets}.`,
            values => `Rôle ${values.role} · attaque ${values.attackStyle} · cible favorite : ${values.favorite}.`
        ],
        spellsEquipment: [
            values => `${values.kind} · activation ${values.activation} · effet ${values.effect}.`,
            values => `Rôle ${values.role} · affecte ${values.affects} · source : ${values.origin}.`
        ],
        fallback: first => `Commence par « ${first} ».`
    },
    de: {
        defenses: [
            values => `${values.kind} · Ziele: ${values.targets} · ${values.impact}-Effekt.`,
            values => `${values.coverage}-Reichweite · ${values.feature} · ${values.visibility}.`
        ],
        otherBuildings: [
            values => `${values.kind}-Gebäude · ${values.system}-System.`,
            values => `${values.function} · ${values.footprint}-Größe · ${values.countClass}-Anzahl.`
        ],
        troopsHeroes: [
            values => `${values.kind} · ${values.movement}-Bewegung · Ziele: ${values.targets}.`,
            values => `${values.role}-Rolle · ${values.attackStyle}-Angriff · bevorzugt ${values.favorite}.`
        ],
        spellsEquipment: [
            values => `${values.kind} · ${values.activation}-Aktivierung · ${values.effect}-Effekt.`,
            values => `${values.role}-Rolle · betrifft ${values.affects} · Quelle: ${values.origin}.`
        ],
        fallback: first => `Beginnt mit „${first}“.`
    },
    es: {
        defenses: [
            values => `${values.kind} · objetivos: ${values.targets} · efecto ${values.impact}.`,
            values => `Alcance ${values.coverage} · ${values.feature} · ${values.visibility}.`
        ],
        otherBuildings: [
            values => `Edificio ${values.kind} · sistema ${values.system}.`,
            values => `${values.function} · tamaño ${values.footprint} · cantidad ${values.countClass}.`
        ],
        troopsHeroes: [
            values => `${values.kind} · movimiento ${values.movement} · objetivos: ${values.targets}.`,
            values => `Rol ${values.role} · ataque ${values.attackStyle} · prefiere ${values.favorite}.`
        ],
        spellsEquipment: [
            values => `${values.kind} · activación ${values.activation} · efecto ${values.effect}.`,
            values => `Rol ${values.role} · afecta a ${values.affects} · origen: ${values.origin}.`
        ],
        fallback: first => `Empieza por «${first}».`
    }
});

function hintValues(entity, locale) {
    const text = key => formatLocalizedValue(entity[key], locale);
    const lower = key => text(key).toLocaleLowerCase(locale);
    return {
        kind: text('kind'),
        targets: lower('targets'),
        impact: lower('impact'),
        coverage: lower('coverage'),
        feature: lower('feature'),
        visibility: lower('visibility'),
        system: lower('system'),
        function: text('function'),
        footprint: text('footprint'),
        countClass: lower('countClass'),
        movement: lower('movement'),
        role: text('role'),
        attackStyle: lower('attackStyle'),
        favorite: lower('favorite'),
        activation: lower('activation'),
        effect: lower('effect'),
        affects: lower('affects'),
        origin: lower('origin')
    };
}

export function buildEntityHint(answer, category, hintNumber, locale = 'en') {
    const language = resolveEntityLocale(locale);
    const copy = ENTITY_GUESSER_HINT_COPY[language] || ENTITY_GUESSER_HINT_COPY.en;
    const builders = copy[category.id] || ENTITY_GUESSER_HINT_COPY.en[category.id] || [];
    const builder = builders[Math.max(0, hintNumber - 1)];
    return builder?.(hintValues(answer, language)) || copy.fallback(answer.name.charAt(0));
}
