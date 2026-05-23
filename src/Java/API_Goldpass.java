package Java;

import com.sun.net.httpserver.HttpServer;

public class API_Goldpass {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public API_Goldpass(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getGoldPassInfo() {
        server.createContext(conf._EXT_GOLDPASS, exchange -> utils.handlePost(exchange, ex ->
                utils.clashGet(ex, "/goldpass/seasons/current")
        ));
    }
}