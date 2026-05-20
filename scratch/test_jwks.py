import urllib.request
import json

def main():
    url = "https://dgorxcykntoibkqsaorh.supabase.co/auth/v1/.well-known/jwks.json"
    print("Fetching JWKS from:", url)
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            print("✅ Successfully fetched JWKS!")
            print("Keys found:", len(data.get("keys", [])))
            for k in data.get("keys", []):
                print(f"  Key ID (kid): {k.get('kid')}, Alg: {k.get('alg')}")
    except Exception as e:
        print("❌ Failed to fetch JWKS:", e)

if __name__ == "__main__":
    main()
