from app.core.config import settings

def main():
    print("GEMINI_API_KEY:", settings.GEMINI_API_KEY)
    print("STREAM_SERVICE_URL:", settings.STREAM_SERVICE_URL)

if __name__ == "__main__":
    main()
