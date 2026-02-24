# Gaming Companion — Build Guide

Your own Questie clone. Captures your screen every 1-2 seconds, listens to you via mic, sends both to a vision model, speaks reactions back. Always-on voice chat with your AI gaming buddy. Runs in the system tray. Costs ~$0-3/month.

---

## Architecture

```
Screen (1-2fps) → Change Detection ─┐
                                     ├→ Vision LLM → Kokoro TTS → Speakers
Mic → VAD → faster-whisper (local) ─┘    (free tier)   (local, free)
      (voice activity detection)
```

Two input streams merge into every LLM call: **what you see** + **what you said**. The mic is always-on by default — Silero VAD listens for your voice, transcribes locally with faster-whisper, and attaches it to the next frame. Switch to push-to-talk via tray menu or hotkey if you don't want open mic.

**System tray app** with:
- On/off toggle
- Character picker
- Voice picker
- Mic mode: Always-on / Push-to-talk / Off
- Capture interval slider
- Cost counter (so you can see spend in real-time)

---

## The Cheap Stack

### Vision LLM (the only thing that costs money)

You want 1-2 second capture rate. That's 1800-3600 API calls/hour if you send every frame. That's expensive. The trick: **change detection**. Only send frames where something actually changed on screen. During gameplay, ~30-50% of frames have meaningful change. During menus/loading: ~5%. This cuts your actual API calls to maybe 300-800/hour.

| Provider | Model | Price | Free Tier | Notes |
|----------|-------|-------|-----------|-------|
| **Google AI Studio** | Gemini 2.5 Flash Lite | $0.10/$0.40 per M tokens | 1500 RPD | Best free tier. ~2-3 hrs gaming/day for free |
| **Google AI Studio** | Gemini 2.5 Flash | $0.15/$0.60 per M tokens | 1500 RPD | Better quality, slightly more expensive |
| **OpenRouter** | Qwen3-VL-235B (free) | $0.00 | 200 RPD, 20 RPM | Frontier quality, very limited quota |
| **OpenRouter** | Qwen3-VL-8B | $0.08/$0.50 per M tokens | — | Cheapest paid vision model |
| **SiliconFlow** | Qwen2.5-VL-7B | $0.05/$0.05 per M tokens | — | Absolute cheapest per-token |

**Recommendation:** Start with Gemini 2.5 Flash Lite free tier. With change detection you'll get 2-4 hours of gaming per day at zero cost. If you exceed the free tier, it auto-falls back to paid at ~$0.05-0.15/hour. Monthly cost for heavy use: $3-8.

### TTS (free, local)

| Engine | Size | Latency | Quality | Install |
|--------|------|---------|---------|---------|
| **Kokoro** | 82M params | <300ms | Excellent. Rivals paid APIs | `pip install kokoro-onnx` |
| **Chatterbox** | ~1B | ~1-2s | Beats ElevenLabs in blind tests, voice cloning | Heavier, needs GPU |
| **Edge-TTS** | Cloud | ~500ms | Good Microsoft voices | `pip install edge-tts`, needs internet |

**Recommendation:** Kokoro. It's tiny, fast, sounds great, runs on CPU, and has 50+ voices. Zero ongoing cost.

### Screen Capture

`mss` — fast, lightweight, works on Windows/Mac/Linux. Handles multi-monitor. ~2ms per capture.

### Voice Input (free, local)

| Component | What | Size | Notes |
|-----------|------|------|-------|
| **Silero VAD** | Voice activity detection | ~2MB | Detects when you're speaking vs silence/game audio. Runs on CPU, <1ms per chunk |
| **faster-whisper** | Speech-to-text | ~150MB (tiny) to ~1.5GB (medium) | Local Whisper. The `tiny.en` model is fine for English gaming chat — fast and accurate enough |

**How it works:**

1. Mic is always streaming audio in a background thread
2. Silero VAD watches the stream. When it detects speech → starts recording
3. When speech stops (300ms silence) → sends audio buffer to faster-whisper
4. Transcription gets attached to the next LLM call alongside the screenshot
5. The LLM sees both what's on screen AND what you said, responds accordingly

**Push-to-talk mode:** VAD is bypassed. Recording only happens while you hold the PTT key (`V` by default). Same pipeline after that.

**Why not cloud STT?** Whisper tiny.en transcribes in <200ms locally. No API cost, no latency, no privacy concerns with always-on mic.

---

## Project Structure

