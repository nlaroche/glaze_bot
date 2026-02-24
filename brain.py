"""Vision LLM client — supports Dashscope (Qwen VL) and Anthropic (Claude)."""

import base64
import os
import random

from openai import OpenAI

# Random style nudges injected each call to force variety
STYLE_NUDGES = [
    "Describe ONE specific thing you see on screen and react to that, not the vibe.",
    "Reference a specific movie, show, or meme that this moment reminds you of.",
    "Make a bold prediction about what will happen in the next 30 seconds.",
    "Roast the player's decision-making with love. Be specific about what they did wrong.",
    "Compare what just happened to something completely unrelated and absurd.",
    "React as if this is the single greatest or worst moment in gaming history.",
    "Ask a rhetorical question that highlights the absurdity of the situation.",
    "Give a backhanded compliment about the play you just witnessed.",
    "Narrate this moment as if it is the climax of a documentary about the player.",
    "Pick one object or character on screen and fixate on it for your whole response.",
    "React to the player's health, gold, or resources specifically — not just the action.",
    "Say something that would make sense as commentary on a nature documentary.",
    "Imagine you are commentating this for someone who cannot see the screen.",
    "Pretend this exact moment will be in a montage, describe why.",
    "React to the PACE of what is happening — is it frantic, slow, building tension?",
    "Notice something small or in the background that nobody else would comment on.",
    "Express a strong opinion about something on screen that does not matter at all.",
    "Compare the player to a specific fictional character based on what they just did.",
]


