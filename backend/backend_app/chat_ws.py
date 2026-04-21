import json
import os

from channels.generic.websocket import AsyncWebsocketConsumer

from openai import AsyncOpenAI


OPENAI_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
OPENAI_SYSTEM_PROMPT = os.getenv(
    "OPENAI_CHAT_SYSTEM_PROMPT",
    (
        "You are a concise e-commerce assistant for FrontLabs. "
        "Help with products, delivery, returns, payment, and account issues. "
        "Give practical short answers."
    ),
)


class AIChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            await self.send(
                text_data=json.dumps(
                    {
                        "message": "Empty payload. Send JSON like {\"message\": \"hello\"}.",
                    }
                )
            )
            return

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"message": "Invalid JSON payload."}))
            return

        user_message = str(payload.get("message", "")).strip()
        if not user_message:
            await self.send(text_data=json.dumps({"message": "Message is required."}))
            return

        reply = await self._generate_reply(user_message)
        await self.send(text_data=json.dumps({"message": reply}))

    async def _generate_reply(self, user_message: str) -> str:
        api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
        if not api_key:
            return (
                "Live AI is not configured on backend. "
                "Set OPENAI_API_KEY in backend .env and restart server."
            )

        try:
            client = AsyncOpenAI(api_key=api_key)
            response = await client.responses.create(
                model=OPENAI_MODEL,
                input=[
                    {"role": "system", "content": OPENAI_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                max_output_tokens=240,
            )
            text = (response.output_text or "").strip()
            if text:
                return text
            return "I could not generate a response. Please try again."
        except Exception:
            return "AI service is temporarily unavailable. Please retry in a moment."