```
gaming-companion/
├── .env                    ← Your API keys (only file you edit)
├── main.py                 ← Entry point, system tray app
├── capture.py              ← Screen grab + change detection
├── brain.py                ← Vision LLM client (OpenAI-compatible)
├── voice.py                ← Kokoro TTS wrapper
├── mic.py                  ← VAD + faster-whisper STT
├── tray.py                 ← System tray UI
├── characters/             ← Drop JSON files here to add characters
│   ├── sage.json           ← Tactical advisor
│   ├── hype.json           ← Hype man / entertainer  
│   ├── vex.json            ← In-world RPG companion
│   └── narrator.json       ← Darkest Dungeon narrator
├── requirements.txt
└── README.md
```

---

## Setup (One-Time)

### 1. Get API Keys

**Gemini (primary, free tier):**
1. Go to https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy it

**OpenRouter (fallback, more models):**
1. Go to https://openrouter.ai/settings/keys
2. Create key
3. Add $5 credit (lasts months)

### 2. Install Dependencies

```bash
# Python 3.11+
pip install mss Pillow google-generativeai openai kokoro-onnx pystray keyboard python-dotenv numpy sounddevice faster-whisper silero-vad
```

On Linux you'll also need:
```bash
sudo apt install libportaudio2
```

On Mac:
```bash
brew install portaudio
```

### 3. Create .env

```env
# === REQUIRED (pick at least one) ===
GEMINI_API_KEY=your_gemini_key_here

# === OPTIONAL (for more model options) ===
OPENROUTER_API_KEY=your_openrouter_key_here

# === SETTINGS ===
# Vision model (options below)
VISION_PROVIDER=gemini
VISION_MODEL=gemini-2.5-flash-lite

# Capture
CAPTURE_INTERVAL=1.5
CAPTURE_MONITOR=0
CAPTURE_SCALE=0.4
CAPTURE_QUALITY=50
CHANGE_THRESHOLD=0.03

# TTS
TTS_ENGINE=kokoro
TTS_VOICE=af_heart

# Mic / Voice Input
MIC_MODE=always_on
MIC_DEVICE=default
WHISPER_MODEL=tiny.en
PTT_KEY=v
VAD_SENSITIVITY=0.5

# Behavior  
MAX_RESPONSE_TOKENS=150
SILENCE_THRESHOLD=3
```

### 4. Run

```bash
python main.py
```

That's it. System tray icon appears. Right-click for menu.

---

## .env Reference

### Vision Providers & Models

```env
# --- Gemini (recommended, best free tier) ---
VISION_PROVIDER=gemini
VISION_MODEL=gemini-2.5-flash-lite    # cheapest, good enough
VISION_MODEL=gemini-2.5-flash         # better quality

# --- OpenRouter (300+ models, one API) ---
VISION_PROVIDER=openrouter
VISION_MODEL=qwen/qwen3-vl-235b-a22b-instruct:free   # free, frontier quality, 200 RPD
VISION_MODEL=qwen/qwen3-vl-8b-instruct                # $0.08/M input, cheapest paid
VISION_MODEL=google/gemini-2.5-flash-lite              # Gemini via OpenRouter
VISION_MODEL=openai/gpt-4o-mini                        # if you want OpenAI

# --- SiliconFlow (cheapest per-token) ---  
VISION_PROVIDER=siliconflow
VISION_MODEL=Qwen/Qwen2.5-VL-7B-Instruct              # $0.05/M tokens
```

### Kokoro Voices

```env
# Female
TTS_VOICE=af_heart       # warm, expressive (default)
TTS_VOICE=af_bella       # clear, professional
TTS_VOICE=af_sarah       # friendly, casual
TTS_VOICE=af_nicole      # calm, soothing
TTS_VOICE=bf_emma        # British female
TTS_VOICE=bf_isabella    # British, warm

# Male  
TTS_VOICE=am_adam        # American male, deep
TTS_VOICE=am_michael     # American, clear
TTS_VOICE=bm_george      # British male
TTS_VOICE=bm_lewis       # British, deeper
TTS_VOICE=bm_daniel      # British, authoritative
```

Run `python -c "import kokoro_onnx; print(kokoro_onnx.VOICES)"` to see all available voices.

### Capture Settings

```env
CAPTURE_INTERVAL=1.5        # Seconds between screenshots (1-2 for fast reactions)
CAPTURE_MONITOR=0           # 0=all screens, 1=primary, 2=secondary
CAPTURE_SCALE=0.4           # Resize factor (0.3-0.5 recommended, saves tokens)
CAPTURE_QUALITY=50          # JPEG quality (40-60 is fine for vision models)
CHANGE_THRESHOLD=0.03       # Min pixel change to trigger API call (0.01-0.10)
                            # Lower = more sensitive, more API calls
                            # Higher = less reactive, cheaper
```

