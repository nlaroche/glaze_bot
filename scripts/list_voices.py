"""List available ElevenLabs voices for character assignment."""

import os
from dotenv import load_dotenv

load_dotenv()

from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
response = client.voices.get_all()

print(f"{'Name':<25} {'Voice ID':<25} {'Labels'}")
print("-" * 80)
for voice in response.voices:
    labels = ", ".join(f"{k}={v}" for k, v in (voice.labels or {}).items())
    print(f"{voice.name:<25} {voice.voice_id:<25} {labels}")
