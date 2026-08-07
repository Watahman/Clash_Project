package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser for Clash army share payloads used by the player battle log.
 *
 * Grammar markers follow the current in-game format:
 * u = home army troops, s = home army spells,
 * i = Clan Castle troops, d = Clan Castle spells,
 * h = hero/pet/equipment loadouts.
 *
 * The parser is deliberately strict. A malformed non-empty section throws so a
 * battle can be retained as PARSER_ERROR instead of partially incrementing
 * lifetime counters.
 */
public final class ArmyShareCodeParser {
    private static final int TROOP_BASE_ID = 4_000_000;
    private static final int SPELL_BASE_ID = 26_000_000;
    private static final int HERO_BASE_ID = 2_000_000;
    private static final int PET_BASE_ID = 60_000_000;
    private static final int EQUIPMENT_BASE_ID = 30_000_000;

    private static final Pattern HERO_PATTERN = Pattern.compile(
            "^(\\d+)(?:m\\d+)?(?:p(\\d+))?(?:e(\\d+)(?:_(\\d+))?)?$"
    );
    private static final Pattern ITEM_PATTERN = Pattern.compile("^(\\d+)x(\\d+)$");

    private static final Map<Integer, String> TROOPS = Map.ofEntries(
            Map.entry(0, "Barbarian"),
            Map.entry(1, "Archer"),
            Map.entry(2, "Goblin"),
            Map.entry(3, "Giant"),
            Map.entry(4, "Wall Breaker"),
            Map.entry(5, "Balloon"),
            Map.entry(6, "Wizard"),
            Map.entry(7, "Healer"),
            Map.entry(8, "Dragon"),
            Map.entry(9, "P.E.K.K.A"),
            Map.entry(10, "Minion"),
            Map.entry(11, "Hog Rider"),
            Map.entry(12, "Valkyrie"),
            Map.entry(13, "Golem"),
            Map.entry(15, "Witch"),
            Map.entry(17, "Lava Hound"),
            Map.entry(22, "Bowler"),
            Map.entry(24, "Miner"),
            Map.entry(41, "Baby Dragon"),
            Map.entry(53, "Yeti"),
            Map.entry(58, "Ice Golem"),
            Map.entry(59, "Electro Dragon"),
            Map.entry(65, "Dragon Rider"),
            Map.entry(82, "Headhunter"),
            Map.entry(95, "Electro Titan"),
            Map.entry(97, "Apprentice Warden"),
            Map.entry(109, "Ruin Witch"),
            Map.entry(110, "Root Rider"),
            Map.entry(123, "Druid"),
            Map.entry(132, "Thrower"),
            Map.entry(150, "Furnace"),
            Map.entry(177, "Meteor Golem")
    );

    private static final Map<Integer, String> SUPER_TROOPS = Map.ofEntries(
            Map.entry(26, "Super Barbarian"),
            Map.entry(27, "Super Archer"),
            Map.entry(28, "Super Wall Breaker"),
            Map.entry(29, "Super Giant"),
            Map.entry(55, "Sneaky Goblin"),
            Map.entry(56, "Super Miner"),
            Map.entry(57, "Rocket Balloon"),
            Map.entry(63, "Inferno Dragon"),
            Map.entry(64, "Super Valkyrie"),
            Map.entry(66, "Super Witch"),
            Map.entry(76, "Ice Hound"),
            Map.entry(80, "Super Bowler"),
            Map.entry(81, "Super Dragon"),
            Map.entry(83, "Super Wizard"),
            Map.entry(84, "Super Minion"),
            Map.entry(98, "Super Hog Rider"),
            Map.entry(147, "Super Yeti")
    );

    private static final Map<Integer, String> SIEGES = Map.ofEntries(
            Map.entry(51, "Wall Wrecker"),
            Map.entry(52, "Battle Blimp"),
            Map.entry(62, "Stone Slammer"),
            Map.entry(75, "Siege Barracks"),
            Map.entry(87, "Log Launcher"),
            Map.entry(91, "Flame Flinger"),
            Map.entry(92, "Battle Drill"),
            Map.entry(135, "Troop Launcher"),
            Map.entry(188, "Sky Wagon")
    );