### Mic Settings

```env
MIC_MODE=always_on          # always_on | push_to_talk | off
MIC_DEVICE=default          # "default" or device index (run `python -c "import sounddevice; print(sounddevice.query_devices())"` to list)
WHISPER_MODEL=tiny.en       # tiny.en (fastest, English only, ~150MB)
                            # base.en (better accuracy, ~300MB)
                            # small.en (best quality, ~1GB, needs decent CPU)
PTT_KEY=v                   # Push-to-talk key (only used in push_to_talk mode)
VAD_SENSITIVITY=0.5         # 0.0-1.0, higher = needs louder speech to trigger
                            # If it's picking up game audio, raise this to 0.7-0.8
                            # If it's missing your voice, lower to 0.3
```

**Mic tips:**
- Use a headset. Open speakers + always-on mic = the VAD will trigger on TTS output (feedback loop). A headset with a close mic isolates your voice
- If you use speakers, set `VAD_SENSITIVITY=0.7` and the TTS pipeline should mute the mic while speaking
- `tiny.en` is all you need for casual gaming chat. It handles "nice shot", "what should I do", "go left" perfectly. Only upgrade if you need non-English or long dictation

---

## Characters

Drop a `.json` file in `characters/` and it shows up in the tray menu. Format:

```json
{
  "name": "Sage",
  "voice": "am_adam",
  "description": "Calm tactical advisor",
  "system_prompt": "You are Sage, a calm tactical gaming advisor. You're watching the player's screen via screenshots taken every 1-2 seconds, and you can hear them speak via transcription.\n\nRules:\n- 1-2 sentences MAX. You'll be speaking via TTS so keep it tight\n- If the player says something, ALWAYS respond to them — they're talking to you\n- Otherwise, only comment when something interesting happens (combat, loot, deaths, mistakes, cool moments)\n- If nothing notable and the player didn't speak: respond with exactly [SILENCE]\n- Reference specific things on screen\n- Don't repeat yourself\n- Don't narrate obvious things\n- Adapt to whatever game is being played"
}
```

### Included Characters

**Sage** — Tactical advisor. Calm, helpful, spots things you miss. Voice: `am_adam`

**Hype** — Entertainer. Gets excited, roasts you, drops jokes. Voice: `am_michael`

**Vex** — In-world rogue. Stays in character, never breaks the fourth wall. Sarcastic. Voice: `bm_george`

**The Narrator** — Darkest Dungeon vibes. Dramatic, gothic, loves your suffering. Voice: `bm_daniel`

---

## Change Detection (Why This Is Cheap)

The naive approach (send every frame) at 1.5s intervals = 2400 frames/hour = expensive.

Instead, each frame is compared against the last frame that was actually sent to the API. If less than `CHANGE_THRESHOLD` (3% by default) of pixels changed significantly, it's skipped. This means:

- **Loading screens**: ~0 API calls (static image)
- **Menus**: ~2-5 calls/minute (only when cursor moves significantly)
- **Active gameplay**: ~20-40 calls/minute (lots of movement)
- **Cutscenes**: ~5-10 calls/minute (gradual changes)

Real-world average: **~400-800 calls/hour** instead of 2400. That's 60-70% savings.

---

## Cost Calculator

With Gemini 2.5 Flash Lite ($0.10/M input, $0.40/M output):

| Gaming per day | With change detection | Monthly cost |
|----------------|----------------------|-------------|
| 1 hour | ~500 calls | Free (under 1500 RPD free tier) |
| 2 hours | ~1200 calls | Free (under 1500 RPD) |
| 3 hours | ~1800 calls | ~$2-4 (exceeds free tier some days) |
| 5 hours | ~3000 calls | ~$5-10 |

Each call: ~1500 input tokens (image + context) + ~75 output tokens ≈ $0.00018/call.

**The free tier covers most people.** If you're gaming 2 hours a day, you'll pay $0/month.

---

## Hotkeys

| Key | Action |
|-----|--------|
| `V` (hold) | Push-to-talk (when in PTT mode) |
| `F7` | Cycle mic mode: Always-on → Push-to-talk → Off |
| `F8` | Toggle companion on/off |
| `F9` | Next character |
| `F10` | Force a comment now |
| `F12` | Quit |

These work globally even when your game is in focus.

---

## System Tray Menu

Right-click the tray icon:

