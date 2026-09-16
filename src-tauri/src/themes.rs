use std::{fs, io::Read, path::{Path, PathBuf}, sync::Mutex};
use serde_json::{json, Value};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize)]
pub struct LibraryTheme {
    id: String,
    name: String,
    css: String,
}

fn library_file(dir: &Path, id: &str) -> Result<PathBuf, String> {
    if id.is_empty() || id.len() > 64 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') {
        return Err("Invalid theme ID".into());
    }
    Ok(dir.join(format!("{}.json", id)))
}

fn library_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|dir| dir.join("themes")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_library_themes(app: tauri::AppHandle) -> Result<Vec<LibraryTheme>, String> {
    let dir = library_dir(&app)?;
    if !dir.exists() { return Ok(vec![]); }
    let mut themes = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_some_and(|ext| ext == "json") {
            let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let theme: LibraryTheme = serde_json::from_str(&text)
                .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;
            themes.push(theme);
        }
    }
    themes.sort_by_key(|theme| theme.name.to_lowercase());
    Ok(themes)
}

#[tauri::command]
pub fn save_library_theme(app: tauri::AppHandle, theme: LibraryTheme) -> Result<(), String> {
    validate_css(&theme.css)?;
    if theme.name.trim().is_empty() || theme.name.chars().count() > 80 {
        return Err("Theme name must contain 1–80 characters".into());
    }
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = library_dir(&app)?;
    let path = library_file(&dir, &theme.id)?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, serde_json::to_vec(&theme).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(temporary, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_library_theme(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let path = library_file(&library_dir(&app)?, &id)?;
    fs::remove_file(path).map_err(|e| e.to_string())
}

static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn theme_dir() -> Result<PathBuf, String> {
    let paths = [
        Some(PathBuf::from(r"C:\Program Files\Pengu Loader\plugins")),
        Some(PathBuf::from(r"C:\Program Files (x86)\Pengu Loader\plugins")),
        dirs::document_dir().map(|dir| dir.join("Pengu Loader/plugins")),
    ];
    paths.into_iter().flatten().find(|path| path.is_dir())
        .map(|path| path.join("client-theme"))
        .ok_or_else(|| "Pengu Loader not found. Install Pengu Loader first.".into())
}

// Basic format checks, not a CSS sandbox. Imported styles must be trusted.
fn validate_css(css: &str) -> Result<(), String> {
    if css.trim().is_empty() || css.len() > 200_000 {
        return Err("Theme CSS must contain 1–200,000 bytes".into());
    }
    let lower = css.to_ascii_lowercase();
    if ["@import", "javascript:", "expression(", "behavior:", "-moz-binding"]
        .iter().any(|pattern| lower.contains(pattern)) {
        return Err("Imports and legacy executable CSS constructs are unsupported".into());
    }
    Ok(())
}

#[tauri::command]
pub fn read_client_theme_css(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("css")) {
        return Err("Choose a CSS file".into());
    }
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut css = String::new();
    file.take(200_001).read_to_string(&mut css).map_err(|e| e.to_string())?;
    validate_css(&css)?;
    Ok(css)
}

#[tauri::command]
pub fn get_client_theme() -> Result<Option<Value>, String> {
    let Ok(dir) = theme_dir() else { return Ok(None); };
    let path = dir.join("theme.json");
    if !path.exists() { return Ok(None); }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map(Some).map_err(|e| e.to_string())
}

fn write_config(dir: &Path, config: &Value) -> Result<(), String> {
    let temporary = dir.join("theme.json.tmp");
    fs::write(&temporary, serde_json::to_vec(config).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::rename(temporary, dir.join("theme.json")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_client_theme(name: String, css: String, enabled: bool) -> Result<String, String> {
    validate_css(&css)?;
    if name.trim().is_empty() || name.chars().count() > 80 {
        return Err("Theme name must contain 1–80 characters".into());
    }
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = theme_dir()?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("index.js"), include_str!("../../pengu-plugin/client-theme/index.js"))
        .map_err(|e| e.to_string())?;
    write_config(&dir, &json!({"name": name.trim(), "css": css, "enabled": enabled}))?;
    Ok(format!("Theme saved to {}", dir.display()))
}

#[tauri::command]
pub fn clear_client_theme() -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = theme_dir()?;
    if dir.exists() { write_config(&dir, &json!({"enabled": false}))?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_limits_and_replaces_configuration() {
        assert!(validate_css("body { color: red }").is_ok());
        assert!(validate_css(" ").is_err());
        assert!(validate_css(&"x".repeat(200_001)).is_err());
        assert!(validate_css("@IMPORT 'remote.css';").is_err());
        assert!(library_file(Path::new("themes"), "../other").is_err());
        assert!(library_file(Path::new("themes"), "abc-123").is_ok());
        let dir = std::env::temp_dir().join(format!("lpt-theme-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        write_config(&dir, &json!({"enabled": true, "css": "body {}"})).unwrap();
        write_config(&dir, &json!({"enabled": false})).unwrap();
        let saved: Value = serde_json::from_str(&fs::read_to_string(dir.join("theme.json")).unwrap()).unwrap();
        assert_eq!(saved["enabled"], false);
        fs::remove_dir_all(dir).unwrap();
    }
}
