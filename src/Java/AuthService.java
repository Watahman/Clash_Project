package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

public final class AuthService {
    private static final String ACCESS_COOKIE = "ct_access";
    private static final String REFRESH_COOKIE = "ct_refresh";
    private static final String GOOGLE_VERIFIER_COOKIE = "ct_google_verifier";
    private static final String GOOGLE_NEXT_COOKIE = "ct_google_next";
    private static final long GOOGLE_FLOW_MAX_AGE_SECONDS = 10 * 60L;
    private static final int MAX_COOKIE_HEADER_LENGTH = 32_768;

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    private final Config config;

    public AuthService(Config config) {
        this.config = config;
    }

    public JsonObject signIn(HttpExchange exchange, String email, String password) throws Exception {
        JsonObject payload = new JsonObject();
        payload.addProperty("email", email);
        payload.addProperty("password", password);

        JsonObject authResponse = sendJson(
                "POST",
                "/auth/v1/token?grant_type=password",
                payload,
                null
        );
        SessionData session = requireSessionData(authResponse);
        writeSessionCookies(exchange, session);
        return publicAuthResponse(session.user(), session.expiresAt());
    }

    public JsonObject signUp(HttpExchange exchange, String name, String email, String password) throws Exception {
        JsonObject metadata = new JsonObject();
        metadata.addProperty("display_name", name);

        JsonObject payload = new JsonObject();
        payload.addProperty("email", email);
        payload.addProperty("password", password);
        payload.add("data", metadata);

        String path = "/auth/v1/signup";
        String redirectUrl = config.getAuthEmailConfirmationRedirectUrl();
        if (!redirectUrl.isBlank()) path += "?redirect_to=" + encode(redirectUrl);

        JsonObject authResponse = sendJson("POST", path, payload, null);
        SessionData session = optionalSessionData(authResponse);
        JsonObject user = extractUser(authResponse);

        if (session != null) {
            writeSessionCookies(exchange, session);
            user = session.user();
        }

        JsonObject result = new JsonObject();
        result.add("user", user == null ? JsonNull.INSTANCE : user.deepCopy());
        if (session == null) {
            result.add("session", JsonNull.INSTANCE);
        } else {
            result.add("session", publicSession(session.user(), session.expiresAt()));
        }
        return result;
    }

    public JsonObject currentSession(HttpExchange exchange) throws Exception {
        SessionData session = resolveSession(exchange, true);
        return publicAuthResponse(session.user(), session.expiresAt());
    }

    public void requestPasswordReset(String email) throws Exception {
        JsonObject payload = new JsonObject();
        payload.addProperty("email", email);

        String path = "/auth/v1/recover";
        String redirectUrl = config.getAuthPasswordResetRedirectUrl();
        if (!redirectUrl.isBlank()) path += "?redirect_to=" + encode(redirectUrl);

        sendJson("POST", path, payload, null);
    }

    public String startGoogleOAuth(HttpExchange exchange, String requestedNext) throws Exception {
        ensureGoogleProviderEnabled();
        OAuthPkce.Flow flow = OAuthPkce.create();
        String destination = OAuthPkce.sanitizeNext(requestedNext);
        addOAuthFlowCookie(exchange, GOOGLE_VERIFIER_COOKIE, flow.verifier(), GOOGLE_FLOW_MAX_AGE_SECONDS);
        addOAuthFlowCookie(
                exchange,
                GOOGLE_NEXT_COOKIE,
                Base64.getUrlEncoder().withoutPadding().encodeToString(destination.getBytes(StandardCharsets.UTF_8)),
                GOOGLE_FLOW_MAX_AGE_SECONDS
        );

        return config.getSupabaseUrl()
                + "/auth/v1/authorize?provider=google"
                + "&redirect_to=" + encode(config.getAuthGoogleCallbackUrl())
                + "&code_challenge=" + encode(flow.challenge())
                + "&code_challenge_method=s256";
    }

