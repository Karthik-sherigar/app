import os
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
key = os.environ.get("GEMINI_API_KEY_3")

def list_all():
    try:
        client = genai.Client(api_key=key, http_options={'api_version': 'v1beta'})
        models = client.models.list()
        print("Available Models:")
        for m in models:
            print(f"- {m.name}")
    except Exception as e:
        print(f"Error: {e}")

list_all()
