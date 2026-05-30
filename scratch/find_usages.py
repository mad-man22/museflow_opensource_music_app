import os

def find_usages():
    frontend_dir = r"C:\Users\Keertan BJ\.gemini\antigravity\scratch\museflow\frontend"
    matches = []
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                        if "AddToPlaylistModal" in content:
                            matches.append(filepath)
                except Exception as e:
                    pass
    
    print("Found AddToPlaylistModal in:")
    for m in matches:
        print(f" - {m}")

if __name__ == "__main__":
    find_usages()
