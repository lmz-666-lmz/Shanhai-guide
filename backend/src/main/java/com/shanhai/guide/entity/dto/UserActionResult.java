package com.shanhai.guide.entity.dto;

import com.shanhai.guide.entity.TBadge;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class UserActionResult {

    private String message;

    private List<TBadge> newlyUnlockedBadges;

    public static UserActionResult of(String message, List<TBadge> newlyUnlockedBadges) {
        return new UserActionResult(message, newlyUnlockedBadges == null ? List.of() : newlyUnlockedBadges);
    }
}
