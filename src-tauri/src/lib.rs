mod lcu;
mod themes;
use themes::{list_library_themes, save_library_theme, delete_library_theme};
use themes::{save_client_theme, get_client_theme, read_client_theme_css, clear_client_theme};

use serde_json::json;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

#[derive(Serialize, Deserialize, Clone, Default)]
struct Settings {
    minimize_to_tray: bool,
}

struct AppSettings {
    minimize_to_tray: Mutex<bool>,
    config_path: PathBuf,
    presets_path: PathBuf,
}

impl AppSettings {
    fn load_settings(&self) -> Settings {
        if let Ok(content) = fs::read_to_string(&self.config_path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Settings::default()
        }
    }

    fn save_settings(&self, settings: &Settings) {
        if let Some(parent) = self.config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(settings) {
            let _ = fs::write(&self.config_path, json);
        }
    }
}

#[tauri::command]
fn set_minimize_to_tray(state: tauri::State<AppSettings>, enabled: bool) {
    if let Ok(mut minimize) = state.minimize_to_tray.lock() {
        *minimize = enabled;
    }
    
    // Save to config file
    let settings = Settings {
        minimize_to_tray: enabled,
    };
    state.save_settings(&settings);
}

#[tauri::command]
fn get_minimize_to_tray(state: tauri::State<AppSettings>) -> bool {
    *state.minimize_to_tray.lock().unwrap_or_else(|e| e.into_inner())
}

#[tauri::command]
fn save_presets(state: tauri::State<AppSettings>, data: String) -> Result<(), String> {
    if let Some(parent) = state.presets_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&state.presets_path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_presets(state: tauri::State<AppSettings>) -> Result<String, String> {
    if state.presets_path.exists() {
        fs::read_to_string(&state.presets_path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
async fn get_lcu_connection() -> Result<lcu::LcuInfo, String> {
    lcu::find_lcu_info().ok_or_else(|| "League of Legends is not running or lockfile not found".to_string())
}

fn is_allowed_lcu_request(method: &str, endpoint: &str) -> bool {
    // Exact matches for simple endpoints
    let exact_matches = matches!(
        (method, endpoint),
        ("PUT", "/lol-chat/v1/me")
            | ("PATCH", "/lol-chat/v1/me")
            | ("GET", "/lol-chat/v1/me")
            | ("GET", "/lol-challenges/v1/summary-player-data/local-player")
            | ("GET", "/lol-challenges/v1/challenges/local-player")
            | ("POST", "/lol-challenges/v1/update-player-preferences")
            | ("POST", "/lol-summoner/v1/current-summoner/summoner-profile")
            | ("PUT", "/lol-summoner/v1/current-summoner/summoner-profile")
            | ("GET", "/lol-summoner/v1/current-summoner/summoner-profile")
            | ("GET", "/lol-summoner/v1/current-summoner")
            | ("GET", "/lol-ranked/v1/current-ranked-stats")
            | ("POST", "/lol-lobby/v2/lobby")
            | ("POST", "/lol-lobby/v2/lobby/invitations")
            | ("GET", "/lol-lobby/v2/lobby")
            | ("GET", "/lol-chat/v1/friends")
            | ("GET", "/lol-challenges/v2/titles/local-player")
            | ("GET", "/lol-regalia/v2/current-summoner/regalia")
            | ("PUT", "/lol-regalia/v2/current-summoner/regalia")
    );

    if exact_matches {
        return true;
    }

    // Prefix matches for endpoints with IDs or dynamic paths
    if method == "DELETE" && endpoint.starts_with("/lol-chat/v1/friends/") {
        return true;
    }
    if method == "PUT" && endpoint.starts_with("/lol-summoner/v1/current-summoner/icon") {
        return true;
    }
    if method == "GET" && endpoint.starts_with("/lol-regalia/v3/inventory/") {
        return true;
    }

    false
}

use std::sync::OnceLock;

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .no_proxy()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create LCU client")
    })
}

#[tauri::command]
async fn lcu_request(
    method: String,
    endpoint: String,
    body: Option<serde_json::Value>,
    port: String,
    token: String
) -> Result<serde_json::Value, String> {
    let method = method.trim().to_uppercase();
    let endpoint = endpoint.trim().to_string();
    if endpoint.is_empty() || !endpoint.starts_with('/') || endpoint.contains("..") {
        return Err("Invalid endpoint".to_string());
    }
    if token.trim().is_empty() {
        return Err("Missing token".to_string());
    }
    let port_num = port.parse::<u16>().map_err(|_| "Invalid port".to_string())?;
    if !is_allowed_lcu_request(&method, &endpoint) {
        return Err("Endpoint not allowed".to_string());
    }

    let client = get_client();
    let url = format!("https://127.0.0.1:{}{}", port_num, endpoint);
    let auth = lcu::get_auth_header(&token);

    let mut request = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => return Err("Invalid method".to_string()),
    };

    request = request
        .header(AUTHORIZATION, auth)
        .header(CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json");

    if let Some(b) = body {
        request = request.json(&b);
    }

    let res = request.send().await.map_err(|e| {
        #[cfg(debug_assertions)]
        eprintln!("[LCU] Request Error: {:?} (Source: {:?})", e, std::error::Error::source(&e));
        e.to_string()
    })?;
    
    if res.status().as_u16() == 204 {
        return Ok(json!({"status": "success"}));
    }

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    
    if status.is_success() {
        if text.is_empty() {
            Ok(json!({"status": "success"}))
        } else {
            Ok(serde_json::from_str(&text).unwrap_or_else(|_| json!({"data": text})))
        }
    } else {
        Err(format!("LCU Error {}: {}", status, text))
    }
}

#[tauri::command]
async fn update_bio(port: String, token: String, new_bio: String) -> Result<String, String> {
    lcu_request(
        "PUT".to_string(),
        "/lol-chat/v1/me".to_string(),
        Some(json!({"statusMessage": new_bio})),
        port,
        token
    ).await.map(|_| "Bio updated successfully!".to_string())
}

#[tauri::command]
fn save_logs_to_path(path: String, content: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Missing path".to_string());
    }
    let target = PathBuf::from(trimmed);
    if let Some(parent) = target.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&target, content).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn force_quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Missing path".to_string());
    }
    fs::read_to_string(trimmed).map_err(|e| e.to_string())
}

