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
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [anticipation, setAnticipation] = useState<number>(0.15); // Default 150ms anticipation offset
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { audioRef, isPlaying, currentTrack } = usePlaybackStore();
  const [localTime, setLocalTime] = useState<number>(0);

  // High-resolution polling loop (60fps) using requestAnimationFrame to bypass the
  // low-resolution browser audio update events (~250-300ms intervals), which cause laggy lyrics.
  useEffect(() => {
    let animationFrameId: number;

    const updateLoop = () => {
      if (audioRef) {
        setLocalTime(audioRef.currentTime);
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateLoop);
    } else {
      if (audioRef) {
        setLocalTime(audioRef.currentTime);
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, audioRef]);

  // Fetch and parse lyrics
  useEffect(() => {
    const fetchLyrics = async () => {
      try {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        
        // Helper to safely format artist names as a clean comma-separated string
        const normalizeArtists = (artists: any): string => {
          if (!artists) return "";
          if (typeof artists === "string") return artists;
          if (Array.isArray(artists)) {
            return artists
              .map((a: any) => (typeof a === "string" ? a : a?.name || a?.author || ""))
              .filter(Boolean)
              .join(", ");
          }
          return artists?.name || artists?.author || "";
        };

        const title = currentTrack?.title || "";
        const artist = currentTrack ? normalizeArtists(currentTrack.artists) : "";
        const duration = currentTrack?.duration || "";

        const queryParams = new URLSearchParams();
        if (title) queryParams.append("title", title);
        if (artist) queryParams.append("artist", artist);
        if (duration) queryParams.append("duration", String(duration));

        const queryString = queryParams.toString();
        const url = `http://${host}:8000/api/v1/tracks/lyrics/${trackId}${queryString ? `?${queryString}` : ""}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Lyrics fetch failed");
        
        const data = await res.json();
        const rawLyrics = data.lyrics || "";
        
        // Check if rawLyrics actually has timestamps, otherwise parse as plain lyrics
        if (data.synced === false || !rawLyrics.includes("[")) {
          const plainLines = rawLyrics.split("\n").map((line: string) => ({
            time: -1,
            text: line.trim()
          })).filter((l: any) => l.text);
          
          setLyrics(plainLines);
          setIsSynced(false);
          setActiveLineIndex(-1);
          return;
        }

        setIsSynced(true);
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
        setIsSynced(false);
      }
    };

    fetchLyrics();
  }, [trackId, currentTrack]);

  // Compute the current active lyric line based on high-resolution localTime progression.
  // We apply the custom dynamic anticipation offset (anticipation state) so the next line highlights
  // slightly before the vocals, which is customizable in real-time by the user!
  useEffect(() => {
    if (!isSynced || lyrics.length === 0) return;

    let targetIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (localTime + anticipation >= lyrics[i].time) {
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
  }, [localTime, lyrics, activeLineIndex, isSynced, anticipation]);

  // Format dynamic anticipation visual offset (compact)
  const getOffsetLabel = () => {
    const diff = Number((anticipation - 0.15).toFixed(2));
    if (diff === 0) return "Perfect";
    return diff > 0 ? `+${diff}s` : `${diff}s`;
  };

  return (
    <div className="relative w-full h-full">
      {/* ── Compact Dynamic Lyrics Sync Timing Capsule (Top-Right Corner - Fixed position) ── */}
      {isSynced && lyrics.length > 0 && (
        <div 
          className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-white/5 backdrop-blur-xl z-30 shadow-lg select-none transition-all duration-300 hover:border-purple-500/20"
          style={{
            background: "linear-gradient(135deg, rgba(20,20,30,0.95) 0%, rgba(10,10,18,0.98) 100%)",
          }}
        >
          <button 
            onClick={() => setAnticipation(prev => Number((prev + 0.25).toFixed(2)))}
            className="w-5.5 h-5.5 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-xs font-bold flex items-center justify-center"
            title="Highlight earlier (Vocal anticipation)"
          >
            +
          </button>
          <span className="text-[9px] font-extrabold tracking-widest uppercase text-zinc-400 font-mono px-0.5 select-none">
            {getOffsetLabel()}
          </span>
          <button 
            onClick={() => setAnticipation(prev => Number((prev - 0.25).toFixed(2)))}
            className="w-5.5 h-5.5 rounded-full bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all text-xs font-bold flex items-center justify-center"
            title="Highlight later (Delay highlight)"
          >
            -
          </button>
        </div>
      )}

      {/* ── Scrollable Lyrics Sheet ── */}
      <div 
        ref={containerRef}
        className="w-full h-full overflow-y-auto px-4 py-8 space-y-6 flex flex-col items-center glass-panel rounded-2xl relative"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-[#14141c] to-transparent pointer-events-none z-10 opacity-70" />
        
        {lyrics.map((line, idx) => {
          const isActive = isSynced && idx === activeLineIndex;
          
          return (
            <div
              key={idx}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              className={`text-center py-2 px-6 rounded-2xl select-none cursor-pointer max-w-xl transition-all duration-300 ${
                isActive 
                  ? "lyrics-active text-2xl font-extrabold text-white scale-105" 
                  : isSynced
                    ? "lyrics-inactive text-lg font-medium text-zinc-400 hover:text-white"
                    : "text-lg font-semibold text-zinc-300 hover:text-white"
              }`}
            >
              {line.text}
            </div>
          );
        })}

        <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-[#14141c] to-transparent pointer-events-none z-10 opacity-70" />
      </div>
    </div>
  );
};
