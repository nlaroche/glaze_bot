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

// ── Pixel-art digit renderer ──────────────────────────────────────
// Each digit is a 3x5 bitmask. Rows top-to-bottom, bits left-to-right.
// '.' is stored at index 10, ',' at 11.
const DIGIT_BITMAPS: [[u8; 5]; 12] = [
    [0b111, 0b101, 0b101, 0b101, 0b111], // 0
    [0b010, 0b110, 0b010, 0b010, 0b111], // 1
    [0b111, 0b001, 0b111, 0b100, 0b111], // 2
    [0b111, 0b001, 0b111, 0b001, 0b111], // 3
    [0b101, 0b101, 0b111, 0b001, 0b001], // 4
    [0b111, 0b100, 0b111, 0b001, 0b111], // 5
    [0b111, 0b100, 0b111, 0b101, 0b111], // 6
    [0b111, 0b001, 0b010, 0b010, 0b010], // 7
    [0b111, 0b101, 0b111, 0b101, 0b111], // 8
    [0b111, 0b101, 0b111, 0b001, 0b111], // 9
    [0b000, 0b000, 0b000, 0b000, 0b010], // . (index 10)
    [0b000, 0b000, 0b000, 0b010, 0b010], // , (index 11)
];

/// Render a text string of digits/dots at 2x scale (6x10 per char).
/// Returns the total pixel width rendered.
fn draw_text(
    img: &mut image::RgbaImage,
    text: &str,
    start_x: i32,
    start_y: i32,
    fg: &image::Rgba<u8>,
    shadow: &image::Rgba<u8>,
) -> u32 {
    let (iw, ih) = (img.width() as i32, img.height() as i32);
    let scale = 2u32;
    let char_w = 3 * scale + 1; // 7px per char (6 + 1 spacing)
    let mut cx = start_x;

    for ch in text.chars() {
        let idx = match ch {
            '0'..='9' => (ch as u8 - b'0') as usize,
            '.' => 10,
            ',' => 11,
            _ => continue,
        };
        let bitmap = &DIGIT_BITMAPS[idx];

        for (row, &bits) in bitmap.iter().enumerate() {
            for col in 0..3u32 {
                if bits & (1 << (2 - col)) != 0 {
                    let px = cx + (col * scale) as i32;
                    let py = start_y + (row as u32 * scale) as i32;
                    // Draw 2x2 block with 1px shadow offset
                    for dy in 0..scale {
                        for dx in 0..scale {
                            let sx = px + dx as i32 + 1;
                            let sy = py + dy as i32 + 1;
                            if sx >= 0 && sx < iw && sy >= 0 && sy < ih {
                                blend_pixel(img.get_pixel_mut(sx as u32, sy as u32), shadow);
                            }
                        }
                    }
                    for dy in 0..scale {
                        for dx in 0..scale {
                            let fx = px + dx as i32;
                            let fy = py + dy as i32;
                            if fx >= 0 && fx < iw && fy >= 0 && fy < ih {
                                blend_pixel(img.get_pixel_mut(fx as u32, fy as u32), fg);
                            }
                        }
                    }
                }
            }
        }
        cx += char_w as i32;
    }
    ((text.len() as u32) * char_w).saturating_sub(1)
}

/// Draw a filled rectangle with alpha blending.
fn fill_rect(img: &mut image::RgbaImage, x: i32, y: i32, w: u32, h: u32, color: &image::Rgba<u8>) {
    let (iw, ih) = (img.width() as i32, img.height() as i32);
    for dy in 0..h {
        for dx in 0..w {
            let px = x + dx as i32;
            let py = y + dy as i32;
            if px >= 0 && px < iw && py >= 0 && py < ih {
                blend_pixel(img.get_pixel_mut(px as u32, py as u32), color);
            }
        }
    }
}

