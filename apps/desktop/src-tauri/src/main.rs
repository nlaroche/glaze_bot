// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod capture;
mod tts;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            capture::list_sources,
            capture::grab_frame,
            audio::start_listening,
            audio::stop_listening,
            tts::speak,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
