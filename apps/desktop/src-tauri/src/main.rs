// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod capture;
mod oauth;
mod overlay;
mod ptt;
mod tts;

use tauri::{
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

#[tauri::command]
fn close_tray_menu(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("tray-menu") {
        let _ = w.hide();
    }
}

#[tauri::command]
fn tray_menu_action(app: tauri::AppHandle, action: String) {
    // Hide the menu first
    if let Some(menu_win) = app.get_webview_window("tray-menu") {
        let _ = menu_win.hide();
    }
    match action.as_str() {
        "show" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

fn main() {
    // Must be set BEFORE WebView2 initializes — disables timer throttling in background/hidden windows
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(oauth::OAuthState {
            receiver: std::sync::Mutex::new(None),
        })
        .setup(|app| {
            // Set overlay webview background to fully transparent at startup
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
            }

            // Set tray-menu webview background to fully transparent
            if let Some(tray_menu) = app.get_webview_window("tray-menu") {
                let _ = tray_menu.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
            }

            // Build tray icon with custom popup menu (no native menu)
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(|tray, event| {
                    match event {
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Right,
                            button_state: tauri::tray::MouseButtonState::Up,
                            position,
                            ..
                        } => {
                            if let Some(menu_win) = tray.app_handle().get_webview_window("tray-menu") {
                                let menu_width = 240.0_f64;
                                let menu_height = 220.0_f64;
                                // Position so bottom-right of visible menu aligns near cursor
                                // Offset inward to account for 12px CSS margin inside the window
                                let x = position.x - menu_width + 30.0;
                                let y = position.y - menu_height + 30.0;
                                let _ = menu_win.set_position(tauri::Position::Physical(
                                    tauri::PhysicalPosition {
                                        x: x as i32,
                                        y: y as i32,
                                    },
                                ));
                                let _ = menu_win.show();
                                let _ = menu_win.set_focus();
                            }
                        }
                        tauri::tray::TrayIconEvent::DoubleClick {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } => {
                            if let Some(w) = tray.app_handle().get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Only hide-on-close for the main window, not the overlay
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            capture::list_sources,
            capture::grab_frame,
            audio::init_whisper,
            audio::start_recording,
            audio::stop_recording,
            audio::start_vad,
            audio::stop_vad,
            audio::set_vad_config,
            tts::speak,
            oauth::start_oauth_server,
            oauth::wait_for_oauth_callback,
            overlay::show_overlay,
            overlay::hide_overlay,
            close_tray_menu,
            tray_menu_action,
            ptt::start_ptt_listener,
            ptt::stop_ptt_listener,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
