package com.shanhai.guide.service;

import java.time.*;

/**
 * 统一可信时间来源，使用 Asia/Shanghai 时区。
 * 所有"今天/明天/本周"等时间敏感判断必须通过此服务获取日期。
 * 测试中可通过 setClock 注入固定时钟。
 */
public class TimeProvider {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static volatile Clock clock = Clock.system(ZONE);

    public static ZoneId zone() {
        return ZONE;
    }

    public static LocalDate today() {
        return LocalDate.now(clock);
    }

    public static LocalDate tomorrow() {
        return today().plusDays(1);
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    public static LocalDateTime todayStart() {
        return today().atStartOfDay();
    }

    public static LocalDateTime todayEnd() {
        return today().plusDays(1).atStartOfDay();
    }

    /** 本周一 00:00 */
    public static LocalDateTime weekStart() {
        return today().with(DayOfWeek.MONDAY).atStartOfDay();
    }

    /** 本周日 23:59:59.999...（下周一 00:00） */
    public static LocalDateTime weekEnd() {
        return today().with(DayOfWeek.MONDAY).plusWeeks(1).atStartOfDay();
    }

    /** 仅用于测试注入固定时钟 */
    public static void setClock(Clock fixedClock) {
        clock = fixedClock.withZone(ZONE);
    }

    /** 恢复系统时钟 */
    public static void resetClock() {
        clock = Clock.system(ZONE);
    }
}
