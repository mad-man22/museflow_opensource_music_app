import os

frontend_dir = r"C:\Users\Keertan BJ\.gemini\antigravity\scratch\museflow\frontend"

for root, dirs, files in os.walk(frontend_dir):
    if "node_modules" in root or ".next" in root:
        continue
    for file in files:
        if file.endswith((".ts", ".tsx")):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            if "8000" in content or "3001" in content:
                print(f"Found hardcoded port in: {os.path.relpath(path, frontend_dir)}")
                lines = content.splitlines()
                for i, line in enumerate(lines):
                    if "8000" in line or "3001" in line:
                        print(f"  Line {i+1}: {line.strip()}")