```
🎮 Gaming Companion
├── ▶ Resume / ⏸ Pause
├── 🎭 Character ▸
│   ├── ✓ Sage
│   ├──   Hype
│   ├──   Vex
│   └──   The Narrator
├── 🔊 Voice ▸
│   ├── ✓ am_adam
│   ├──   bm_george
│   ├──   af_heart
│   └──   bm_daniel
├── 🎤 Mic ▸
│   ├── ✓ Always On
│   ├──   Push-to-Talk (V)
│   └──   Off
├── ⚡ Interval ▸
│   ├──   1.0s (fast, more API calls)
│   ├── ✓ 1.5s (balanced)
│   ├──   3.0s (chill)
│   └──   5.0s (cheap)
├── 💰 Session: $0.02 (142 calls)
├── 🚀 Start on boot
└── ❌ Quit
```

---

## Implementation Notes

### Key Libraries

```python
# Screen capture
import mss                    # Fast screen grab

# Change detection  
import numpy as np            # Pixel diff between frames

# Vision LLM
import google.generativeai    # Gemini direct
from openai import OpenAI     # OpenRouter (OpenAI-compatible)

# TTS
from kokoro_onnx import Kokoro  # Local neural TTS
import sounddevice as sd        # Audio playback + mic input

# STT (voice input)
from faster_whisper import WhisperModel  # Local speech-to-text
from silero_vad import load_silero_vad   # Voice activity detection

# System tray
import pystray                # Cross-platform tray icon
from PIL import Image         # Tray icon image

# Config
from dotenv import load_dotenv  # .env loading

# Hotkeys
import keyboard               # Global hotkeys (needs sudo on Linux)
```

### Async Pipeline

Three concurrent loops that merge at the LLM call:

```
CAPTURE LOOP:    F1 ─── F2 ─── F3 ─── F4 ─── F5
                  │      (no diff, skip)  │
MIC LOOP:        ───── "go left" ─────── "what's that?" ──
                         │                      │
LLM CALLS:       ───send(F1)────recv──  ───send(F4+"what's that?")────recv──
                                  │                                     │
TTS:                          speak()                               speak()
```

- **Capture loop** runs on fixed interval, applies change detection, queues frames
- **Mic loop** runs continuously. VAD triggers → record → transcribe → buffer the text
- **LLM loop** takes the latest frame + any buffered transcription, sends to API
- **TTS playback** mutes the mic input while speaking (prevents feedback loop)

The mic text is ephemeral — it gets attached to the next API call and cleared. If you say something during a loading screen (no frame diff), it forces an API call with the current frame anyway, because you explicitly spoke.

### LLM Message Construction

Each API call sends the system prompt + conversation history + current turn. The current turn varies:

```python
# Player didn't say anything, just a new frame
user_message = "[Screenshot attached] React to what you see on screen."

# Player said something
user_message = "[Screenshot attached] The player said: \"what's in that chest?\""

# Player said something + forced comment
user_message = "[Screenshot attached] The player said: \"help me here\" — give them a useful response."
```

When the player speaks, **always prioritize responding to them** over reacting to the screen. The character should feel like a real conversation partner, not just a narrator.

### Auto-Start on Boot

**Windows:** Create a shortcut in `shell:startup` pointing to `pythonw main.py`

**Mac:** Create a LaunchAgent plist in `~/Library/LaunchAgents/`

**Linux:** Add a `.desktop` file to `~/.config/autostart/`

The "Start on boot" tray option should handle this automatically by creating/removing the appropriate file.

---

## Possible Upgrades (Later)

- **Transparent overlay**: Small floating window showing character avatar + last message
- **Game detection**: Auto-switch characters based on which `.exe` is running
- **OBS integration**: Route TTS audio to a virtual mic for streaming
- **Local vision model**: Run Qwen2.5-VL-7B via ollama for $0/forever (needs decent GPU + VRAM headroom)
- **Conversation memory**: Summarize every N messages and inject into system prompt for longer context
- **Voice cloning**: Use Chatterbox or F5-TTS to clone a specific voice for your character

---

## Quick Reference

```bash
# Setup
pip install mss Pillow google-generativeai openai kokoro-onnx pystray keyboard python-dotenv numpy sounddevice faster-whisper silero-vad

# Edit config
nano .env

# Run  
python main.py

# List Kokoro voices
python -c "import kokoro_onnx; print(kokoro_onnx.VOICES)"

# List mic devices
python -c "import sounddevice; print(sounddevice.query_devices())"

# Test whisper
python -c "from faster_whisper import WhisperModel; m = WhisperModel('tiny.en'); print('Whisper ready')"
```
