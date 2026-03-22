import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
key = os.environ.get("GEMINI_API_KEY_3")

async def test():
    try:
        client = genai.Client(api_key=key)
        print(f"Client: {type(client)}")
        print(f"Models: {type(client.models)}")
        print(f"Models attributes: {dir(client.models)}")
        
        # Test if it can generate image (sync)
        # try:
        #    resp = client.models.generate_images(model='imagen-3', prompt='a test image')
        #    print("Sync Success")
        # except Exception as e:
        #    print(f"Sync Fail: {e}")

    except Exception as e:
        print(f"Fatal Error: {e}")

asyncio.run(test())
