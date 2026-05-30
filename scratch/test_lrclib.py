import httpx
import time

def test_google():
    url = "https://www.google.com"
    start = time.time()
    try:
        resp = httpx.get(url, timeout=5.0)
        end = time.time()
        print(f"Google Connect Status: {resp.status_code}")
        print(f"Time Taken: {end - start:.2f} seconds")
    except Exception as e:
        print("Google Connect failed:", e)

if __name__ == "__main__":
    test_google()
