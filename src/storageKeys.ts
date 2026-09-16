/** Persistent localStorage keys shared across features (Presets, per-tab saves). */
export const SAVED_AVAILABILITY_KEY = "profile_saved_availability_v1";
export const SAVED_BIO_KEY          = "profile_saved_bio_v1";
export const SAVED_ICON_KEY         = "profile_saved_icon_v1";
export const SAVED_BACKGROUND_KEY   = "profile_saved_background_v1";
export const SAVED_CUSTOM_BACKGROUND_KEY = "profile_saved_custom_background_v1";
export const SAVED_TOKENS_KEY       = "profile_saved_tokens_v1";
export const SAVED_TITLE_KEY        = "profile_saved_title_v1";
export const SAVED_BANNER_ACCENT_KEY = "profile_saved_banner_accent_v1";
export const SAVED_CREST_BORDER_KEY = "profile_saved_crest_border_v1";

// Rank & Challenge Overrides
export const SAVED_RANK_QUEUE_KEY   = "profile_saved_rank_queue_v1";
export const SAVED_RANK_TIER_KEY    = "profile_saved_rank_tier_v1";
export const SAVED_RANK_DIV_KEY     = "profile_saved_rank_div_v1";
export const SAVED_RANK_LP_KEY      = "profile_saved_rank_lp_v1";
export const SAVED_LAST_SEASON_RANK_KEY = "profile_saved_last_season_rank_v1";
export const SAVED_RANK_BORDER_KEY  = "profile_saved_rank_border_v1";
export const SAVED_RANK_BANNER_KEY  = "profile_saved_rank_banner_v1";
export const SAVED_OVERVIEW_CARDS_KEY = "profile_saved_overview_cards_v1";
export const SAVED_CHALLENGE_CRYSTAL_KEY = "profile_saved_challenge_crystal_v1";
export const SAVED_CHALLENGE_POINTS_KEY  = "profile_saved_challenge_points_v1";

// Settings
export const SAVED_ENFORCE_OFFLINE_KEY = "profile_enforce_offline_v1"; // Legacy (will be mapped to auto enforce)
export const SAVED_AUTO_ENFORCE_KEY = "profile_auto_enforce_v1";
export const SAVED_USE_IDLE_AS_BIO_KEY = "profile_use_idle_as_bio_v1";
export const SAVED_WINDOW_SIZE_KEY = "window_size_preset_v1";

// Music Sync
export const MUSIC_BIO_SETTINGS_KEY = "music_bio_settings_v1";

// Icons
export const PROFILE_ICONS_KEY = "profile_icons";
export const ICON_DATA_VERSION_KEY = "icon_data_version";

// Presets (localStorage fallback — also persisted to disk via Tauri)
export const PRESETS_LS_KEY = "profile_presets_list_v1";

// Pengu Loader
export const PENGU_PLUGIN_INSTALLED_KEY = "pengu_plugin_installed_v1";
export const PENGU_OVERVIEW_OVERRIDE_KEY = "pengu_overview_override_v1";
// Theme drafts use their own CSS import/export; the profile importer truncates values.
export const CLIENT_THEME_KEY = "client_theme_v1";

// Analytics (intentionally NOT in ALL_SAVED_KEYS — survives Clear All)
export const ANALYTICS_ID_KEY = "lp_analytics_id";

/** All persistent keys, used for the Clear All Settings feature. */
export const ALL_SAVED_KEYS: string[] = [
    SAVED_AVAILABILITY_KEY,
    SAVED_BIO_KEY,
    SAVED_ICON_KEY,
    SAVED_BACKGROUND_KEY,
    SAVED_CUSTOM_BACKGROUND_KEY,
    SAVED_TOKENS_KEY,
    SAVED_TITLE_KEY,
    SAVED_BANNER_ACCENT_KEY,
    SAVED_CREST_BORDER_KEY,
    SAVED_RANK_QUEUE_KEY,
    SAVED_RANK_TIER_KEY,
    SAVED_RANK_DIV_KEY,
    SAVED_RANK_LP_KEY,
    SAVED_LAST_SEASON_RANK_KEY,
    SAVED_RANK_BORDER_KEY,
    SAVED_RANK_BANNER_KEY,
    SAVED_OVERVIEW_CARDS_KEY,
    SAVED_CHALLENGE_CRYSTAL_KEY,
    SAVED_CHALLENGE_POINTS_KEY,
    SAVED_ENFORCE_OFFLINE_KEY,
    SAVED_AUTO_ENFORCE_KEY,
    SAVED_USE_IDLE_AS_BIO_KEY,
    SAVED_WINDOW_SIZE_KEY,
    MUSIC_BIO_SETTINGS_KEY,
    PROFILE_ICONS_KEY,
    ICON_DATA_VERSION_KEY,
    PRESETS_LS_KEY,
    PENGU_OVERVIEW_OVERRIDE_KEY,
];
