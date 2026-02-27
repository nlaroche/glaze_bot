use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

// ── Global State ────────────────────────────────────────────────────────

struct WhisperState {
    ctx: WhisperContext,
}

// WhisperContext is Send (the C library is thread-safe for read-only inference
// once loaded). We wrap it so Rust's type system allows the OnceLock.
unsafe impl Send for WhisperState {}
unsafe impl Sync for WhisperState {}

static WHISPER: OnceLock<WhisperState> = OnceLock::new();

// cpal::Stream is Send but not Sync on Windows (WASAPI).
// We only ever access these from Tauri commands (one at a time behind a Mutex),
// so this is safe.
#[allow(dead_code)]
struct SendStream(cpal::Stream);
unsafe impl Send for SendStream {}
unsafe impl Sync for SendStream {}

struct RecordingState {
    buffer: Arc<Mutex<Vec<f32>>>,
    stream: Option<SendStream>,
    source_rate: u32,
}

static RECORDING: Mutex<Option<RecordingState>> = Mutex::new(None);

// VAD state
struct VadState {
    stream: Option<SendStream>,
    running: Arc<AtomicBool>,
}

static VAD: Mutex<Option<VadState>> = Mutex::new(None);

static VAD_THRESHOLD: Mutex<f32> = Mutex::new(0.02);
static VAD_SILENCE_MS: Mutex<u32> = Mutex::new(1500);

const SAMPLE_RATE: u32 = 16000;
const MIN_AUDIO_SAMPLES: usize = (SAMPLE_RATE as usize) * 300 / 1000; // 300ms
const MAX_AUDIO_SAMPLES: usize = (SAMPLE_RATE as usize) * 30; // 30 seconds
const RMS_CHUNK_SIZE: usize = 512;

// ── Helpers ─────────────────────────────────────────────────────────────

fn compute_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum: f32 = samples.iter().map(|s| s * s).sum();
    (sum / samples.len() as f32).sqrt()
}

fn resample_to_16k(samples: &[f32], source_rate: u32) -> Vec<f32> {
    if source_rate == SAMPLE_RATE {
        return samples.to_vec();
    }
    let ratio = source_rate as f64 / SAMPLE_RATE as f64;
    let out_len = (samples.len() as f64 / ratio) as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;
        let s0 = samples[idx.min(samples.len() - 1)];
        let s1 = samples[(idx + 1).min(samples.len() - 1)];
        out.push(s0 + (s1 - s0) * frac as f32);
    }
    out
}

fn transcribe(audio: &[f32]) -> Result<String, String> {
    let state = WHISPER.get().ok_or("Whisper not initialized")?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);
    params.set_no_timestamps(true);

    let mut wstate = state
        .ctx
        .create_state()
        .map_err(|e| format!("Failed to create whisper state: {e}"))?;

    wstate
        .full(params, audio)
        .map_err(|e| format!("Whisper inference failed: {e}"))?;

    let n_segments = wstate.full_n_segments();
    let mut text = String::new();
    for i in 0..n_segments {
        if let Some(segment) = wstate.get_segment(i) {
            if let Ok(seg_text) = segment.to_str() {
                text.push_str(seg_text);
            }
        }
    }

    Ok(text.trim().to_string())
}

fn open_mic_stream(
    buffer: Arc<Mutex<Vec<f32>>>,
) -> Result<(cpal::Stream, u32), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device found")?;

    let config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get input config: {e}"))?;

    let source_rate = config.sample_rate().0;
    let channels = config.channels() as usize;

    let stream = device
        .build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Convert to mono and push to buffer
                let mono: Vec<f32> = if channels == 1 {
                    data.to_vec()
                } else {
                    data.chunks(channels)
                        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
                        .collect()
                };
                if let Ok(mut buf) = buffer.lock() {
                    // Cap at max recording length
                    let remaining = MAX_AUDIO_SAMPLES.saturating_sub(buf.len());
                    if remaining > 0 {
                        let take = mono.len().min(remaining);
                        buf.extend_from_slice(&mono[..take]);
                    }
                }
            },
            |err| {
                eprintln!("Audio stream error: {err}");
            },
            None,
        )
        .map_err(|e| format!("Failed to build input stream: {e}"))?;

    stream
        .play()
        .map_err(|e| format!("Failed to start stream: {e}"))?;

    Ok((stream, source_rate))
}

// ── Tauri Commands ──────────────────────────────────────────────────────

