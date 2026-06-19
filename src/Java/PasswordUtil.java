package Java;

import at.favre.lib.crypto.bcrypt.BCrypt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

public class PasswordUtil {
    private static final int BCRYPT_COST = 12;

    public static String hashPassword(String password) {
        return BCrypt.withDefaults().hashToString(BCRYPT_COST, password.toCharArray());
    }

    public static boolean verifyPassword(String password, String storedHash) throws Exception {
        if (storedHash == null || storedHash.isBlank()) return false;
        if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
            return BCrypt.verifyer().verify(password.toCharArray(), storedHash).verified;
        }
        return legacySha256(password).equals(storedHash);
    }

    public static boolean isLegacyHash(String storedHash) {
        return storedHash != null && !storedHash.startsWith("$2a$") && !storedHash.startsWith("$2b$") && !storedHash.startsWith("$2y$");
    }

    private static String legacySha256(String password) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        return Base64.getEncoder().encodeToString(md.digest(password.getBytes(StandardCharsets.UTF_8)));
    }
}
