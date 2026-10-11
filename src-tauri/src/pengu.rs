use std::{fs, io::{Cursor, Read}, path::PathBuf};
use std::process::Command;
use tauri::Manager;

const VERSION: &str = "1.1.6";
const ARCHIVE_URL: &str = "https://github.com/PenguLoader/PenguLoader/releases/download/v1.1.6/pengu-loader-v1.1.6.zip";

pub fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("Pengu Loader"))
}

pub fn plugins_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(root(app)?.join("plugins"))
}

pub fn find_existing_plugins_dir() -> Option<PathBuf> {
    [
        PathBuf::from(r"C:\Program Files\Pengu Loader\plugins"),
        PathBuf::from(r"C:\Program Files (x86)\Pengu Loader\plugins"),
        dirs::document_dir().map(|dir| dir.join("Pengu Loader/plugins")).unwrap_or_default(),
    ].into_iter().find(|path| path.is_dir())
}

pub async fn ensure_loader(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = root(app)?;
    let executable = root.join("Pengu Loader.exe");
    if executable.is_file() {
        return Ok(root);
    }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    if let Some(existing_plugins) = find_existing_plugins_dir() {
        if let Some(existing_root) = existing_plugins.parent() {
            copy_plugin_files(existing_root, &root)?;
            if executable.is_file() { return Ok(root); }
        }
    }
    let bytes = reqwest::Client::new().get(ARCHIVE_URL).send().await
        .map_err(|e| format!("Pengu download failed: {}", e))?
        .error_for_status().map_err(|e| format!("Pengu download failed: {}", e))?
        .bytes().await.map_err(|e| format!("Pengu download failed: {}", e))?;
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("Invalid Pengu archive: {}", e))?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let Some(relative) = entry.enclosed_name().map(|path| path.to_path_buf()) else { continue; };
        let target = root.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        let mut content = Vec::new();
        entry.read_to_end(&mut content).map_err(|e| e.to_string())?;
        fs::write(target, content).map_err(|e| e.to_string())?;
    }
    fs::write(root.join("lpt-managed-version"), VERSION).map_err(|e| e.to_string())?;
    if executable.is_file() { Ok(root) } else { Err("Pengu archive did not contain Pengu Loader.exe".into()) }
}

pub fn ensure_running(loader_root: &std::path::Path) -> Result<(), String> {
    let executable = loader_root.join("Pengu Loader.exe");
    if !executable.is_file() {
        return Err("Pengu Loader is not installed yet".into());
    }

    #[cfg(target_os = "windows")]
    {
        let running = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Pengu Loader.exe", "/NH"])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains("Pengu Loader.exe"))
            .unwrap_or(false);
        if running {
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SHOW_WINDOW_CMD;

        let file: Vec<u16> = executable.as_os_str().encode_wide().chain(Some(0)).collect();
        let verb: Vec<u16> = "runas".encode_utf16().chain(Some(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(file.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SHOW_WINDOW_CMD(1),
            )
        };
        if result.0 as usize <= 32 {
            return Err("Pengu Loader requires administrator approval. Start was cancelled or failed.".into());
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    Command::new(executable).spawn().map(|_| ()).map_err(|e| format!("Failed to start Pengu Loader: {}", e))
}

pub fn copy_plugin_files(source: &std::path::Path, target: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() { copy_plugin_files(&source_path, &target_path)?; }
        else { fs::copy(source_path, target_path).map_err(|e| e.to_string())?; }
    }
    Ok(())
}
