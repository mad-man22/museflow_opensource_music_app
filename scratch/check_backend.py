import sys
import os
import traceback

# Add backend directory to path
backend_dir = r"C:\Users\Keertan BJ\.gemini\antigravity\scratch\museflow\backend"
sys.path.insert(0, backend_dir)

def test_import():
    try:
        from app.main import app
        print("SUCCESS: FastAPI backend imported successfully with no syntax or runtime errors!")
    except Exception as e:
        print("ERROR: Failed to import backend!")
        traceback.print_exc()

if __name__ == "__main__":
    test_import()