    public String completeGoogleOAuth(HttpExchange exchange, String authCode) throws Exception {
        String verifier = readCookie(exchange, GOOGLE_VERIFIER_COOKIE);
        String destination = decodeNextCookie(readCookie(exchange, GOOGLE_NEXT_COOKIE));
        if (authCode == null || authCode.isBlank() || verifier.isBlank()) {
            clearGoogleFlowCookies(exchange);
            throw new HttpException(
                    400,
                    "{\"error\":\"Google-aanmelding is verlopen\",\"code\":\"GOOGLE_AUTH_FLOW_EXPIRED\"}"
            );
        }

        try {
            JsonObject payload = new JsonObject();
            payload.addProperty("auth_code", authCode);
            payload.addProperty("code_verifier", verifier);
            JsonObject authResponse = sendJson("POST", "/auth/v1/token?grant_type=pkce", payload, null);
            SessionData session = requireSessionData(authResponse);
            writeSessionCookies(exchange, session);
            return destination;
        } finally {
            clearGoogleFlowCookies(exchange);
        }
    }

    public void clearGoogleFlowCookies(HttpExchange exchange) {
        addOAuthFlowCookie(exchange, GOOGLE_VERIFIER_COOKIE, "", 0);
        addOAuthFlowCookie(exchange, GOOGLE_NEXT_COOKIE, "", 0);
    }

    private void ensureGoogleProviderEnabled() throws Exception {
        JsonObject settings = sendJson("GET", "/auth/v1/settings", null, null);
        JsonElement external = settings.get("external");
        boolean enabled = external != null
                && external.isJsonObject()
                && external.getAsJsonObject().has("google")
                && external.getAsJsonObject().get("google").getAsBoolean();
        if (!enabled) {
            throw new HttpException(
                    503,
                    "{\"error\":\"Google-login is nog niet ingeschakeld in Supabase\",\"code\":\"GOOGLE_AUTH_NOT_CONFIGURED\"}"
            );
        }
    }

    private String decodeNextCookie(String encoded) {
        if (encoded == null || encoded.isBlank()) return OAuthPkce.sanitizeNext("");
        try {
            String value = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
            return OAuthPkce.sanitizeNext(value);
        } catch (IllegalArgumentException invalidCookie) {
            return OAuthPkce.sanitizeNext("");
        }
    }

    public JsonObject changePassword(
            HttpExchange exchange,
            String currentPassword,
            String newPassword
    ) throws Exception {
        SessionData existingSession = resolveSession(exchange, true);
        String email = readString(existingSession.user(), "email");
        if (email.isBlank()) {
            throw new HttpException(
                    400,
                    "{\"error\":\"Geen e-mailadres gevonden voor deze sessie\",\"code\":\"AUTH_EMAIL_MISSING\"}"
            );
        }

        JsonObject verificationPayload = new JsonObject();
        verificationPayload.addProperty("email", email);
        verificationPayload.addProperty("password", currentPassword);
        JsonObject verifiedLogin = sendJson(
                "POST",
                "/auth/v1/token?grant_type=password",
                verificationPayload,
                null
        );
        SessionData verifiedSession = requireSessionData(verifiedLogin);

        JsonObject updatePayload = new JsonObject();
        updatePayload.addProperty("password", newPassword);
        updatePayload.addProperty("current_password", currentPassword);
        sendJson("PUT", "/auth/v1/user", updatePayload, verifiedSession.accessToken());

        JsonObject newLoginPayload = new JsonObject();
        newLoginPayload.addProperty("email", email);
        newLoginPayload.addProperty("password", newPassword);
        JsonObject newLogin = sendJson(
                "POST",
                "/auth/v1/token?grant_type=password",
                newLoginPayload,
                null
        );
        SessionData newSession = requireSessionData(newLogin);
        writeSessionCookies(exchange, newSession);
        return publicAuthResponse(newSession.user(), newSession.expiresAt());
    }

    public void signOut(HttpExchange exchange) {
        String accessToken = readCookie(exchange, ACCESS_COOKIE);
        try {
            if (!accessToken.isBlank()) {
                sendWithoutBody("POST", "/auth/v1/logout?scope=local", accessToken);
            }
        } catch (Exception ignored) {
            // Lokale cookies worden altijd gewist, ook wanneer Supabase tijdelijk niet bereikbaar is.
        } finally {
            clearSessionCookies(exchange);
        }
    }

