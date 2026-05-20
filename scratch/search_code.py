import os

def search_text(root_dir, text):
    matches = []
    for root, dirs, files in os.walk(root_dir):
        # Skip virtual env and pycache
        if "venv" in root or "__pycache__" in root:
            continue
        for file in files:
            if file.endswith(".py") or file.endswith(".ts") or file.endswith(".tsx"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines):
                        if text in line:
                            matches.append((path, idx + 1, line.strip()))
                except Exception as e:
                    pass
    return matches

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print("Searching for 'hashed_password' in", root)
    results = search_text(root, "hashed_password")
    for r in results:
        print(f"File: {r[0]} | Line: {r[1]} | Content: {r[2]}")

if __name__ == "__main__":
    main()
