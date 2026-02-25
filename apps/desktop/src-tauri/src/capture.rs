use base64::Engine;
use serde::Serialize;
use std::io::Cursor;
use xcap::{Monitor, Window};

#[derive(Serialize, Clone)]
pub struct CaptureSource {
    pub id: String,
    pub name: String,
    pub source_type: String, // "monitor" or "window"
    pub thumbnail: Option<String>, // base64 JPEG data URI
}

fn capture_thumbnail(img: &image::RgbaImage, max_w: u32, max_h: u32) -> Option<String> {
    let thumb = image::imageops::resize(img, max_w, max_h, image::imageops::FilterType::Triangle);
    let rgb = image::DynamicImage::ImageRgba8(thumb).to_rgb8();
    let mut buf = Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 60);
    rgb.write_with_encoder(encoder).ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
    Some(format!("data:image/jpeg;base64,{}", b64))
}

/// List available capture sources (monitors and windows).
#[tauri::command]
pub fn list_sources() -> Vec<CaptureSource> {
    let mut sources = Vec::new();

    // Monitors
    if let Ok(monitors) = Monitor::all() {
        for (i, mon) in monitors.iter().enumerate() {
            let thumb = mon.capture_image().ok().and_then(|img| capture_thumbnail(&img, 320, 200));
            sources.push(CaptureSource {
                id: format!("monitor-{}", i),
                name: if monitors.len() == 1 {
                    "Primary Display".to_string()
                } else {
                    format!("Display {} {}", i + 1, if mon.is_primary() { "(Primary)" } else { "" })
                },
                source_type: "monitor".to_string(),
                thumbnail: thumb,
            });
        }
    }

    // Windows
    if let Ok(windows) = Window::all() {
        for win in windows {
            let title = win.title().to_string();
            // Skip windows with no title or very short titles (system windows)
            if title.len() < 2 {
                continue;
            }
            // Skip known system/invisible windows
            let lower = title.to_lowercase();
            if lower.contains("task switching")
                || lower == "program manager"
                || lower == "windows input experience"
                || lower == "msrdc"
            {
                continue;
            }

            let thumb = win.capture_image().ok().and_then(|img| {
                // Skip fully transparent / empty captures
                if img.pixels().all(|p| p.0[3] == 0) {
                    return None;
                }
                capture_thumbnail(&img, 320, 200)
            });

            sources.push(CaptureSource {
                id: format!("window-{}", win.id()),
                name: title,
                source_type: "window".to_string(),
                thumbnail: thumb,
            });
        }
    }

    sources
}

/// Grab a screenshot frame, returned as base64 JPEG.
#[tauri::command]
pub fn grab_frame(source_id: String) -> Result<String, String> {
    if source_id.starts_with("monitor-") {
        let idx: usize = source_id
            .strip_prefix("monitor-")
            .and_then(|s| s.parse().ok())
            .ok_or("Invalid monitor ID")?;
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        let mon = monitors.get(idx).ok_or("Monitor not found")?;
        let img = mon.capture_image().map_err(|e| e.to_string())?;
        let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
        let mut buf = Cursor::new(Vec::new());
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 75);
        rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
        Ok(format!("data:image/jpeg;base64,{}", b64))
    } else if source_id.starts_with("window-") {
        let wid: u32 = source_id
            .strip_prefix("window-")
            .and_then(|s| s.parse().ok())
            .ok_or("Invalid window ID")?;
        let windows = Window::all().map_err(|e| e.to_string())?;
        let win = windows.into_iter().find(|w| w.id() == wid).ok_or("Window not found")?;
        let img = win.capture_image().map_err(|e| e.to_string())?;
        let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
        let mut buf = Cursor::new(Vec::new());
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 75);
        rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
        Ok(format!("data:image/jpeg;base64,{}", b64))
    } else {
        Err("Unknown source type".into())
    }
}