    private static final Map<Integer, String> SPELLS = Map.ofEntries(
            Map.entry(0, "Lightning Spell"),
            Map.entry(1, "Healing Spell"),
            Map.entry(2, "Rage Spell"),
            Map.entry(3, "Jump Spell"),
            Map.entry(5, "Freeze Spell"),
            Map.entry(9, "Poison Spell"),
            Map.entry(10, "Earthquake Spell"),
            Map.entry(11, "Haste Spell"),
            Map.entry(16, "Clone Spell"),
            Map.entry(17, "Skeleton Spell"),
            Map.entry(28, "Bat Spell"),
            Map.entry(35, "Invisibility Spell"),
            Map.entry(53, "Recall Spell"),
            Map.entry(70, "Overgrowth Spell"),
            Map.entry(98, "Revive Spell"),
            Map.entry(109, "Ice Block Spell"),
            Map.entry(120, "Totem Spell"),
            Map.entry(123, "Angry Spell")
    );

    private static final Map<Integer, String> HEROES = Map.ofEntries(
            Map.entry(0, "Barbarian King"),
            Map.entry(1, "Archer Queen"),
            Map.entry(2, "Grand Warden"),
            Map.entry(4, "Royal Champion"),
            Map.entry(6, "Minion Prince"),
            Map.entry(7, "Dragon Duke")
    );

    private static final Map<Integer, String> PETS = Map.ofEntries(
            Map.entry(0, "L.A.S.S.I"),
            Map.entry(1, "Mighty Yak"),
            Map.entry(2, "Electro Owl"),
            Map.entry(3, "Unicorn"),
            Map.entry(4, "Phoenix"),
            Map.entry(7, "Poison Lizard"),
            Map.entry(8, "Diggy"),
            Map.entry(9, "Frosty"),
            Map.entry(10, "Spirit Fox"),
            Map.entry(11, "Angry Jelly"),
            Map.entry(16, "Sneezy"),
            Map.entry(17, "Greedy Raven")
    );

    private static final Map<Integer, String> EQUIPMENT = Map.ofEntries(
            Map.entry(0, "Barbarian Puppet"), Map.entry(1, "Rage Vial"),
            Map.entry(2, "Archer Puppet"), Map.entry(3, "Invisibility Vial"),
            Map.entry(4, "Eternal Tome"), Map.entry(5, "Life Gem"),
            Map.entry(6, "Seeking Shield"), Map.entry(7, "Royal Gem"),
            Map.entry(8, "Earthquake Boots"), Map.entry(9, "Hog Rider Puppet"),
            Map.entry(10, "Giant Gauntlet"), Map.entry(11, "Vampstache"),
            Map.entry(12, "Haste Vial"), Map.entry(13, "Rocket Spear"),
            Map.entry(14, "Spiky Ball"), Map.entry(15, "Frozen Arrow"),
            Map.entry(17, "Giant Arrow"), Map.entry(19, "Heroic Torch"),
            Map.entry(20, "Healer Puppet"), Map.entry(22, "Fireball"),
            Map.entry(24, "Rage Gem"), Map.entry(32, "Snake Bracelet"),
            Map.entry(34, "Healing Tome"), Map.entry(35, "Dark Crown"),
            Map.entry(39, "Magic Mirror"), Map.entry(40, "Electro Boots"),
            Map.entry(41, "Lavaloon Puppet"), Map.entry(42, "Henchmen Puppet"),
            Map.entry(43, "Dark Orb"), Map.entry(44, "Metal Pants"),
            Map.entry(47, "Noble Iron"), Map.entry(48, "Action Figure"),
            Map.entry(49, "Meteor Staff"), Map.entry(50, "Frost Flake"),
            Map.entry(51, "Stick Horse"), Map.entry(52, "Fire Heart"),
            Map.entry(53, "Rocket Backpack"), Map.entry(56, "Stun Blaster"),
            Map.entry(57, "Flame Blower")
    );

