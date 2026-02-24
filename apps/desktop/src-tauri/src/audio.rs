/// Start listening for microphone input with VAD.
#[tauri::command]
pub fn start_listening() -> Result<(), String> {
    // TODO: Implement mic capture + VAD (replaces silero-vad + sounddevice)
    Err("Audio capture not yet implemented".into())
}

/// Stop listening for microphone input.
#[tauri::command]
pub fn stop_listening() -> Result<(), String> {
    // TODO: Stop mic capture
    Err("Audio capture not yet implemented".into())
}
