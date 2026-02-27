use rdev::{listen, EventType, Key};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;

static PTT_RUNNING: AtomicBool = AtomicBool::new(false);

/// Map a JS key code string (e.g. "ShiftLeft", "KeyV", "F1") to an rdev Key.
fn js_code_to_rdev(code: &str) -> Option<Key> {
    match code {
        "ShiftLeft" => Some(Key::ShiftLeft),
        "ShiftRight" => Some(Key::ShiftRight),
        "ControlLeft" => Some(Key::ControlLeft),
        "ControlRight" => Some(Key::ControlRight),
        "AltLeft" => Some(Key::Alt),
        "AltRight" => Some(Key::AltGr),
        "CapsLock" => Some(Key::CapsLock),
        "Tab" => Some(Key::Tab),
        "Backquote" => Some(Key::BackQuote),
        "F1" => Some(Key::F1),
        "F2" => Some(Key::F2),
        "F3" => Some(Key::F3),
        "F4" => Some(Key::F4),
        "F5" => Some(Key::F5),
        "F6" => Some(Key::F6),
        "F7" => Some(Key::F7),
        "F8" => Some(Key::F8),
        "F9" => Some(Key::F9),
        "F10" => Some(Key::F10),
        "F11" => Some(Key::F11),
        "F12" => Some(Key::F12),
        "Space" => Some(Key::Space),
        _ => None,
    }
}

#[tauri::command]
pub fn start_ptt_listener(app: tauri::AppHandle, key_code: String) -> Result<(), String> {
    if PTT_RUNNING.load(Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    let target_key = js_code_to_rdev(&key_code)
        .ok_or_else(|| format!("Unsupported PTT key: {}", key_code))?;

    PTT_RUNNING.store(true, Ordering::SeqCst);

    let app_handle = app.clone();
    let pressed = Arc::new(AtomicBool::new(false));

    std::thread::spawn(move || {
        let pressed = pressed.clone();

        let callback = move |event: rdev::Event| {
            if !PTT_RUNNING.load(Ordering::SeqCst) {
                return;
            }

            match event.event_type {
                EventType::KeyPress(key) if key == target_key => {
                    // Only fire once per press (ignore auto-repeat)
                    if !pressed.swap(true, Ordering::SeqCst) {
                        let _ = app_handle.emit("ptt-pressed", ());
                    }
                }
                EventType::KeyRelease(key) if key == target_key => {
                    if pressed.swap(false, Ordering::SeqCst) {
                        let _ = app_handle.emit("ptt-released", ());
                    }
                }
                _ => {}
            }
        };

        if let Err(e) = listen(callback) {
            eprintln!("[ptt] Listen error: {:?}", e);
        }

        PTT_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[tauri::command]
pub fn stop_ptt_listener() -> Result<(), String> {
    PTT_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}
