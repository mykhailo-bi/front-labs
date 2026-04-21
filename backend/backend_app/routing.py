from django.urls import re_path

from backend_app.chat_ws import AIChatConsumer


websocket_urlpatterns = [
    re_path(r"^ws/chat/?$", AIChatConsumer.as_asgi()),
]
