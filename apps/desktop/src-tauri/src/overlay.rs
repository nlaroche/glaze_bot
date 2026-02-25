use tauri::Manager;

#[tauri::command]
pub fn show_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let overlay = app
        .get_webview_window("overlay")
        .ok_or("Overlay window not found")?;

    // Set webview background fully transparent
    let _ = overlay.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));

    // Click-through so it doesn't intercept mouse events
    let _ = overlay.set_ignore_cursor_events(true);
    let _ = overlay.show();

    Ok(())
}

#[tauri::command]
pub fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let overlay = app
        .get_webview_window("overlay")
        .ok_or("Overlay window not found")?;
    let _ = overlay.hide();
    Ok(())
}
