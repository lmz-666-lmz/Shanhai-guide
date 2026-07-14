package com.shanhai.guide.service;

import com.shanhai.guide.entity.TAdmin;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class AdminTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private final ConcurrentMap<String, AdminToken> tokens = new ConcurrentHashMap<>();
    private final Duration tokenTtl;

    public AdminTokenService(@Value("${app.admin-token.ttl-hours:8}") long ttlHours) {
        this.tokenTtl = Duration.ofHours(Math.max(1, ttlHours));
    }

    public String issueToken(TAdmin admin) {
        cleanupExpired();
        String token;
        do {
            token = generateToken();
        } while (tokens.containsKey(token));

        tokens.put(token, new AdminToken(admin.getId(), admin.getUsername(), Instant.now().plus(tokenTtl)));
        return token;
    }

    public boolean isValid(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        AdminToken adminToken = tokens.get(token);
        if (adminToken == null) {
            return false;
        }
        if (adminToken.expiresAt().isBefore(Instant.now())) {
            tokens.remove(token);
            return false;
        }
        return true;
    }

    public Optional<Instant> getExpiresAt(String token) {
        AdminToken adminToken = tokens.get(token);
        if (adminToken == null || adminToken.expiresAt().isBefore(Instant.now())) {
            return Optional.empty();
        }
        return Optional.of(adminToken.expiresAt());
    }

    public void revoke(String token) {
        if (token != null && !token.isBlank()) {
            tokens.remove(token);
        }
    }

    public Long getAdminId(String token) {
        AdminToken adminToken = tokens.get(token);
        if (adminToken == null || adminToken.expiresAt().isBefore(Instant.now())) {
            return null;
        }
        return adminToken.adminId();
    }

    public String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null) {
            return null;
        }
        String prefix = "Bearer ";
        if (!authorizationHeader.startsWith(prefix)) {
            return null;
        }
        String token = authorizationHeader.substring(prefix.length()).trim();
        return token.isBlank() ? null : token;
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        tokens.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private record AdminToken(Long adminId, String username, Instant expiresAt) {
    }
}
