import sys
filepath = r"C:\Users\Keertan BJ\.gemini\antigravity\scratch\museflow\frontend\components\player\PersistentPlayer.tsx"

sys.stdout.reconfigure(encoding='utf-8')

with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "SyncedLyrics" in line or "lyrics" in line.lower():
        print(f"{i+1}: {line.strip()}")
