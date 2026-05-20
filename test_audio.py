import urllib.request
import urllib.error

url = "http://127.0.0.1:3001/play?videoId=4NRXx6U8ABQ"
print(f"Testing URL: {url}")
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    print(f"Status Code: {response.getcode()}")
    print(f"Headers: {response.info()}")
    # read a tiny chunk to verify stream works
    chunk = response.read(1024)
    print(f"Successfully read {len(chunk)} bytes from stream!")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} - {e.reason}")
    print(e.read().decode('utf-8', errors='ignore'))
except Exception as e:
    print(f"Error: {e}")