class Brain:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "dashscope")
        self.model = os.getenv("VISION_MODEL", "qwen3-vl-flash")
        self.max_tokens = int(os.getenv("MAX_RESPONSE_TOKENS", "150"))
        self.max_history = 10

        # Dashscope client (OpenAI-compatible)
        self._dashscope_client = OpenAI(
            api_key=os.getenv("DASHSCOPE_API_KEY"),
            base_url=os.getenv(
                "VISION_BASE_URL",
                "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            ),
        )

        # Anthropic client (lazy-loaded)
        self._anthropic_client = None
        self._anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

        # Per-character conversation histories keyed by character name
        self._histories: dict[str, list[dict]] = {}

        # Token/cost tracking
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_calls = 0

    def _get_anthropic_client(self):
        if self._anthropic_client is None:
            from anthropic import Anthropic
            self._anthropic_client = Anthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY"),
            )
        return self._anthropic_client

    def _get_history(self, char_name: str) -> list[dict]:
        """Get or create the history list for a character."""
        if char_name not in self._histories:
            self._histories[char_name] = []
        return self._histories[char_name]

    def _build_personality_modifier(self, personality: dict | None) -> str:
        """Build a personality modifier string from trait values. Only includes non-neutral traits."""
        if not personality:
            return ""
        labels = {
            "energy": ("very calm and low-energy", "very high-energy and hyped up"),
            "positivity": ("cynical and pessimistic", "optimistic and upbeat"),
            "formality": ("very casual and informal", "very formal and proper"),
            "talkativeness": ("terse and brief", "chatty and verbose"),
            "attitude": ("hostile and aggressive", "friendly and warm"),
            "humor": ("dead serious", "silly and goofy"),
        }
        parts = []
        for trait, (low_desc, high_desc) in labels.items():
            val = personality.get(trait, 50)
            if val < 30:
                parts.append(f"Be {low_desc}")
            elif val < 45:
                parts.append(f"Be somewhat {low_desc}")
            elif val > 70:
                parts.append(f"Be {high_desc}")
            elif val > 55:
                parts.append(f"Be somewhat {high_desc}")
        if not parts:
            return ""
        return "\n[Personality adjustment: " + ". ".join(parts) + ".]"

    def clear_history(self, char_name: str):
        """Clear history for a specific character."""
        self._histories.pop(char_name, None)

    def _build_user_content(
        self,
        frame_b64: str,
        player_text: str | None,
        react_to: dict | None = None,
        game_hint: str = "",
    ) -> list[dict]:
        """Build the multimodal user message content (OpenAI format)."""
        parts = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{frame_b64}"},
            }
        ]

        nudge = random.choice(STYLE_NUDGES)
        context_prefix = f"[Game: {game_hint}] " if game_hint else ""

        if react_to:
            other_name = react_to["name"]
            other_text = react_to["text"]
            parts.append(
                {
                    "type": "text",
                    "text": (
                        f'{context_prefix}{other_name} just said: "{other_text}" — '
                        f"React to what they said, agree or disagree or riff on it. "
                        f"Stay in your own character. Style hint: {nudge}"
                    ),
                }
            )
        elif player_text:
            parts.append(
                {
                    "type": "text",
                    "text": f'{context_prefix}The player said: "{player_text}" — respond to them. Style hint: {nudge}',
                }
            )
        else:
            parts.append(
                {
                    "type": "text",
                    "text": f"{context_prefix}React to what you see on screen. Style hint: {nudge}",
                }
            )

        return parts

    def _chat_dashscope(
        self, system_prompt: str, history: list[dict], user_content: list[dict]
    ) -> tuple[str, int, int]:
        """Call Dashscope/Qwen via OpenAI-compatible API. Returns (reply, input_tokens, output_tokens)."""
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_content})

        response = self._dashscope_client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self.max_tokens,
            temperature=1.2,
            presence_penalty=2.0,
            frequency_penalty=1.0,
        )

        reply = response.choices[0].message.content.strip()
        inp = response.usage.prompt_tokens if response.usage else 0
        out = response.usage.completion_tokens if response.usage else 0
        return reply, inp, out

    def _chat_anthropic(
        self, system_prompt: str, history: list[dict], user_content: list[dict], frame_b64: str
    ) -> tuple[str, int, int]:
        """Call Anthropic Claude API. Returns (reply, input_tokens, output_tokens)."""
        client = self._get_anthropic_client()

        # Convert user_content to Anthropic format
        anthro_content = []
        anthro_content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": frame_b64,
            },
        })
        # Add text parts
        for part in user_content:
            if part["type"] == "text":
                anthro_content.append({"type": "text", "text": part["text"]})

        # Convert history to Anthropic format (text-only history is already compatible)
        anthro_messages = list(history)
        anthro_messages.append({"role": "user", "content": anthro_content})

        model = self._anthropic_model if self.provider == "anthropic" else self.model

        response = client.messages.create(
            model=model,
            system=system_prompt,
            messages=anthro_messages,
            max_tokens=self.max_tokens,
        )

        reply = response.content[0].text.strip()
        inp = response.usage.input_tokens
        out = response.usage.output_tokens
        return reply, inp, out

    def chat(
        self,
        frame_b64: str,
        player_text: str | None = None,
        character: dict | None = None,
        react_to: dict | None = None,
        game_hint: str = "",
    ) -> str | None:
        """Send a frame to the vision model as a specific character.

        Args:
            frame_b64: Base64-encoded screenshot.
            player_text: What the player said (if anything).
            character: Character dict with name, system_prompt, voice.
            react_to: If set, {"name": ..., "text": ...} of another character to react to.
            game_hint: Optional game context string (e.g. "Elden Ring").

        Returns the response text, or None if the model says [SILENCE].
        """
        if character is None:
            return None

        char_name = character["name"]
        system_prompt = character["system_prompt"]
        system_prompt += self._build_personality_modifier(character.get("personality"))
        history = self._get_history(char_name)

        user_content = self._build_user_content(frame_b64, player_text, react_to, game_hint)

        if self.provider == "anthropic":
            reply, inp, out = self._chat_anthropic(system_prompt, history, user_content, frame_b64)
        else:
            reply, inp, out = self._chat_dashscope(system_prompt, history, user_content)

        # Track usage
        self.total_input_tokens += inp
        self.total_output_tokens += out
        self.total_calls += 1

        # Update rolling history (text-only summary to save tokens)
        if react_to:
            text_summary = f'{react_to["name"]} said: "{react_to["text"]}"'
        else:
            text_summary = player_text or "(screen only)"
        history.append({"role": "user", "content": text_summary})
        history.append({"role": "assistant", "content": reply})

        # Trim history
        while len(history) > self.max_history * 2:
            history.pop(0)
            history.pop(0)

        # Handle silence
        if "[SILENCE]" in reply.upper():
            return None

        return reply

    def estimated_cost(self) -> float:
        """Estimate session cost in USD."""
        if self.provider == "anthropic":
            # Claude Haiku 4.5 pricing: $0.80/M input, $4.00/M output
            input_cost = self.total_input_tokens * 0.80 / 1_000_000
            output_cost = self.total_output_tokens * 4.00 / 1_000_000
        else:
            # Qwen3-VL-Flash pricing
            input_cost = self.total_input_tokens * 0.065 / 1_000_000
            output_cost = self.total_output_tokens * 0.52 / 1_000_000
        return input_cost + output_cost