/// Load the whisper model from bundled resources. Safe to call multiple times.
#[tauri::command]
pub fn init_whisper(app: AppHandle) -> Result<(), String> {
    if WHISPER.get().is_some() {
        return Ok(());
    }

    let resource_path = app
        .path()
        .resolve("resources/ggml-tiny.en.bin", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve model path: {e}"))?;

    let path_str = resource_path
        .to_str()
        .ok_or("Invalid model path encoding")?;

    let ctx = WhisperContext::new_with_params(path_str, WhisperContextParameters::default())
        .map_err(|e| format!("Failed to load whisper model: {e}"))?;

    let _ = WHISPER.set(WhisperState { ctx });
    Ok(())
}

/// Start recording from the microphone (PTT flow).
#[tauri::command]
pub fn start_recording() -> Result<(), String> {
    let mut rec = RECORDING.lock().map_err(|e| format!("Lock error: {e}"))?;
    if rec.is_some() {
        return Err("Already recording".into());
    }

    let buffer = Arc::new(Mutex::new(Vec::with_capacity(SAMPLE_RATE as usize * 5)));
    let (stream, source_rate) = open_mic_stream(buffer.clone())?;

    *rec = Some(RecordingState {
        buffer,
        stream: Some(SendStream(stream)),
        source_rate,
    });

    Ok(())
}

/// Stop recording and return transcribed text (PTT flow).
#[tauri::command]
pub fn stop_recording() -> Result<String, String> {
    let mut rec = RECORDING.lock().map_err(|e| format!("Lock error: {e}"))?;
    let state = rec.take().ok_or("Not recording")?;

    let source_rate = state.source_rate;

    // Drop the stream to stop capturing
    drop(state.stream);

    let samples = state
        .buffer
        .lock()
        .map_err(|e| format!("Buffer lock error: {e}"))?
        .clone();

    // Resample to 16kHz for whisper
    let resampled = resample_to_16k(&samples, source_rate);

    if resampled.len() < MIN_AUDIO_SAMPLES {
        return Ok(String::new()); // Too short
    }

    transcribe(&resampled)
}

/// Start VAD monitoring — auto-transcribes speech and emits events.
#[tauri::command]
pub fn start_vad(app: AppHandle) -> Result<(), String> {
    let mut vad = VAD.lock().map_err(|e| format!("Lock error: {e}"))?;
    if vad.is_some() {
        return Err("VAD already running".into());
    }

    let buffer = Arc::new(Mutex::new(Vec::<f32>::with_capacity(SAMPLE_RATE as usize * 5)));
    let running = Arc::new(AtomicBool::new(true));

    let (stream, source_rate) = open_mic_stream(buffer.clone())?;

    // Spawn VAD monitoring thread
    let vad_buf = buffer.clone();
    let vad_running = running.clone();
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let mut speech_active = false;
        let mut silence_chunks = 0u32;

        loop {
            if !vad_running.load(Ordering::Relaxed) {
                break;
            }

            std::thread::sleep(std::time::Duration::from_millis(50));

            let threshold = *VAD_THRESHOLD.lock().unwrap_or_else(|e| e.into_inner());
            let silence_ms = *VAD_SILENCE_MS.lock().unwrap_or_else(|e| e.into_inner());
            let silence_chunks_threshold = silence_ms / 50; // 50ms poll interval

            let buf_snapshot = {
                let buf = vad_buf.lock().unwrap_or_else(|e| e.into_inner());
                buf.clone()
            };

            if buf_snapshot.is_empty() {
                continue;
            }

            // Check RMS of the latest chunk
            let check_len = RMS_CHUNK_SIZE.min(buf_snapshot.len());
            let tail = &buf_snapshot[buf_snapshot.len() - check_len..];
            let rms = compute_rms(tail);

            if rms > threshold {
                speech_active = true;
                silence_chunks = 0;
            } else if speech_active {
                silence_chunks += 1;

                if silence_chunks >= silence_chunks_threshold {
                    // Speech ended — transcribe
                    speech_active = false;
                    silence_chunks = 0;

                    // Get all audio and clear buffer
                    let samples = {
                        let mut buf = vad_buf.lock().unwrap_or_else(|e| e.into_inner());
                        let s = buf.clone();
                        buf.clear();
                        s
                    };

                    // Resample if needed
                    let resampled = resample_to_16k(&samples, source_rate);

                    if resampled.len() >= MIN_AUDIO_SAMPLES {
                        match transcribe(&resampled) {
                            Ok(text) if !text.is_empty() => {
                                let _ = app_handle.emit("stt-result", &text);
                            }
                            Ok(_) => {} // Empty transcription, skip
                            Err(e) => {
                                eprintln!("VAD transcription error: {e}");
                            }
                        }
                    }
                }
            } else {
                // No speech active, keep buffer from growing unbounded
                let mut buf = vad_buf.lock().unwrap_or_else(|e| e.into_inner());
                // Keep only last ~500ms of audio as lookback
                let keep = (source_rate as usize) / 2;
                if buf.len() > keep {
                    let drain = buf.len() - keep;
                    buf.drain(..drain);
                }
            }
        }
    });

    *vad = Some(VadState {
        stream: Some(SendStream(stream)),
        running,
    });

    Ok(())
}

/// Stop VAD monitoring.
#[tauri::command]
pub fn stop_vad() -> Result<(), String> {
    let mut vad = VAD.lock().map_err(|e| format!("Lock error: {e}"))?;
    if let Some(state) = vad.take() {
        state.running.store(false, Ordering::Relaxed);
        drop(state.stream);
    }
    Ok(())
}

/// Update VAD sensitivity at runtime.
#[tauri::command]
pub fn set_vad_config(threshold: f32, silence_ms: u32) -> Result<(), String> {
    *VAD_THRESHOLD.lock().map_err(|e| format!("Lock error: {e}"))? = threshold;
    *VAD_SILENCE_MS.lock().map_err(|e| format!("Lock error: {e}"))? = silence_ms;
    Ok(())
}