/// Draw a coordinate grid overlay to help the LLM estimate positions accurately.
///
/// Features:
/// - Edge tick marks with coordinate labels (0.1–0.9) along all 4 borders
/// - Dashed gridlines at 0.25 intervals (4px on, 8px off)
/// - Coordinate labels at the 9 major intersections (e.g. "25,50")
/// - Corner orientation labels ("0,0" top-left, "1,1" bottom-right)
fn draw_grid(img: &mut image::RgbaImage) {
    let (w, h) = (img.width(), img.height());
    let fg_color = image::Rgba([255, 255, 0, 220]);        // bright yellow text
    let shadow_color = image::Rgba([0, 0, 0, 200]);         // dark shadow for readability
    let line_color = image::Rgba([255, 255, 0, 120]);        // dashed gridline color
    let bg_color = image::Rgba([0, 0, 0, 160]);              // label background

    let tick_len: u32 = 12;
    let tick_thickness: u32 = 2;

    // ── Edge tick marks + labels at 0.1 intervals ─────────────────
    for i in 1..10u32 {
        let label = format!("0.{}", i);

        // Top edge: vertical tick + label below
        let tx = (w as f64 * i as f64 / 10.0) as u32;
        for dy in 0..tick_len {
            for dt in 0..tick_thickness {
                let px = tx.saturating_add(dt);
                if px < w && dy < h {
                    blend_pixel(img.get_pixel_mut(px, dy), &fg_color);
                }
            }
        }
        draw_text(img, &label, tx as i32 - 6, (tick_len + 2) as i32, &fg_color, &shadow_color);

        // Bottom edge: vertical tick + label above
        for dy in 0..tick_len {
            for dt in 0..tick_thickness {
                let px = tx.saturating_add(dt);
                let py = h.saturating_sub(1 + dy);
                if px < w && py < h {
                    blend_pixel(img.get_pixel_mut(px, py), &fg_color);
                }
            }
        }
        draw_text(img, &label, tx as i32 - 6, (h - tick_len - 14) as i32, &fg_color, &shadow_color);

        // Left edge: horizontal tick + label right
        let ty = (h as f64 * i as f64 / 10.0) as u32;
        for dx in 0..tick_len {
            for dt in 0..tick_thickness {
                let py = ty.saturating_add(dt);
                if dx < w && py < h {
                    blend_pixel(img.get_pixel_mut(dx, py), &fg_color);
                }
            }
        }
        draw_text(img, &label, (tick_len + 2) as i32, ty as i32 - 5, &fg_color, &shadow_color);

        // Right edge: horizontal tick + label left
        for dx in 0..tick_len {
            for dt in 0..tick_thickness {
                let px = w.saturating_sub(1 + dx);
                let py = ty.saturating_add(dt);
                if px < w && py < h {
                    blend_pixel(img.get_pixel_mut(px, py), &fg_color);
                }
            }
        }
        let label_w = label.len() as i32 * 7;
        draw_text(img, &label, (w as i32) - tick_len as i32 - 2 - label_w, ty as i32 - 5, &fg_color, &shadow_color);
    }

    // ── Dashed major gridlines at 0.25 intervals ──────────────────
    let dash_on: u32 = 4;
    let dash_off: u32 = 8;
    let dash_cycle = dash_on + dash_off;

    for &frac in &[0.25f64, 0.5, 0.75] {
        // Vertical dashed line
        let gx = (w as f64 * frac) as u32;
        if gx < w {
            for y in 0..h {
                if (y % dash_cycle) < dash_on {
                    blend_pixel(img.get_pixel_mut(gx, y), &line_color);
                    if gx + 1 < w {
                        blend_pixel(img.get_pixel_mut(gx + 1, y), &line_color);
                    }
                }
            }
        }

        // Horizontal dashed line
        let gy = (h as f64 * frac) as u32;
        if gy < h {
            for x in 0..w {
                if (x % dash_cycle) < dash_on {
                    blend_pixel(img.get_pixel_mut(x, gy), &line_color);
                    if gy + 1 < h {
                        blend_pixel(img.get_pixel_mut(x, gy + 1), &line_color);
                    }
                }
            }
        }
    }

    // ── Coordinate labels at major intersections ──────────────────
    // 9 intersections: (25,25), (25,50), ..., (75,75)
    for &fy in &[0.25f64, 0.5, 0.75] {
        for &fx in &[0.25f64, 0.5, 0.75] {
            let cx = (w as f64 * fx) as i32;
            let cy = (h as f64 * fy) as i32;
            let label = format!("{},{}", (fx * 100.0) as u32, (fy * 100.0) as u32);
            let label_px_w = (label.len() as u32) * 7 + 4;
            let label_px_h: u32 = 14;

            // Background rectangle
            fill_rect(img, cx + 3, cy + 3, label_px_w, label_px_h, &bg_color);
            // Text
            draw_text(img, &label, cx + 5, cy + 5, &fg_color, &shadow_color);
        }
    }

    // ── Corner orientation labels ─────────────────────────────────
    // "0,0" at top-left
    fill_rect(img, 2, 2, 32, 14, &bg_color);
    draw_text(img, "0,0", 4, 4, &fg_color, &shadow_color);

    // "1,1" at bottom-right
    let br_x = w as i32 - 34;
    let br_y = h as i32 - 16;
    fill_rect(img, br_x, br_y, 32, 14, &bg_color);
    draw_text(img, "1,1", br_x + 2, br_y + 2, &fg_color, &shadow_color);
}

fn blend_pixel(dst: &mut image::Rgba<u8>, src: &image::Rgba<u8>) {
    let sa = src.0[3] as f32 / 255.0;
    let da = 1.0 - sa;
    dst.0[0] = (dst.0[0] as f32 * da + src.0[0] as f32 * sa) as u8;
    dst.0[1] = (dst.0[1] as f32 * da + src.0[1] as f32 * sa) as u8;
    dst.0[2] = (dst.0[2] as f32 * da + src.0[2] as f32 * sa) as u8;
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
    // Higher quality when grid is enabled to preserve small text labels
    let jpeg_quality = if with_grid { 90 } else { 75 };
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, jpeg_quality);
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
