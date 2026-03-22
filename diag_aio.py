import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
key = os.environ.get("GEMINI_API_KEY_3")

async def test():
    try:
        client = genai.Client(api_key=key)
        print(f"Client hasattr aio: {hasattr(client, 'aio')}")
        if hasattr(client, 'aio'):
            print(f"aio hasattr models: {hasattr(client.aio, 'models')}")
            if hasattr(client.aio, 'models'):
                print(f"aio.models dir: {dir(client.aio.models)}")
                print(f"aio.models hasattr generate_image: {hasattr(client.aio.models, 'generate_image')}")
                print(f"aio.models hasattr generate_images: {hasattr(client.aio.models, 'generate_images')}")
    except Exception as e:
        print(f"Fatal Error: {e}")

asyncio.run(test())
