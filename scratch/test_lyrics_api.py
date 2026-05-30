import httpx

def test_lyrics():
    track_id = "dQw4w9WgXcQ" # Rick Roll song
    url = f"http://localhost:8000/api/v1/tracks/lyrics/{track_id}"
    try:
        resp = httpx.get(url, timeout=5.0)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print("Response structure keys:", list(data.keys()))
            print("Synced:", data.get("synced"))
            print("Source:", data.get("source"))
            print("Lyrics snippet:", data.get("lyrics")[:200] if data.get("lyrics") else "None")
        else:
            print("Error details:", resp.text)
    except Exception as e:
        print("Request failed:", e)

if __name__ == "__main__":
    test_lyrics()
