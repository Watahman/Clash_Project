package Java;

public class HttpException extends Exception {
    private final int statusCode;
    private final String responseBody;
    private final boolean safeToExpose;
    private final String upstream;

    public HttpException(int statusCode, String responseBody) {
        this(statusCode, responseBody, true, "");
    }

    private HttpException(int statusCode, String responseBody, boolean safeToExpose, String upstream) {
        super("HTTP " + statusCode);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.safeToExpose = safeToExpose;
        this.upstream = upstream == null ? "" : upstream;
    }

    public static HttpException upstream(int statusCode, String responseBody, String upstream) {
        return new HttpException(statusCode, responseBody, false, upstream);
    }

    public int getStatusCode() { return statusCode; }
    public String getResponseBody() { return responseBody; }
    public boolean isSafeToExpose() { return safeToExpose; }
    public String getUpstream() { return upstream; }
}