    public AdvancedStatsModels.ParsedArmy parse(String rawLinkOrPayload) throws ArmyParseException {
        String payload = extractPayload(rawLinkOrPayload);
        if (payload.isBlank()) throw new ArmyParseException("Army share code is empty");

        List<String> sections = splitSections(payload);
        if (sections.isEmpty()) throw new ArmyParseException("Army share code contains no recognized sections");

        Map<UnitKey, AdvancedStatsModels.UnitUsage> merged = new LinkedHashMap<>();
        for (String section : sections) {
            if (section.length() < 2) throw new ArmyParseException("Army share code contains an empty section");
            char marker = section.charAt(0);
            String body = section.substring(1);
            switch (marker) {
                case 'u' -> parseItems(body, false, false, merged);
                case 's' -> parseItems(body, true, false, merged);
                case 'i' -> parseItems(body, false, true, merged);
                case 'd' -> parseItems(body, true, true, merged);
                case 'h' -> parseHeroes(body, merged);
                default -> throw new ArmyParseException("Unsupported army section: " + marker);
            }
        }

        if (merged.isEmpty()) throw new ArmyParseException("Army share code did not contain usable units");

        List<AdvancedStatsModels.UnitUsage> units = new ArrayList<>(merged.values());
        units.sort(Comparator.comparing((AdvancedStatsModels.UnitUsage unit) -> unit.category().name())
                .thenComparing(AdvancedStatsModels.UnitUsage::unitKey));
        String normalizedJson = normalizedJson(units);
        return new AdvancedStatsModels.ParsedArmy(units, normalizedJson, BattleFingerprint.sha256(normalizedJson), true);
    }

    private void parseItems(String body, boolean spell, boolean clanCastle,
                            Map<UnitKey, AdvancedStatsModels.UnitUsage> merged) throws ArmyParseException {
        if (body.isBlank()) throw new ArmyParseException("Army item section is empty");

        for (String rawEntry : body.split("-")) {
            Matcher matcher = ITEM_PATTERN.matcher(rawEntry);
            if (!matcher.matches()) throw new ArmyParseException("Malformed army item: " + rawEntry);

            int quantity = parsePositive(matcher.group(1), "quantity");
            int relativeId = parseNonNegative(matcher.group(2), "unit id");
            if (spell) {
                int absoluteId = SPELL_BASE_ID + relativeId;
                AdvancedStatsUnitCategory category = clanCastle
                        ? AdvancedStatsUnitCategory.CLAN_CASTLE_SPELL : AdvancedStatsUnitCategory.SPELL;
                String name = SPELLS.get(relativeId);
                merge(merged, usage(stableKey(name == null ? "unknown" : "spell", absoluteId),
                        name == null ? unknownName("spell", absoluteId) : name, category, quantity));
                continue;
            }

            int absoluteId = TROOP_BASE_ID + relativeId;
            String troopName = TROOPS.get(relativeId);
            String superTroopName = SUPER_TROOPS.get(relativeId);
            String siegeName = SIEGES.get(relativeId);
            AdvancedStatsUnitCategory category;
            String name;
            String keyPrefix;

            if (clanCastle) {
                category = AdvancedStatsUnitCategory.CLAN_CASTLE_TROOP;
                name = firstNonNull(siegeName, superTroopName, troopName);
                keyPrefix = name == null ? "unknown" : "troop";
            } else if (siegeName != null) {
                category = AdvancedStatsUnitCategory.SIEGE;
                name = siegeName;
                keyPrefix = "siege";
            } else if (superTroopName != null) {
                category = AdvancedStatsUnitCategory.SUPER_TROOP;
                name = superTroopName;
                keyPrefix = "super_troop";
            } else {
                category = AdvancedStatsUnitCategory.TROOP;
                name = troopName;
                keyPrefix = name == null ? "unknown" : "troop";
            }

            merge(merged, usage(stableKey(keyPrefix, absoluteId),
                    name == null ? unknownName("troop", absoluteId) : name, category, quantity));
        }
    }

    private void parseHeroes(String body, Map<UnitKey, AdvancedStatsModels.UnitUsage> merged)
            throws ArmyParseException {
        if (body.isBlank()) throw new ArmyParseException("Hero section is empty");
        for (String entry : body.split("-")) {
            Matcher matcher = HERO_PATTERN.matcher(entry);
            if (!matcher.matches()) throw new ArmyParseException("Malformed hero loadout: " + entry);

            int heroId = parseNonNegative(matcher.group(1), "hero id");
            addSingle(merged, HEROES, HERO_BASE_ID, heroId, "hero", AdvancedStatsUnitCategory.HERO);
            if (matcher.group(2) != null) addSingle(merged, PETS, PET_BASE_ID,
                    parseNonNegative(matcher.group(2), "pet id"), "pet", AdvancedStatsUnitCategory.PET);
            if (matcher.group(3) != null) addSingle(merged, EQUIPMENT, EQUIPMENT_BASE_ID,
                    parseNonNegative(matcher.group(3), "equipment id"), "equipment", AdvancedStatsUnitCategory.EQUIPMENT);
            if (matcher.group(4) != null) addSingle(merged, EQUIPMENT, EQUIPMENT_BASE_ID,
                    parseNonNegative(matcher.group(4), "equipment id"), "equipment", AdvancedStatsUnitCategory.EQUIPMENT);
        }
    }