#[tauri::command]
fn install_pengu_plugin() -> Result<String, String> {
    // Try common Pengu Loader installation paths
    let possible_paths = [
        PathBuf::from("C:\\Program Files\\Pengu Loader\\plugins"),
        PathBuf::from("C:\\Program Files (x86)\\Pengu Loader\\plugins"),
        dirs::document_dir()
            .map(|d| d.join("Pengu Loader").join("plugins"))
            .unwrap_or_default(),
    ];
    
    let plugins_dir = possible_paths.iter()
        .find(|p| p.exists())
        .ok_or("Pengu Loader not found. Please install Pengu Loader first.")?;
    
    // v1.1.6 doesn't support @author/ folders, use simple folder name
    let target_dir = plugins_dir.join("rank-override");
    
    // Create target directory
    fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create plugin directory: {}", e))?;
    fs::create_dir_all(target_dir.join("modules")).map_err(|e| format!("Failed to create modules directory: {}", e))?;
    
    // Write plugin files (embedded in binary)
    fs::write(
        target_dir.join("index.js"),
        include_str!("../../pengu-plugin/rank-override/index.js")
    ).map_err(|e| format!("Failed to write index.js: {}", e))?;
    
    fs::write(
        target_dir.join("modules").join("rankOverride.js"),
        include_str!("../../pengu-plugin/rank-override/modules/rankOverride.js")
    ).map_err(|e| format!("Failed to write rankOverride.js: {}", e))?;
    
    Ok(format!("Plugin installed to: {}", target_dir.display()))
}

fn pengu_rank_override_dirs() -> Result<Vec<PathBuf>, String> {
    let possible_paths = [
        PathBuf::from("C:\\Program Files\\Pengu Loader\\plugins"),
        PathBuf::from("C:\\Program Files (x86)\\Pengu Loader\\plugins"),
        dirs::document_dir()
            .map(|d| d.join("Pengu Loader").join("plugins"))
            .unwrap_or_default(),
    ];
    let plugins_dir = possible_paths.iter()
        .find(|path| path.exists())
        .ok_or("Pengu Loader not found. Please install Pengu Loader first.")?;
    Ok(vec![
        plugins_dir.join("rank-override"),
        plugins_dir.join("@default").join("rank-override"),
        plugins_dir.join("@l9lenny").join("rank-override"),
    ])
}

