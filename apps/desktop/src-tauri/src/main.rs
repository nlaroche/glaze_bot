// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod capture;
mod oauth;
mod overlay;
mod tts;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

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

            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "Show GlazeBot", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
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
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { button: tauri::tray::MouseButton::Left, .. } = event {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
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
            audio::start_listening,
            audio::stop_listening,
            tts::speak,
            oauth::start_oauth_server,
            oauth::wait_for_oauth_callback,
            overlay::show_overlay,
            overlay::hide_overlay,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
