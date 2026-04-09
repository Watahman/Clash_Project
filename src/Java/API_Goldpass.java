package Java;

import com.sun.net.httpserver.HttpServer;

public class API_Goldpass {
    private HttpServer server;
    private Config conf;
    private API_Utils utils;

    public API_Goldpass(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getGoldPassInfo(){
        server.createContext(conf._EXT_GOLDPASS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/goldpass/seasons/current";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }
}
