package com.shanhai.guide.service.impl;

import com.shanhai.guide.service.TimeProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证活动日期处理使用服务器时钟，不受系统时钟或模型推断影响。
 */
@DisplayName("Activity date handling")
class ActivityDateTest {

    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 7, 14);
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    @BeforeEach
    void setUp() {
        TimeProvider.setClock(Clock.fixed(FIXED_TODAY.atStartOfDay(ZONE).toInstant(), ZONE));
    }

    @AfterEach
    void tearDown() {
        TimeProvider.resetClock();
    }

    @Test
    @DisplayName("1. today() returns fixed date 2026-07-14")
    void todayReturnsFixedDate() {
        assertEquals(FIXED_TODAY, TimeProvider.today());
    }

    @Test
    @DisplayName("2. tomorrow() returns 2026-07-15")
    void tomorrowReturnsNextDay() {
        assertEquals(LocalDate.of(2026, 7, 15), TimeProvider.tomorrow());
    }

    @Test
    @DisplayName("3. Activity on 2026-07-17 is NOT considered today")
    void futureActivityNotToday() {
        LocalDate activityDate = LocalDate.of(2026, 7, 17);
        assertNotEquals(TimeProvider.today(), activityDate);
        assertTrue(activityDate.isAfter(TimeProvider.today()));
    }

    @Test
    @DisplayName("4. Activity on 2026-07-14 IS considered today")
    void todayActivityMatches() {
        LocalDate activityDate = LocalDate.of(2026, 7, 14);
        assertEquals(TimeProvider.today(), activityDate);
    }

    @Test
    @DisplayName("5. Activity before today is NOT today")
    void pastActivityNotToday() {
        LocalDate pastDate = LocalDate.of(2026, 7, 13);
        assertTrue(pastDate.isBefore(TimeProvider.today()));
        assertNotEquals(TimeProvider.today(), pastDate);
    }

    @Test
    @DisplayName("6. todayStart returns start of 2026-07-14 Asia/Shanghai")
    void todayStartCorrect() {
        LocalDateTime expected = LocalDateTime.of(2026, 7, 14, 0, 0);
        assertEquals(expected, TimeProvider.todayStart());
    }

    @Test
    @DisplayName("7. todayEnd returns start of 2026-07-15 (exclusive)")
    void todayEndCorrect() {
        LocalDateTime expected = LocalDateTime.of(2026, 7, 15, 0, 0);
        assertEquals(expected, TimeProvider.todayEnd());
    }

    @Test
    @DisplayName("8. weekStart returns Monday of current week")
    void weekStartCorrect() {
        // 2026-07-14 is Tuesday, Monday is 2026-07-13
        LocalDateTime expected = LocalDateTime.of(2026, 7, 13, 0, 0);
        assertEquals(expected, TimeProvider.weekStart());
    }
}
