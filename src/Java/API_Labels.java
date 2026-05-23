package Java;

import com.sun.net.httpserver.HttpServer;

public class API_Labels {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public API_Labels(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getLabelsPlayers() {
        server.createContext(conf._EXT_LABELS_PLAYERS, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/labels/players")
        ));
    }

    public void getLabelsClans() {
        server.createContext(conf._EXT_LABELS_CLANS, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/labels/clans")
        ));
    }
}