    private void addSingle(Map<UnitKey, AdvancedStatsModels.UnitUsage> merged, Map<Integer, String> names,
                           int baseId, int relativeId, String prefix, AdvancedStatsUnitCategory category) {
        int absoluteId = baseId + relativeId;
        String name = names.get(relativeId);
        merge(merged, usage(stableKey(name == null ? "unknown" : prefix, absoluteId),
                name == null ? unknownName(prefix, absoluteId) : name, category, 1));
    }

    private AdvancedStatsModels.UnitUsage usage(String key, String name,
                                                 AdvancedStatsUnitCategory category, int quantity) {
        return new AdvancedStatsModels.UnitUsage(key, name, category, quantity, null);
    }

    private void merge(Map<UnitKey, AdvancedStatsModels.UnitUsage> target,
                       AdvancedStatsModels.UnitUsage incoming) {
        UnitKey key = new UnitKey(incoming.category(), incoming.unitKey());
        AdvancedStatsModels.UnitUsage current = target.get(key);
        if (current == null) {
            target.put(key, incoming);
            return;
        }
        target.put(key, new AdvancedStatsModels.UnitUsage(current.unitKey(), current.unitName(),
                current.category(), Math.addExact(current.quantity(), incoming.quantity()), null));
    }

    private String normalizedJson(List<AdvancedStatsModels.UnitUsage> units) {
        JsonArray array = new JsonArray();
        for (AdvancedStatsModels.UnitUsage unit : units) {
            JsonObject item = new JsonObject();
            item.addProperty("category", unit.category().name());
            item.addProperty("key", unit.unitKey());
            item.addProperty("quantity", unit.quantity());
            array.add(item);
        }
        JsonObject root = new JsonObject();
        root.add("units", array);
        return root.toString();
    }

    private String extractPayload(String rawLinkOrPayload) throws ArmyParseException {
        if (rawLinkOrPayload == null) return "";
        String value = rawLinkOrPayload.trim();
        if (value.isBlank()) return "";
        try {
            URI uri = URI.create(value);
            if (uri.isAbsolute()) {
                String query = uri.getRawQuery();
                if (query != null) {
                    for (String pair : query.split("&")) {
                        int separator = pair.indexOf('=');
                        String key = separator < 0 ? pair : pair.substring(0, separator);
                        if (!"army".equals(URLDecoder.decode(key, StandardCharsets.UTF_8))) continue;
                        String encoded = separator < 0 ? "" : pair.substring(separator + 1);
                        return URLDecoder.decode(encoded, StandardCharsets.UTF_8).trim();
                    }
                }
                throw new ArmyParseException("Army link is missing the army parameter");
            }
        } catch (IllegalArgumentException ignored) {
            // Raw payloads are expected not to be valid absolute URIs.
        }
        return value;
    }

    private List<String> splitSections(String payload) {
        List<String> sections = new ArrayList<>();
        int start = -1;
        for (int index = 0; index < payload.length(); index++) {
            if (!isMarker(payload.charAt(index))) continue;
            if (start >= 0) sections.add(payload.substring(start, index));
            start = index;
        }
        if (start >= 0) sections.add(payload.substring(start));
        return sections;
    }

    private boolean isMarker(char value) {
        return value == 'u' || value == 's' || value == 'i' || value == 'd' || value == 'h';
    }

    private int parsePositive(String raw, String field) throws ArmyParseException {
        int value = parseNonNegative(raw, field);
        if (value <= 0) throw new ArmyParseException(field + " must be positive");
        return value;
    }

    private int parseNonNegative(String raw, String field) throws ArmyParseException {
        try {
            int value = Integer.parseInt(raw);
            if (value < 0) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException invalid) {
            throw new ArmyParseException("Invalid " + field + ": " + raw);
        }
    }

    private String stableKey(String prefix, int absoluteId) { return prefix + "_" + absoluteId; }
    private String unknownName(String type, int absoluteId) { return "Unknown " + type + " (" + absoluteId + ")"; }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) if (value != null) return value;
        return null;
    }

    private record UnitKey(AdvancedStatsUnitCategory category, String key) {}

    public static final class ArmyParseException extends Exception {
        public ArmyParseException(String message) { super(message); }
    }
}
