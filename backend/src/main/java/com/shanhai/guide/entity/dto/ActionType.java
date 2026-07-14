package com.shanhai.guide.entity.dto;

/**
 * Registered action types for SuggestedAction buttons.
 * Every type returned to the frontend MUST have a corresponding executor in AiServiceImpl.executeAction().
 * Types without executors MUST NOT be returned.
 */
public enum ActionType {

    // --- Route draft lifecycle ---
    /** Execute a confirmed route draft — returns formal route_plan card */
    CONFIRM_ROUTE_DRAFT,
    /** Modify the duration of a pending route draft, then re-present for confirmation */
    MODIFY_ROUTE_DURATION,
    /** Convert a multi-spot route draft into a single-spot navigation */
    CONVERT_TO_SINGLE_SPOT,
    /** Re-select the start point for a pending route draft */
    RESELECT_ROUTE_START,

    // --- Spot recommendations / planning ---
    /** Plan a route connecting the recommended spots (payload carries spotIds) */
    PLAN_RECOMMENDED_SPOTS,
    /** Open a specific spot on the map (no navigation) */
    OPEN_SPOT_ON_MAP,
    /** Start navigation from current location to a specific spot */
    START_SPOT_NAVIGATION,

    // --- Route card actions ---
    /** Open the route on the map view */
    OPEN_ROUTE_ON_MAP,
    /** Start turn-by-turn navigation for a route */
    START_ROUTE_NAVIGATION,
    /** Save/favorite a route */
    FAVORITE_ROUTE,

    // --- Spot card actions ---
    /** Open the PointNarrationPanel for a specific spot */
    ASK_SPOT_INTRO,
    /** Show opening hours / status for a specific spot */
    ASK_OPEN_STATUS,

    // --- Campus facility queries ---
    /** Find the nearest restroom */
    FIND_NEAREST_RESTROOM,
    /** Find the nearest facility by category (cafeteria, parking, clinic, etc.) */
    FIND_NEAREST_FACILITY,

    // --- Current spot / location-based ---
    /** Introduce the nearest spot based on current real/demo/manual location */
    INTRODUCE_CURRENT_SPOT,

    // --- Location context ---
    /** Use the device's real GPS location as the route start */
    USE_CURRENT_LOCATION,
    /** Use the demo/preview location as the route start */
    USE_DEMO_LOCATION,
    /** Let the user pick a start point on the map */
    SELECT_MANUAL_START,

    // --- Generic ---
    /** Continue the conversation with a pre-filled question (not re-interpreted) */
    CONTINUE_QUESTION,

    // --- Legacy/transitional (still supported) ---
    /** Open route card (legacy name) */
    OPEN_ROUTE_CARD,
    /** View spots on map (legacy name) */
    VIEW_SPOTS_ON_MAP,
    /** Adjust route duration (legacy name) */
    ADJUST_DURATION,
    /** View recent activities */
    VIEW_RECENT_ACTIVITIES,
    /** Ask another question */
    ASK_ANOTHER_QUESTION;
}
