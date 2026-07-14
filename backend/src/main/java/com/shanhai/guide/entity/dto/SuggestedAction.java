package com.shanhai.guide.entity.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Structured action button returned in AI chat replies.
 * Frontend must call the /api/chat/action endpoint with these fields, never re-send the label as text.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SuggestedAction {

    /** Unique action id for this message — used for idempotency and completion tracking */
    @Builder.Default
    private String actionId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);

    /** Machine-readable action type; every returned type must have a registered executor */
    private ActionType actionType;

    /** Human-readable button label */
    private String label;

    /** Structured payload the executor needs — never empty for actionable types */
    @Builder.Default
    private Map<String, Object> payload = new LinkedHashMap<>();

    // --- Convenience payload accessors ---

    public String payloadString(String key) {
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }

    public Integer payloadInt(String key) {
        Object value = payload.get(key);
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    public Long payloadLong(String key) {
        Object value = payload.get(key);
        if (value instanceof Number n) return n.longValue();
        if (value instanceof String s) {
            try { return Long.parseLong(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    public Double payloadDouble(String key) {
        Object value = payload.get(key);
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public java.util.List<Long> payloadLongList(String key) {
        Object value = payload.get(key);
        if (value instanceof java.util.List<?> list) {
            return list.stream()
                    .map(item -> item instanceof Number n ? n.longValue() : Long.parseLong(item.toString()))
                    .toList();
        }
        return java.util.List.of();
    }

    // --- Factory helpers ---

    public static SuggestedAction of(ActionType type, String label) {
        return SuggestedAction.builder().actionType(type).label(label).build();
    }

    public static SuggestedAction of(ActionType type, String label, Map<String, Object> payload) {
        return SuggestedAction.builder().actionType(type).label(label).payload(payload).build();
    }
}
