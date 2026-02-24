use serde::Serialize;

#[derive(Serialize)]
pub struct CaptureSource {
    pub id: String,
    pub name: String,
    pub source_type: String, // "monitor" or "window"
}

/// List available capture sources (monitors and windows).
#[tauri::command]
pub fn list_sources() -> Vec<CaptureSource> {
    // TODO: Implement native screen/window enumeration
    vec![]
}

/// Grab a screenshot frame, returned as base64 JPEG.
#[tauri::command]
pub fn grab_frame() -> Result<String, String> {
    // TODO: Implement native screen capture
    Err("Screen capture not yet implemented".into())
}
