package Java.achievements;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BaseDataMetricsTest {
    @Test
    void extractsWeightedCountsTimersWallsAndModules() {
        JsonObject payload = JsonParser.parseString("""
                {
                  "tag":"#LQURPQJ0Y",
                  "timestamp":1786035596,
                  "buildings":[
                    {"data":1000010,"lvl":18,"cnt":300},
                    {"data":1000013,"lvl":16,"gear_up":1},
                    {"data":1000013,"lvl":16,"cnt":3},
                    {"data":1000001,"lvl":17,"weapon":3},
                    {"data":1000026,"lvl":12,"timer":600},
                    {"data":1000097,"types":[{"modules":[{"data":1,"lvl":1},{"data":2,"lvl":2}]}]}
                  ],
                  "traps":[
                    {"data":12000000,"lvl":10,"timer":50},
                    {"data":12000000,"lvl":10,"cnt":2}
                  ],
                  "units":[{"data":4000000,"lvl":12}],
                  "heroes":[{"data":28000000,"lvl":100}],
                  "equipment":[{"data":90000000,"lvl":18}],
                  "buildings2":[
                    {"data":1000033,"lvl":8,"cnt":180},
                    {"data":1000034,"lvl":10,"cnt":1}
                  ]
                }
                """).getAsJsonObject();

        Map<String, Long> metrics = BaseDataMetrics.extract(payload);

        assertEquals(300L, metrics.get("home_wall_count"));
        assertEquals(5400L, metrics.get("home_wall_level_sum"));
        assertEquals(7L, metrics.get("home_building_count"));
        assertEquals(4L, metrics.get("home_building_distinct_count"));
        assertEquals(93L, metrics.get("home_building_level_sum"));

        assertEquals(180L, metrics.get("builder_wall_count"));
        assertEquals(1440L, metrics.get("builder_wall_level_sum"));
        assertEquals(1L, metrics.get("builder_building_count"));
        assertEquals(1L, metrics.get("builder_building_distinct_count"));
        assertEquals(10L, metrics.get("builder_building_level_sum"));

        assertEquals(2L, metrics.get("active_upgrade_count"));
        assertEquals(1L, metrics.get("gear_up_count"));
        assertEquals(3L, metrics.get("townhall_weapon_level"));
        assertEquals(2L, metrics.get("defense_module_count"));
        assertEquals(3L, metrics.get("defense_module_level_sum"));
    }
}