    public String requireUserId(HttpExchange exchange) throws Exception {
        SessionData session = resolveSession(exchange, true);
        String authUserId = readString(session.user(), "id");
        if (authUserId.isBlank()) throw unauthorized();

        try {
            JsonArray profiles = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "users",
                    "select=id&auth_user_id=" + SUPABASE_Client.eq(authUserId) + "&limit=1"
            )).getAsJsonArray();
            if (!profiles.isEmpty()) return profiles.get(0).getAsJsonObject().get("id").getAsString();

            JsonArray sameIdProfiles = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "users",
                    "select=id&id=" + SUPABASE_Client.eq(authUserId) + "&limit=1"
            )).getAsJsonArray();
            if (!sameIdProfiles.isEmpty()) return authUserId;
        } catch (HttpException profileHttpFailure) {
            throw new HttpException(
                    503,
                    "{\"error\":\"Gebruikersprofiel kan niet worden gevalideerd\",\"code\":\"PROFILE_LOOKUP_FAILED\"}"
            );
        } catch (Exception profileLookupFailure) {
            throw new HttpException(
                    503,
                    "{\"error\":\"Gebruikersprofiel kan niet worden gevalideerd\",\"code\":\"PROFILE_LOOKUP_FAILED\"}"
            );
        }

        throw new HttpException(
                403,
                "{\"error\":\"Gebruikersprofiel is nog niet gekoppeld\",\"code\":\"PROFILE_NOT_LINKED\"}"
        );
    }

    private SessionData resolveSession(HttpExchange exchange, boolean allowRefresh) throws Exception {
        String accessToken = readCookie(exchange, ACCESS_COOKIE);
        String refreshToken = readCookie(exchange, REFRESH_COOKIE);

        if (!accessToken.isBlank()) {
            JsonObject user = fetchUser(accessToken);
            if (user != null) {
                return new SessionData(accessToken, refreshToken, jwtExpiresAt(accessToken), user);
            }
        }

        if (allowRefresh && !refreshToken.isBlank()) {
            try {
                JsonObject payload = new JsonObject();
                payload.addProperty("refresh_token", refreshToken);
                JsonObject refreshed = sendJson(
                        "POST",
                        "/auth/v1/token?grant_type=refresh_token",
                        payload,
                        null
                );
                SessionData session = requireSessionData(refreshed);
                writeSessionCookies(exchange, session);
                return session;
            } catch (HttpException authFailure) {
                int status = authFailure.getStatusCode();
                if (status == 400 || status == 401 || status == 403 || status == 422) {
                    clearSessionCookies(exchange);
                    throw unauthorized();
                }
                throw authFailure;
            }
        }

        clearSessionCookies(exchange);
        throw unauthorized();
    }

    private JsonObject fetchUser(String accessToken) throws Exception {
        HttpResponse<String> response = sendRaw("GET", "/auth/v1/user", null, accessToken);
        if (response.statusCode() == 401 || response.statusCode() == 403) return null;
        ensureSuccess(response);
        return parseObject(response.body());
    }

    private JsonObject sendJson(
            String method,
            String path,
            JsonObject body,
            String accessToken
    ) throws Exception {
        HttpResponse<String> response = sendRaw(method, path, body == null ? null : body.toString(), accessToken);
        ensureSuccess(response);
        if (response.body() == null || response.body().isBlank()) return new JsonObject();
        return parseObject(response.body());
    }

    private void sendWithoutBody(String method, String path, String accessToken) throws Exception {
        HttpResponse<String> response = sendRaw(method, path, null, accessToken);
        ensureSuccess(response);
    }

    private HttpResponse<String> sendRaw(
            String method,
            String path,
            String body,
            String accessToken
    ) throws Exception {
        String supabaseUrl;
        String publishableKey;
        try {
            supabaseUrl = config.getSupabaseUrl();
            publishableKey = config.getSupabasePublishableKey();
        } catch (IllegalStateException configurationError) {
            throw new HttpException(
                    503,
                    "{\"error\":\"Authenticatie is niet geconfigureerd\",\"code\":\"AUTH_NOT_CONFIGURED\"}"
            );
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + path))
                .timeout(Duration.ofSeconds(10))
                .header("apikey", publishableKey)
                .header("Accept", "application/json");

        if (accessToken != null && !accessToken.isBlank()) {
            builder.header("Authorization", "Bearer " + accessToken);
        }

        if (body != null) {
            builder.header("Content-Type", "application/json");
            builder.method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        try {
            return CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new HttpException(
                    503,
                    "{\"error\":\"Authenticatieservice is tijdelijk niet bereikbaar\",\"code\":\"AUTH_PROVIDER_UNAVAILABLE\"}"
            );
        } catch (Exception networkFailure) {
            throw new HttpException(
                    503,
                    "{\"error\":\"Authenticatieservice is tijdelijk niet bereikbaar\",\"code\":\"AUTH_PROVIDER_UNAVAILABLE\"}"
            );
        }
    }

    private void ensureSuccess(HttpResponse<String> response) throws HttpException {
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            System.err.println("Supabase Auth fout: status=" + status);
        }

        if (status >= 200 && status < 300) {
            return;
        }

        String message = "Supabase Auth-verzoek is mislukt.";
        String code = "AUTH_PROVIDER_ERROR";
        try {
            JsonObject error = parseObject(response.body());
            message = firstNonBlank(
                    readString(error, "error_description"),
                    readString(error, "msg"),
                    readString(error, "message"),
                    readString(error, "error"),
                    message
            );
            code = firstNonBlank(readString(error, "code"), readString(error, "error_code"), code);
        } catch (RuntimeException ignored) {
            // Gebruik de veilige standaardmelding.
        }

        int outwardStatus = switch (status) {
            case 400, 401, 403, 422, 429 -> status;
            default -> 502;
        };
        JsonObject safeError = new JsonObject();
        safeError.addProperty("error", message);
        safeError.addProperty("code", code);
        throw new HttpException(outwardStatus, safeError.toString());
    }

    private SessionData requireSessionData(JsonObject response) throws HttpException {
        SessionData session = optionalSessionData(response);
        if (session == null) {
            throw new HttpException(
                    502,
                    "{\"error\":\"Supabase gaf geen geldige sessie terug\",\"code\":\"INVALID_AUTH_RESPONSE\"}"
            );
        }
        return session;
    }

    private SessionData optionalSessionData(JsonObject response) {
        String accessToken = readString(response, "access_token");
        String refreshToken = readString(response, "refresh_token");
        if (accessToken.isBlank() || refreshToken.isBlank()) return null;

        JsonObject user = extractUser(response);
        if (user == null) return null;

        long expiresAt = readLong(response, "expires_at");
        if (expiresAt <= 0) {
            long expiresIn = readLong(response, "expires_in");
            expiresAt = Math.floorDiv(System.currentTimeMillis(), 1000L) + (expiresIn > 0 ? expiresIn : 3600L);
        }
        return new SessionData(accessToken, refreshToken, expiresAt, user);
    }

    private JsonObject extractUser(JsonObject response) {
        JsonElement nestedUser = response.get("user");
        if (nestedUser != null && nestedUser.isJsonObject()) return nestedUser.getAsJsonObject();
        if (response.has("id") && !readString(response, "id").isBlank()) {
            JsonObject user = response.deepCopy();
            for (String field : List.of(
                    "access_token",
                    "refresh_token",
                    "token_type",
                    "expires_in",
                    "expires_at"
            )) {
                user.remove(field);
            }
            return user;
        }
        return null;
    }

    private JsonObject publicAuthResponse(JsonObject user, long expiresAt) {
        JsonObject result = new JsonObject();
        result.add("user", user.deepCopy());
        result.add("session", publicSession(user, expiresAt));
        return result;
    }

    private JsonObject publicSession(JsonObject user, long expiresAt) {
        JsonObject session = new JsonObject();
        session.add("user", user.deepCopy());
        if (expiresAt > 0) session.addProperty("expires_at", expiresAt);
        return session;
    }

    private void writeSessionCookies(HttpExchange exchange, SessionData session) {
        long nowSeconds = Math.floorDiv(System.currentTimeMillis(), 1000L);
        long accessMaxAge = session.expiresAt() > nowSeconds
                ? session.expiresAt() - nowSeconds
                : 3600L;

        addCookie(exchange, ACCESS_COOKIE, session.accessToken(), accessMaxAge);
        addCookie(exchange, REFRESH_COOKIE, session.refreshToken(), config.getAuthRefreshCookieMaxAgeSeconds());
    }

    private void clearSessionCookies(HttpExchange exchange) {
        addCookie(exchange, ACCESS_COOKIE, "", 0);
        addCookie(exchange, REFRESH_COOKIE, "", 0);
    }

    private void addCookie(HttpExchange exchange, String name, String value, long maxAgeSeconds) {
        addCookie(exchange, name, value, maxAgeSeconds, config.getAuthCookieSameSite());
    }

    private void addOAuthFlowCookie(HttpExchange exchange, String name, String value, long maxAgeSeconds) {
        addCookie(exchange, name, value, maxAgeSeconds, "Lax");
    }

    private void addCookie(HttpExchange exchange, String name, String value, long maxAgeSeconds, String sameSite) {
        String safeValue = value == null ? "" : value.replace("\r", "").replace("\n", "");
        StringBuilder cookie = new StringBuilder()
                .append(name).append('=').append(safeValue)
                .append("; Path=/")
                .append("; HttpOnly")
                .append("; SameSite=").append(sameSite)
                .append("; Max-Age=").append(Math.max(0, maxAgeSeconds));
        if (config.isAuthCookieSecure()) cookie.append("; Secure");
        exchange.getResponseHeaders().add("Set-Cookie", cookie.toString());
    }

    private String readCookie(HttpExchange exchange, String cookieName) {
        List<String> headers = exchange.getRequestHeaders().get("Cookie");
        if (headers == null) return "";

        int totalLength = headers.stream().mapToInt(String::length).sum();
        if (totalLength > MAX_COOKIE_HEADER_LENGTH) return "";

        for (String header : headers) {
            for (String part : header.split(";")) {
                String cookie = part.trim();
                int separator = cookie.indexOf('=');
                if (separator <= 0) continue;
                if (cookieName.equals(cookie.substring(0, separator).trim())) {
                    return cookie.substring(separator + 1).trim();
                }
            }
        }
        return "";
    }

    private long jwtExpiresAt(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return 0;
            String payloadPart = parts[1];
            int padding = (4 - payloadPart.length() % 4) % 4;
            payloadPart += "=".repeat(padding);
            String payload = new String(Base64.getUrlDecoder().decode(payloadPart), StandardCharsets.UTF_8);
            return readLong(parseObject(payload), "exp");
        } catch (RuntimeException invalidToken) {
            return 0;
        }
    }

    private JsonObject parseObject(String json) {
        if (json == null || json.isBlank()) return new JsonObject();
        return JsonParser.parseString(json).getAsJsonObject();
    }

    private String readString(JsonObject object, String field) {
        if (object == null) return "";
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull()) return "";
        try {
            return value.getAsString();
        } catch (RuntimeException invalidValue) {
            return "";
        }
    }

    private long readLong(JsonObject object, String field) {
        if (object == null) return 0;
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull()) return 0;
        try {
            return value.getAsLong();
        } catch (RuntimeException invalidValue) {
            return 0;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private HttpException unauthorized() {
        return new HttpException(
                401,
                "{\"error\":\"Authenticatie vereist\",\"code\":\"AUTH_REQUIRED\"}"
        );
    }

    private record SessionData(
            String accessToken,
            String refreshToken,
            long expiresAt,
            JsonObject user
    ) {}
}
