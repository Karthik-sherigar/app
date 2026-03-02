import httpx
import asyncio

async def test():
    key = "FPSX9e484a8f9e1bff7530a4c8249db38398"
    headers = {
        "x-freepik-api-key": key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    url = "https://api.freepik.com/v1/ai/text-to-image"
    payload = {
        "prompt": "test image of a cat",
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, headers=headers, json=payload, timeout=30.0)
            print(f"Status: {resp.status_code}")
            x = resp.json()
            if x.get('data') and len(x['data']) > 0:
                print(list(x['data'][0].keys()))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test())
