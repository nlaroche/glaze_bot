"""Mic input with Silero VAD + faster-whisper STT."""

import os
import queue
import threading

import numpy as np
import sounddevice as sd


class Mic:
    def __init__(self, voice_ref, on_speech_done=None, on_transcript=None):
        """
        Args:
            voice_ref: Voice instance — checked to mute mic during TTS playback.
            on_speech_done: Optional callback when a transcript is ready (e.g. to force a frame send).
            on_transcript: Optional callback with the transcript text (e.g. to log to UI).
        """
        self.mode = os.getenv("MIC_MODE", "always_on")  # always_on | push_to_talk | off
        self.whisper_model_name = os.getenv("WHISPER_MODEL", "tiny.en")
        self.vad_sensitivity = float(os.getenv("VAD_SENSITIVITY", "0.5"))
        self.sample_rate = 16000

        self._voice = voice_ref
        self._on_speech_done = on_speech_done
        self._on_transcript = on_transcript
        self._transcript_queue: queue.Queue[str] = queue.Queue()
        self._audio_buffer: list[np.ndarray] = []
        self._is_speaking = False  # user is speaking
        self._silence_frames = 0
        self._running = False
        self._thread = None

        # Lazy-loaded models
        self._vad_model = None
        self._whisper = None
        self._ptt_held = False
        self._callback_count = 0
        self._speech_detect_count = 0

    def _load_vad(self):
        if self._vad_model is None:
            from silero_vad import load_silero_vad

            self._vad_model = load_silero_vad()

    def _load_whisper(self):
        if self._whisper is None:
            from faster_whisper import WhisperModel

            self._whisper = WhisperModel(
                self.whisper_model_name, device="cpu", compute_type="int8"
            )

    def _vad_check(self, audio_chunk: np.ndarray) -> bool:
        """Run VAD on a chunk. Returns True if speech detected."""
        import torch

        tensor = torch.from_numpy(audio_chunk).float()
        confidence = self._vad_model(tensor, self.sample_rate).item()

        if self._callback_count % 500 == 0:
            rms = np.sqrt(np.mean(audio_chunk ** 2))
            print(f"[mic] VAD conf={confidence:.3f}, rms={rms:.4f}", flush=True)

        return confidence > self.vad_sensitivity

    def _transcribe(self, audio: np.ndarray) -> str:
        """Transcribe audio buffer with faster-whisper."""
        self._load_whisper()
        segments, _ = self._whisper.transcribe(audio, language="en")
        text = " ".join(seg.text.strip() for seg in segments)
        return text.strip()

    def _audio_callback(self, indata, frames, time_info, status):
        """Called by sounddevice for each audio chunk."""
        self._callback_count += 1
        if self._callback_count == 100:
            peak = np.max(np.abs(indata))
            print(f"[mic] Callback alive, 100 chunks processed, peak={peak:.4f}", flush=True)

        if self._voice.is_speaking():
            return  # mute while TTS is playing

        if self.mode == "off":
            return

        audio = indata[:, 0].copy()  # mono

        # Auto-gain: boost quiet signals for VAD detection
        peak = np.max(np.abs(audio))
        if 0.0 < peak < 0.3:
            gain = min(0.3 / peak, 20.0)  # boost up to 20x, target 0.3 peak
            audio = audio * gain
            audio = np.clip(audio, -1.0, 1.0)

        if self.mode == "push_to_talk":
            if self._ptt_held:
                self._audio_buffer.append(audio)
            elif self._audio_buffer:
                # PTT released — transcribe
                self._flush_buffer()
            return

        # Always-on mode: use VAD
        try:
            is_speech = self._vad_check(audio)
        except Exception:
            return

        if is_speech:
            self._is_speaking = True
            self._silence_frames = 0
            self._audio_buffer.append(audio)
        elif self._is_speaking:
            self._silence_frames += 1
            # ~300ms silence at 512 samples/chunk = ~9 chunks
            if self._silence_frames > int(0.3 * self.sample_rate / 512):
                self._flush_buffer()
                self._is_speaking = False
                self._silence_frames = 0

    def _flush_buffer(self):
        """Concatenate audio buffer, transcribe, queue result."""
        if not self._audio_buffer:
            return
        audio = np.concatenate(self._audio_buffer)
        self._audio_buffer.clear()

        if len(audio) < self.sample_rate * 0.3:  # ignore <300ms clips
            return

        try:
            text = self._transcribe(audio)
            if text:
                safe = text.encode("ascii", "ignore").decode()
                print(f"[mic] Heard: {safe}", flush=True)
                self._transcript_queue.put(text)
                if self._on_transcript:
                    self._on_transcript(text)
                if self._on_speech_done:
                    self._on_speech_done()
        except Exception as e:
            err = str(e).encode("ascii", "ignore").decode()
            print(f"[mic] Transcription error: {err}", flush=True)

    def set_ptt(self, held: bool):
        """Set push-to-talk state."""
        was_held = self._ptt_held
        self._ptt_held = held
        if was_held and not held and self._audio_buffer:
            self._flush_buffer()

    def get_transcript(self) -> str | None:
        """Get the latest transcript, or None. Non-blocking."""
        texts = []
        while not self._transcript_queue.empty():
            try:
                texts.append(self._transcript_queue.get_nowait())
            except queue.Empty:
                break
        return " ".join(texts) if texts else None

    def start(self):
        """Start the mic input stream."""
        if self.mode == "off":
            print("[mic] Mic mode is off, skipping", flush=True)
            return

        try:
            self._load_vad()
            self._running = True

            device = os.getenv("MIC_DEVICE", "default")
            device_idx = None if device == "default" else int(device)

            dev_info = sd.query_devices(device_idx, 'input')
            print(f"[mic] Using device: {dev_info['name']}", flush=True)

            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype="float32",
                blocksize=512,
                device=device_idx,
                callback=self._audio_callback,
            )
            self._stream.start()
            print(f"[mic] Stream started (VAD sensitivity={self.vad_sensitivity})", flush=True)
        except Exception as e:
            err = str(e).encode("ascii", "ignore").decode()
            print(f"[mic] FAILED to start: {err}", flush=True)

    def stop(self):
        """Stop the mic input stream."""
        self._running = False
        if hasattr(self, "_stream") and self._stream:
            self._stream.stop()
            self._stream.close()
