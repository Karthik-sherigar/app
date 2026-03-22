import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
key = os.environ.get("GEMINI_API_KEY_3")

async def test():
    try:
        client = genai.Client(api_key=key, http_options={'api_version': 'v1beta'})
        print("Testing gemini-3.1-flash-image-preview...")
        response = await client.aio.models.generate_content(
            model='gemini-3.1-flash-image-preview',
            contents='a simple technical diagram of a computer'
        )
        print(f"Response: {response}")
        # Check if it has an image part
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                print("Found inline_data!")
                print(f"Mime type: {part.inline_data.mime_type}")
                print(f"Data length: {len(part.inline_data.data)}")
            if part.text:
                print(f"Text: {part.text}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
