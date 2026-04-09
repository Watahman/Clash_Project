package Java;

import com.sun.net.httpserver.HttpServer;

public class API_Labels {
    private HttpServer server;
    private Config conf;
    private API_Utils utils;

    public API_Labels(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }


    public void getLabelsPlayers(){
        server.createContext(conf._EXT_LABELS_PLAYERS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/labels/players";
                    String responseText = utils.getClashApiResponse(clashUrl);

                    utils.sendJsonResponse(exchange, responseText, 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    System.out.println("error\":\"Failed to fetch Clash API\"");
                }
            }
        });
    }

    public void getLabelsClans(){
        server.createContext(conf._EXT_LABELS_CLANS, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1); // Preflight response
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String clashUrl = conf._BASE_URL_CLASH + "/labels/clans";
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
