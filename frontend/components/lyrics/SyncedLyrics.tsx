"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePlaybackStore } from "../../store/usePlaybackStore";

interface LyricLine {
  time: number; // In seconds
  text: string;
}

interface SyncedLyricsProps {
  trackId: string;
}

export const SyncedLyrics: React.FC<SyncedLyricsProps> = ({ trackId }) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { currentTime } = usePlaybackStore();

  // Fetch and parse lyrics
  useEffect(() => {
    const fetchLyrics = async () => {
      try {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const res = await fetch(`http://${host}:8000/api/v1/tracks/lyrics/${trackId}`);
        if (!res.ok) throw new Error("Lyrics fetch failed");
        
        const data = await res.json();
        const rawLyrics = data.lyrics || "";
        
        // Parse .lrc format
        const lines = rawLyrics.split("\n");
        const parsedLines: LyricLine[] = [];
        // Regex to match all timestamps in a line (e.g., [01:23.45] or [01:23:45] or [01:23] or multiple)
        const timestampRegexGlobal = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
        const timestampRegexSingle = /\[(\d+):(\d+)(?:[.:](\d+))?\]/;

        lines.forEach((line: string) => {
          const matches = line.match(timestampRegexGlobal);
          if (matches) {
            // Clean lyrics text by removing all timestamps from the line
            const text = line.replace(timestampRegexGlobal, "").trim();
            
            matches.forEach((matchStr) => {
              const match = timestampRegexSingle.exec(matchStr);
              if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                let fractional = 0;
                
                if (match[3]) {
                  // Using parseFloat("0." + match[3]) correctly parses any decimal precision
                  // (e.g., "5" -> 0.5s, "50" -> 0.5s, "500" -> 0.5s, "05" -> 0.05s)
                  fractional = parseFloat("0." + match[3]);
                }
                
                const time = minutes * 60 + seconds + fractional;
                parsedLines.push({ time, text });
              }
            });
          }
        });

        // Sort by time ascending
        parsedLines.sort((a, b) => a.time - b.time);
        setLyrics(parsedLines);
        setActiveLineIndex(-1);
      } catch (err) {
        console.error("Lyrics error:", err);
        setLyrics([{ time: 0, text: "Lyrics unavailable for this track" }]);
      }
    };

    fetchLyrics();
  }, [trackId]);

  // Compute the current active lyric line based on track play progression
  useEffect(() => {
    if (lyrics.length === 0) return;

    let targetIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        targetIndex = i;
      } else {
        break;
      }
    }

    if (targetIndex !== activeLineIndex) {
      setActiveLineIndex(targetIndex);
      
      // Auto-scroll active line to the center of container
      if (targetIndex !== -1 && containerRef.current) {
        const activeElement = lineRefs.current[targetIndex];
        if (activeElement) {
          containerRef.current.scrollTo({
            top: activeElement.offsetTop - containerRef.current.clientHeight / 2 + activeElement.clientHeight / 2,
            behavior: "smooth"
          });
        }
      }
    }
  }, [currentTime, lyrics, activeLineIndex]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-y-auto px-4 py-8 space-y-6 flex flex-col items-center glass-panel rounded-2xl relative"
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#14141c] to-transparent pointer-events-none z-10 opacity-70" />
      
      {lyrics.map((line, idx) => {
        const isActive = idx === activeLineIndex;
        
        return (
          <div
            key={idx}
            ref={(el) => {
              lineRefs.current[idx] = el;
            }}
            className={`text-center py-2 px-6 rounded-2xl select-none cursor-pointer max-w-xl ${
              isActive 
                ? "lyrics-active text-2xl font-extrabold text-white" 
                : "lyrics-inactive text-lg font-medium text-zinc-400 hover:text-white"
            }`}
          >
            {line.text}
          </div>
        );
      })}

      <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#14141c] to-transparent pointer-events-none z-10 opacity-70" />
    </div>
  );
};