#[tauri::command]
fn save_custom_background(source_path: Option<String>, fit: String, position: String, dim: u8) -> Result<String, String> {
    let fit = match fit.as_str() {
        "cover" | "contain" => fit,
        _ => return Err("Invalid background fit".to_string()),
    };
    let position = match position.as_str() {
        "center" | "top" | "bottom" | "left" | "right" => position,
        _ => return Err("Invalid background position".to_string()),
    };
    let target_dir = pengu_rank_override_dirs()?.into_iter()
        .find(|path| path.exists())
        .ok_or("Rank Override plugin not installed")?;
    let assets_dir = target_dir.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| format!("Failed to create background assets directory: {}", e))?;

    let asset_name = if let Some(path) = source_path.filter(|value| !value.trim().is_empty()) {
        let source = PathBuf::from(path.trim());
        let metadata = fs::metadata(&source).map_err(|e| format!("Cannot read selected image: {}", e))?;
        if !metadata.is_file() || metadata.len() > 50 * 1024 * 1024 {
            return Err("Background must be a file smaller than 50 MB".to_string());
        }
        let extension = source.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .ok_or("Selected file has no extension")?;
        if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif") {
            return Err("Supported formats: PNG, JPG, WEBP and GIF".to_string());
        }
        let header = fs::read(&source).map_err(|e| format!("Cannot read selected image: {}", e))?;
        let valid_signature = match extension.as_str() {
            "png" => header.starts_with(b"\x89PNG\r\n\x1a\n"),
            "jpg" | "jpeg" => header.starts_with(&[0xff, 0xd8, 0xff]),
            "gif" => header.starts_with(b"GIF87a") || header.starts_with(b"GIF89a"),
            "webp" => header.len() >= 12 && &header[0..4] == b"RIFF" && &header[8..12] == b"WEBP",
            _ => false,
        };
        if !valid_signature {
            return Err("Selected file content does not match its image format".to_string());
        }
        for old_extension in ["png", "jpg", "jpeg", "webp", "gif"] {
            let old_asset = assets_dir.join(format!("custom-background.{}", old_extension));
            if old_asset.exists() {
                let _ = fs::remove_file(old_asset);
            }
        }
        let name = format!("custom-background.{}", extension);
        fs::write(assets_dir.join(&name), &header).map_err(|e| format!("Failed to install background: {}", e))?;
        name
    } else {
        let config_text = fs::read_to_string(target_dir.join("custom-background.json"))
            .map_err(|_| "Select an image before applying a custom background".to_string())?;
        let config: serde_json::Value = serde_json::from_str(&config_text).map_err(|e| e.to_string())?;
        config.get("asset").and_then(|value| value.as_str())
            .and_then(|value| PathBuf::from(value).file_name().and_then(|name| name.to_str()).map(String::from))
            .ok_or("Select an image before applying a custom background")?
    };
    let version = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let config = serde_json::json!({
        "enabled": true,
        "asset": format!("assets/{}", asset_name),
        "fit": fit,
        "position": position,
        "dim": dim.min(80),
        "version": version,
    });
    fs::write(target_dir.join("custom-background.json"), serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Failed to save background config: {}", e))?;
    Ok(asset_name)
}

#[tauri::command]
fn read_custom_background_preview(path: String) -> Result<String, String> {
    let source = PathBuf::from(path.trim());
    let metadata = fs::metadata(&source).map_err(|e| format!("Cannot read selected image: {}", e))?;
    if !metadata.is_file() || metadata.len() > 8 * 1024 * 1024 {
        return Ok(String::new());
    }
    let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => return Err("Unsupported image format".to_string()),
    };
    let bytes = fs::read(source).map_err(|e| format!("Cannot read selected image: {}", e))?;
    Ok(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
}

#[tauri::command]
fn clear_custom_background() -> Result<String, String> {
    let mut cleared = false;
    for target_dir in pengu_rank_override_dirs()? {
        if !target_dir.exists() { continue; }
        for extension in ["png", "jpg", "jpeg", "webp", "gif"] {
            let asset = target_dir.join("assets").join(format!("custom-background.{}", extension));
            if asset.exists() { let _ = fs::remove_file(asset); }
        }
        fs::write(target_dir.join("custom-background.json"), "{\n  \"enabled\": false\n}")
            .map_err(|e| format!("Failed to clear background config: {}", e))?;
        cleared = true;
    }
    if !cleared { return Err("Rank Override plugin not installed".to_string()); }
    Ok("Custom background cleared".to_string())
}

