/// Speak text using local TTS engine (replaces kokoro-onnx).
#[tauri::command]
pub fn speak(text: String, _voice_id: String) -> Result<(), String> {
    // TODO: Implement local TTS (Kokoro ONNX or platform native)
    let _ = text;
    Err("Local TTS not yet implemented".into())
}
