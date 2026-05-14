package Java;

public class HttpException extends Exception {
    private final int statusCode;
    private final String responseBody;

    public HttpException(int statusCode, String responseBody) {
        super("HTTP " + statusCode);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public int getStatusCode() { return statusCode; }
    public String getResponseBody() { return responseBody; }
}
