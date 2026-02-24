"""TTS wrapper — supports Kokoro (local) and ElevenLabs (cloud)."""

import io
import os
import re
import threading

import numpy as np
import sounddevice as sd


def _clean_for_tts(text: str) -> str:
    """Strip emojis, asterisks, markdown, and other non-speech characters."""
    text = re.sub(
        r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF'
        r'\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U0001FA00-\U0001FA6F'
        r'\U0001FA70-\U0001FAFF\U00002600-\U000026FF\U0000FE00-\U0000FE0F'
        r'\U0000200D\U00002B50\U00002B55\U000023F0-\U000023FF\U0000231A-\U0000231B]+',
        '', text
    )
    text = text.replace('*', '')
    text = re.sub(r'[#_~`>]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class Voice:
    def __init__(self):
        self.engine = os.getenv("TTS_ENGINE", "kokoro")
        self.voice = os.getenv("TTS_VOICE", "af_heart")
        self.speaking = threading.Event()
        self._lock = threading.Lock()

        # Kokoro
        self._kokoro = None

        # ElevenLabs
        self._eleven_client = None
        self._eleven_voice_id = None

    def _ensure_kokoro(self):
        if self._kokoro is None:
            from kokoro_onnx import Kokoro
            self._kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")

    def _ensure_eleven(self):
        if self._eleven_client is None:
            from elevenlabs.client import ElevenLabs
            api_key = os.getenv("ELEVENLABS_API_KEY")
            if not api_key:
                raise ValueError("ELEVENLABS_API_KEY not set in .env")
            self._eleven_client = ElevenLabs(api_key=api_key)

    def set_voice(self, voice: str):
        self.voice = voice

    def _speak_kokoro(self, text: str, voice: str):
        self._ensure_kokoro()
        samples, sample_rate = self._kokoro.create(text, voice=voice, speed=1.0)
        audio = np.array(samples, dtype=np.float32)
        sd.play(audio, samplerate=sample_rate)
        sd.wait()

    def _speak_eleven(self, text: str, voice: str):
        self._ensure_eleven()
        audio_gen = self._eleven_client.text_to_speech.convert(
            text=text,
            voice_id=voice,
            model_id="eleven_turbo_v2_5",
            output_format="pcm_24000",
        )
        # Collect all audio chunks
        audio_bytes = b""
        for chunk in audio_gen:
            audio_bytes += chunk

        # Convert PCM bytes to numpy array (16-bit signed int -> float32)
        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        sd.play(audio, samplerate=24000)
        sd.wait()

    def speak(self, text: str, voice: str | None = None):
        """Generate and play TTS audio. Blocks until playback finishes."""
        if not text:
            return

        text = _clean_for_tts(text)
        if not text:
            return

        use_voice = voice or self.voice

        with self._lock:
            try:
                self.speaking.set()
                if self.engine == "elevenlabs":
                    self._speak_eleven(text, use_voice)
                else:
                    self._speak_kokoro(text, use_voice)
            except Exception as e:
                err = str(e).encode("ascii", "ignore").decode()
                print(f"[voice] TTS error: {err}", flush=True)
            finally:
                self.speaking.clear()

    def is_speaking(self) -> bool:
        return self.speaking.is_set()
