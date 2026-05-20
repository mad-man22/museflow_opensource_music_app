import json
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from app.core.config import settings

class GeminiAIService:
    _initialized: bool = False

    @classmethod
    def initialize(cls):
        if not cls._initialized:
            if settings.GEMINI_API_KEY:
                try:
                    genai.configure(api_key=settings.GEMINI_API_KEY)
                    cls._initialized = True
                    print("[Gemini Service] Configured successfully.")
                except Exception as e:
                    print(f"[Gemini Service] Configuration failed: {e}")
            else:
                print("[Gemini Service] GEMINI_API_KEY environment variable is empty. Fallback mode active.")

    @classmethod
    def generate_playlist_queries(cls, prompt: str) -> Dict[str, Any]:
        """
        Uses Gemini to translate a natural language playlist request into search queries.
        Returns:
            Dict containing 'search_queries' (List of query strings) and 'mood_profile' (Dict of descriptors).
        """
        cls.initialize()

        default_fallback = {
            "search_queries": [prompt, f"{prompt} songs", "chill music"],
            "mood_profile": {"mood": "custom", "energy": 0.5, "tempo": "medium"}
        }

        if not cls._initialized:
            return default_fallback

        system_instruction = (
            "You are the core AI recommendation engine of MuseFlow, a premium music streaming client.\n"
            "Analyze the user's natural language music prompt. Output a JSON block mapping the prompt into:\n"
            "1. 'search_queries': An array of 4 distinct search queries (song names, artist search queries, or specific genres) to execute on YouTube Music that capture this vibe.\n"
            "2. 'mood_profile': An object containing 'mood' (e.g. happy, sad, nostalgic), 'energy' (0.0 to 1.0), and 'tempo' (slow, medium, fast).\n"
            "Ensure the output is valid JSON, containing ONLY the JSON object, without markdown block wrappers."
        )

        try:
            model = genai.GenerativeModel('gemini-flash-latest')
            response = model.generate_content(
                contents=[
                    {"role": "user", "parts": [f"System Instruction: {system_instruction}\n\nPrompt: {prompt}"]}
                ]
            )
            text = response.text.strip()
            
            # Remove potential markdown formatting (```json ... ```)
            if text.startswith("```"):
                text = text.replace("```json", "", 1).replace("```", "", 1).strip()
            
            data = json.loads(text)
            return data
        except Exception as e:
            print(f"[Gemini Service] Query generation error: {e}")
            return default_fallback

    @classmethod
    def classify_track_mood(cls, title: str, artist: str) -> Dict[str, Any]:
        """
        Classifies the mood coordinates of a track.
        """
        cls.initialize()

        default_fallback = {
            "mood": "unknown",
            "valence": 0.5,
            "energy": 0.5,
            "genres": ["general"]
        }

        if not cls._initialized:
            return default_fallback

        prompt = f"Track: {title} by {artist}. Classify this song's audio mood profile. Return a JSON object with keys: 'mood' (single word descriptor), 'valence' (0.0 to 1.0 slider of positive emotion), 'energy' (0.0 to 1.0 slider of high energy), and 'genres' (array of genres). No explanations, output only raw JSON."

        try:
            model = genai.GenerativeModel('gemini-flash-latest')
            response = model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = text.replace("```json", "", 1).replace("```", "", 1).strip()
            return json.loads(text)
        except Exception as e:
            print(f"[Gemini Service] Mood classification error: {e}")
            return default_fallback

    @classmethod
    def generate_synced_lyrics(cls, title: str, artist: str, duration_seconds: int) -> Optional[str]:
        """
        Uses Gemini to generate high-fidelity scrolling lyrics in .lrc format.
        """
        cls.initialize()
        if not cls._initialized:
            return None

        prompt = (
            f"Generate the complete lyrics for the song '{title}' by '{artist}' "
            f"in high-fidelity synced scrolling .lrc format. The song is {duration_seconds} seconds long.\n\n"
            f"Requirements:\n"
            f"1. Output ONLY the .lrc formatted text. No code blocks, no markdown wrappers, no introductions, no explanations.\n"
            f"2. Use the standard timestamp format [mm:ss.xx] at the start of each line, e.g. [00:12.34] Lyric text.\n"
            f"3. Make sure the timestamps are accurately and realistically spread throughout the {duration_seconds} seconds of the song.\n"
            f"4. Include intro/outro indicators like [00:00.00] (Instrumental Intro) and [00:10.00] (Verse 1) as needed."
        )

        try:
            model = genai.GenerativeModel('gemini-flash-latest')
            response = model.generate_content(prompt)
            text = response.text.strip()
            
            # Remove potential markdown formatting
            if text.startswith("```"):
                text = text.replace("```json", "", 1).replace("```lrc", "", 1).replace("```", "", 1).strip()
            
            # Basic validation: check if it has timestamps
            if "[" in text and "]" in text:
                return text
            return None
        except Exception as e:
            print(f"[Gemini Service] Lyrics generation error: {e}")
            return None

    @classmethod
    def align_lyrics_with_timestamps(cls, title: str, artist: str, lyrics_text: str, duration_seconds: int) -> Optional[str]:
        """
        Uses Gemini to timing-sync official plain lyrics into .lrc format.
        """
        cls.initialize()
        if not cls._initialized:
            return None

        prompt = (
            f"Official lyrics for '{title}' by '{artist}':\n\n"
            f"{lyrics_text}\n\n"
            f"The song is {duration_seconds} seconds long.\n\n"
            f"Please convert these plain text lyrics into high-fidelity synced scrolling .lrc format by adding highly realistic [mm:ss.xx] timestamps to the start of each line, matching the actual timing of the song.\n\n"
            f"Requirements:\n"
            f"1. Output ONLY the .lrc formatted text. No code blocks, no markdown wrappers, no introductions, no explanations.\n"
            f"2. Use the standard timestamp format [mm:ss.xx] at the start of each line, e.g. [00:12.34] Lyric text.\n"
            f"3. Make sure the timestamps are accurately and realistically spread throughout the {duration_seconds} seconds of the song."
        )

        try:
            model = genai.GenerativeModel('gemini-flash-latest')
            response = model.generate_content(prompt)
            text = response.text.strip()
            
            # Remove potential markdown formatting
            if text.startswith("```"):
                text = text.replace("```json", "", 1).replace("```lrc", "", 1).replace("```", "", 1).strip()
            
            if "[" in text and "]" in text:
                return text
            return None
        except Exception as e:
            print(f"[Gemini Service] Lyrics alignment error: {e}")
            return None


