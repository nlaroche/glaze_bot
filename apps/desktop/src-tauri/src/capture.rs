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

/// Draw a subtle coordinate grid overlay on an image to help the LLM estimate positions.
/// Draws thin semi-transparent lines at 0.25 intervals with small coordinate labels.
fn draw_grid(img: &mut image::RgbaImage) {
    let (w, h) = (img.width(), img.height());
    let grid_color = image::Rgba([255, 255, 0, 60]); // very faint yellow
    let label_color = image::Rgba([255, 255, 0, 140]); // slightly brighter for labels

    // Draw gridlines at 0.1, 0.2, 0.3, ..., 0.9
    for i in 1..10u32 {
        let is_major = i % 5 == 0; // 0.5 gets a slightly different treatment
        let alpha = if is_major { 80 } else { 40 };
        let color = image::Rgba([255, 255, 0, alpha]);

        // Vertical line
        let x = (w as f64 * i as f64 / 10.0) as u32;
        if x < w {
            for y in 0..h {
                let pixel = img.get_pixel_mut(x, y);
                blend_pixel(pixel, &color);
            }
        }

        // Horizontal line
        let y = (h as f64 * i as f64 / 10.0) as u32;
        if y < h {
            for x in 0..w {
                let pixel = img.get_pixel_mut(x, y);
                blend_pixel(pixel, &color);
            }
        }
    }

    // Draw small crosshair markers at 0.25 intervals with coordinate labels
    // Using pixel art digits since we don't have a font renderer
    for gy in &[0.25, 0.5, 0.75] {
        for gx in &[0.25, 0.5, 0.75] {
            let cx = (*gx * w as f64) as u32;
            let cy = (*gy * h as f64) as u32;

            // Draw a small 7px crosshair
            for d in 0..4u32 {
                if cx + d < w { blend_pixel(img.get_pixel_mut(cx + d, cy), &label_color); }
                if cx >= d { blend_pixel(img.get_pixel_mut(cx - d, cy), &label_color); }
                if cy + d < h { blend_pixel(img.get_pixel_mut(cx, cy + d), &label_color); }
                if cy >= d { blend_pixel(img.get_pixel_mut(cx, cy - d), &label_color); }
            }
        }
    }

    // Draw edge markers at corners and midpoints with clearer labels
    // Top-left region label
    draw_marker_dot(img, (w as f64 * 0.0) as u32 + 4, (h as f64 * 0.0) as u32 + 4, &grid_color);
    // Bottom-right region label
    draw_marker_dot(img, w.saturating_sub(5), h.saturating_sub(5), &grid_color);
}

fn blend_pixel(dst: &mut image::Rgba<u8>, src: &image::Rgba<u8>) {
    let sa = src.0[3] as f32 / 255.0;
    let da = 1.0 - sa;
    dst.0[0] = (dst.0[0] as f32 * da + src.0[0] as f32 * sa) as u8;
    dst.0[1] = (dst.0[1] as f32 * da + src.0[1] as f32 * sa) as u8;
    dst.0[2] = (dst.0[2] as f32 * da + src.0[2] as f32 * sa) as u8;
}

fn draw_marker_dot(img: &mut image::RgbaImage, cx: u32, cy: u32, color: &image::Rgba<u8>) {
    let (w, h) = (img.width(), img.height());
    for dy in 0..3u32 {
        for dx in 0..3u32 {
            let x = cx + dx;
            let y = cy + dy;
            if x < w && y < h {
                blend_pixel(img.get_pixel_mut(x, y), color);
            }
        }
    }
}

fn encode_frame(img: image::RgbaImage, with_grid: bool) -> Result<(String, u32, u32), String> {
    let width = img.width();
    let height = img.height();
    let mut img = img;
    if with_grid {
        draw_grid(&mut img);
    }
    let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
    let mut buf = Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 75);
    rgb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
    Ok((format!("data:image/jpeg;base64,{}", b64), width, height))
}

#[derive(Serialize)]
pub struct FrameResult {
    pub data_uri: String,
    pub width: u32,
    pub height: u32,
}

/// Grab a screenshot frame, returned as base64 JPEG with dimensions.
/// When `with_grid` is true, a subtle coordinate grid is overlaid to help the AI estimate positions.
#[tauri::command]
pub fn grab_frame(source_id: String, with_grid: Option<bool>) -> Result<FrameResult, String> {
    let grid = with_grid.unwrap_or(false);

    if source_id.starts_with("monitor-") {
        let idx: usize = source_id
            .strip_prefix("monitor-")
            .and_then(|s| s.parse().ok())
            .ok_or("Invalid monitor ID")?;
        let monitors = Monitor::all().map_err(|e| e.to_string())?;
        let mon = monitors.get(idx).ok_or("Monitor not found")?;
        let img = mon.capture_image().map_err(|e| e.to_string())?;
        let (data_uri, width, height) = encode_frame(img, grid)?;
        Ok(FrameResult { data_uri, width, height })
    } else if source_id.starts_with("window-") {
        let wid: u32 = source_id
            .strip_prefix("window-")
            .and_then(|s| s.parse().ok())
            .ok_or("Invalid window ID")?;
        let windows = Window::all().map_err(|e| e.to_string())?;
        let win = windows.into_iter().find(|w| w.id() == wid).ok_or("Window not found")?;
        let img = win.capture_image().map_err(|e| e.to_string())?;
        let (data_uri, width, height) = encode_frame(img, grid)?;
        Ok(FrameResult { data_uri, width, height })
    } else {
        Err("Unknown source type".into())
    }
}
