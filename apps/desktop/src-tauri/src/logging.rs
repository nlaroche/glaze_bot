use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

/// Get the log file path: <cwd>/glazebot-debug.log
/// During dev this lands in the repo root; in production, next to the exe.
fn log_path() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| {
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                .unwrap_or_else(|| PathBuf::from("."))
        })
        .join("glazebot-debug.log")
}

#[tauri::command]
pub fn append_debug_log(lines: String) -> Result<String, String> {
    let path = log_path();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(lines.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_debug_log_path() -> String {
    log_path().to_string_lossy().to_string()
}

#[tauri::command]
pub fn clear_debug_log() -> Result<(), String> {
    let path = log_path();
    if path.exists() {
        std::fs::write(&path, "").map_err(|e| format!("Failed to clear log: {}", e))?;
    }
    Ok(())
}
