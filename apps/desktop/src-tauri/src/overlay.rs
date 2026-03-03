use tauri::{Emitter, Manager};

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};

static GUARD_RUNNING: AtomicBool = AtomicBool::new(false);
static OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);
static FULLSCREEN_WARNED: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
fn get_overlay_hwnd(app: &tauri::AppHandle) -> isize {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    let Some(overlay) = app.get_webview_window("overlay") else {
        return 0;
    };
    match overlay.window_handle() {
        Ok(handle) => match handle.as_raw() {
            RawWindowHandle::Win32(h) => h.hwnd.get() as isize,
            _ => 0,
        },
        Err(_) => 0,
    }
}

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

    // Re-assert always-on-top — Windows can lose z-order after hide/show
    let _ = overlay.set_always_on_top(true);

    // Win32: more aggressive TOPMOST via SetWindowPos
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::*;
        let hwnd = get_overlay_hwnd(&app);
        if hwnd != 0 {
            unsafe {
                SetWindowPos(
                    hwnd as _,
                    HWND_TOPMOST,
                    0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
        }
    }

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

#[tauri::command]
pub fn set_overlay_interactive(app: tauri::AppHandle, interactive: bool) -> Result<(), String> {
    let overlay = app
        .get_webview_window("overlay")
        .ok_or("Overlay window not found")?;
    let _ = overlay.set_ignore_cursor_events(!interactive);
    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn start_overlay_guard(app: tauri::AppHandle) -> Result<(), String> {
    let hwnd = get_overlay_hwnd(&app);
    if hwnd == 0 {
        return Err("Could not get overlay HWND".into());
    }

    OVERLAY_HWND.store(hwnd, Ordering::Relaxed);
    FULLSCREEN_WARNED.store(false, Ordering::Relaxed);

    if GUARD_RUNNING.swap(true, Ordering::SeqCst) {
        // Already running
        return Ok(());
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        while GUARD_RUNNING.load(Ordering::SeqCst) {
            let hwnd = OVERLAY_HWND.load(Ordering::Relaxed);
            if hwnd != 0 {
                use windows_sys::Win32::UI::WindowsAndMessaging::*;
                unsafe {
                    SetWindowPos(
                        hwnd as _,
                        HWND_TOPMOST,
                        0, 0, 0, 0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }

                // Check for exclusive fullscreen
                if !FULLSCREEN_WARNED.load(Ordering::Relaxed) {
                    let mut state: i32 = 0;
                    let hr = unsafe {
                        windows_sys::Win32::UI::Shell::SHQueryUserNotificationState(&mut state as *mut i32)
                    };
                    // QUNS_RUNNING_D3D_FULL_SCREEN = 3, QUNS_BUSY = 2
                    if hr == 0 && (state == 3 || state == 2) {
                        FULLSCREEN_WARNED.store(true, Ordering::Relaxed);
                        let _ = app_handle.emit("overlay-fullscreen-warning", ());
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_secs(2));
        }
    });

    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn stop_overlay_guard() -> Result<(), String> {
    GUARD_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn start_overlay_guard(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn stop_overlay_guard() -> Result<(), String> {
    Ok(())
}