#[tauri::command]
fn save_rank_config(
    tier: String,
    division: String,
    queue: String,
    league_points: u32,
    last_season_tier: String,
    border_tier: String,
    banner_tier: String,
    honor_level: String,
    mastery_score: String,
    mastery_level: String,
    mastery_level2: String,
    mastery_level3: String,
    mastery_champion_id: String,
    mastery_champion_id2: String,
    mastery_champion_id3: String,
    trophy_theme: String,
    trophy_bracket: u32,
    trophy_tier: u32,
    clash_banner_theme: String,
    clash_banner_level: u32,
    overview_enabled: bool,
) -> Result<String, String> {
    let possible_paths = [
        PathBuf::from("C:\\Program Files\\Pengu Loader\\plugins"),
        PathBuf::from("C:\\Program Files (x86)\\Pengu Loader\\plugins"),
        dirs::document_dir()
            .map(|d| d.join("Pengu Loader").join("plugins"))
            .unwrap_or_default(),
    ];

    let plugins_dir = possible_paths.iter()
        .find(|p| p.exists())
        .ok_or("Pengu Loader not found")?;

    // Write to all possible plugin locations
    let locations = vec![
        plugins_dir.join("rank-override"),
        plugins_dir.join("@default").join("rank-override"),
        plugins_dir.join("@l9lenny").join("rank-override"),
    ];

    let config = serde_json::json!({
        "tier": tier,
        "division": division,
        "queue": queue,
        "leaguePoints": league_points,
        "lastSeasonTier": last_season_tier,
        "borderTier": border_tier,
        "bannerTier": banner_tier,
        "honorLevel": honor_level,
        "masteryScore": mastery_score,
        "masteryLevel": mastery_level,
        "masteryLevel2": mastery_level2,
        "masteryLevel3": mastery_level3,
        "masteryChampionId": mastery_champion_id,
        "masteryChampionId2": mastery_champion_id2,
        "masteryChampionId3": mastery_champion_id3,
        "trophyTheme": trophy_theme,
        "trophyBracket": trophy_bracket,
        "trophyTier": trophy_tier,
        "clashBannerTheme": clash_banner_theme,
        "clashBannerLevel": clash_banner_level,
        "overviewEnabled": overview_enabled,
    });

    let config_str = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    let mut written = String::new();

    for dir in &locations {
        if dir.exists() {
            let config_path = dir.join("rank-config.json");
            if let Some(parent) = config_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::write(&config_path, &config_str).map_err(|e| format!("Failed to write config: {}", e))?;
            written.push_str(&format!("{}; ", config_path.display()));
        }
    }

    if written.is_empty() {
        return Err("No plugin folder found".to_string());
    }

    Ok(format!("Config written to: {}", written))
}

#[tauri::command]
fn open_pengu_plugins_folder() -> Result<String, String> {
    let possible_paths = [
        PathBuf::from("C:\\Program Files\\Pengu Loader\\plugins"),
        PathBuf::from("C:\\Program Files (x86)\\Pengu Loader\\plugins"),
        dirs::document_dir()
            .map(|d| d.join("Pengu Loader").join("plugins"))
            .unwrap_or_default(),
    ];
    
    let plugins_dir = possible_paths.iter()
        .find(|p| p.exists())
        .ok_or("Pengu Loader not found. Please install Pengu Loader first.")?;
    
    // Open the folder in explorer
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(plugins_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(format!("Opened: {}", plugins_dir.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            // Get config directory
            let config_dir = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
            let config_path = config_dir.join("settings.json");
            let presets_path = config_dir.join("presets.json");
            
            // Create AppSettings and load from file
            let app_settings = AppSettings {
                minimize_to_tray: Mutex::new(true),
                config_path: config_path.clone(),
                presets_path,
            };
            
            // Load saved settings
            let saved_settings = app_settings.load_settings();
            if let Ok(mut minimize) = app_settings.minimize_to_tray.lock() {
                *minimize = saved_settings.minimize_to_tray;
            }
            
            app.manage(app_settings);
            
            // Setup System Tray
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show App", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap_or_else(|| tauri::image::Image::new(&[], 0, 0)))
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_lcu_connection, update_bio, set_minimize_to_tray, get_minimize_to_tray, lcu_request, save_logs_to_path, force_quit, load_presets, save_presets, read_text_file, install_pengu_plugin, list_library_themes, save_library_theme, delete_library_theme, save_client_theme, get_client_theme, read_client_theme_css, clear_client_theme, open_pengu_plugins_folder, save_rank_config, save_custom_background, read_custom_background_preview, clear_custom_background])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_, _| {});
}
