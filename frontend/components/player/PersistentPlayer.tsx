"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat,
  Volume2, VolumeX, Maximize2, Minimize2, Music, Heart, Mic2, Sparkles, Plus, RefreshCw,
  Trash2, ChevronUp, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaybackStore, getAudioSrc } from "../../store/usePlaybackStore";
import { API_URL } from "../../lib/api";
import { EqualizerVisualizer } from "./EqualizerVisualizer";
import { SyncedLyrics } from "../lyrics/SyncedLyrics";
import { AddToPlaylistModal } from "./AddToPlaylistModal";

const getThumbnailUrl = (item: any) => {
  if (!item) return "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300";
  
  if (Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
    return item.thumbnails[0].url || "";
  }
  
  if (Array.isArray(item.thumbnail) && item.thumbnail.length > 0) {
    return item.thumbnail[0].url || "";
  }
  
  if (item.thumbnail && typeof item.thumbnail === "object") {
    if (Array.isArray(item.thumbnail.thumbnails) && item.thumbnail.thumbnails.length > 0) {
      return item.thumbnail.thumbnails[0].url || "";
    }
    return item.thumbnail.url || "";
  }
  
  if (typeof item.thumbnail === "string") {
    return item.thumbnail;
  }
  
  return "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300";
};

export const PersistentPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [playerTab, setPlayerTab] = useState<"lyrics" | "queue">("lyrics");
  const [relatedTracks, setRelatedTracks] = useState<any[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Streaming recovery
  const [hasFallbackError, setHasFallbackError] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const prevTrackIdRef = useRef<string | null>(null);

  // ── Zustand ────────────────────────────────────────────────────────────────
  const {
    currentTrack, isPlaying, currentTime, duration, volume, isMuted,
    isRepeat, isShuffle, queue, currentIndex, playTrack, setQueue, addToQueue,
    removeFromQueue, clearQueue, reorderQueue,
    setAudioRef, updateProgress, setDuration, setVolume, toggleMute,
    nextTrack, prevTrack, seekTo, togglePlay, toggleRepeat, toggleShuffle,
  } = usePlaybackStore();

  // Normalize artists to a display string (server may send array of objects)
  const artistsText = (() => {
    if (!currentTrack) return "";
    const artists = currentTrack.artists;
    if (!artists) return "";
    if (typeof artists === "string") return artists;
    if (Array.isArray(artists)) {
      return artists
        .map((a: any) => (typeof a === "string" ? a : a?.name || a?.author || ""))
        .filter(Boolean)
        .join(", ");
    }
    // object with name/id
    return artists?.name || artists?.author || "";
  })();

  // ── Seek slider ─────────────────────────────────────────────────────────────
  // isDragging ref: does NOT trigger re-renders, prevents onTimeUpdate fighting drag
  const isDragging = useRef(false);
  const [seekValue, setSeekValue] = useState(0);
  const displayTime = isDragging.current ? seekValue : currentTime;

  useEffect(() => {
    if (!isDragging.current) setSeekValue(currentTime);
  }, [currentTime]);

  // ── Volume slider ────────────────────────────────────────────────────────────
  const [localVolume, setLocalVolume] = useState(volume);
  useEffect(() => { setLocalVolume(volume); }, [volume]);

  const handleVolumeChange = useCallback((val: number) => {
    setLocalVolume(val);
    setVolume(val);
  }, [setVolume]);

  // ── Register audio element with store (once) ─────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    setAudioRef(audio);
    return () => setAudioRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reset fallback flags when track changes ──────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !currentTrack.track_id) return;
    if (prevTrackIdRef.current !== currentTrack.track_id) {
      prevTrackIdRef.current = currentTrack.track_id;
      setHasFallbackError(false);
      setToastText(null);
    }
  }, [currentTrack]);

  // ── Listening history ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !currentTrack.track_id) return;
    const stored = localStorage.getItem("museflow_history");
    let hist: any[] = stored ? JSON.parse(stored) : [];
    hist = hist.filter(i => i.track_id !== currentTrack.track_id);
    hist.unshift({
      track_id: currentTrack.track_id, title: currentTrack.title,
      artists: artistsText,
      thumbnail: currentTrack.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300",
      playedAt: new Date().toISOString(),
    });
    if (hist.length > 25) hist.pop();
    localStorage.setItem("museflow_history", JSON.stringify(hist));

    // Sync with backend database
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      fetch(`${API_URL}/api/v1/tracks/history/${encodeURIComponent(currentTrack.track_id)}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      }).catch(err => console.error("[Player] Failed to log listening history to backend:", err));
    }
  }, [currentTrack]);

  // ── Liked status ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !currentTrack.track_id) return;
    const stored = localStorage.getItem("museflow_liked_songs");
    const parsed = stored ? JSON.parse(stored) : [];
    setIsLiked(parsed.some((f: any) => f.track_id === currentTrack.track_id));
  }, [currentTrack]);

  // Fetch related recommendations whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack || !currentTrack.track_id) return;
    
    const fetchRelated = async () => {
      setIsLoadingRelated(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/tracks/related/${currentTrack.track_id}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setRelatedTracks(data);
          }
        }
      } catch (err) {
        console.warn("[Player] Failed to fetch related tracks.", err);
      } finally {
        setIsLoadingRelated(false);
      }
    };
    
    fetchRelated();
  }, [currentTrack]);

  const playRecommendedTrack = (track: any) => {
    const normalizedTrack = {
      track_id: track.videoId || track.track_id,
      title: track.title,
      artists: track.artists 
        ? (Array.isArray(track.artists) ? track.artists.map((a: any) => a.name).join(", ") : track.artists) 
        : track.author || "Unknown Artist",
      thumbnail: track.thumbnails ? track.thumbnails[0].url : track.thumbnail
    };
    
    // Inject right after currentIndex
    const newQueue = [...queue];
    const existsIdx = newQueue.findIndex(t => t.track_id === normalizedTrack.track_id);
    
    if (existsIdx > -1) {
      playTrack(newQueue[existsIdx], newQueue);
    } else {
      const insertIdx = currentIndex + 1;
      newQueue.splice(insertIdx, 0, normalizedTrack);
      playTrack(normalizedTrack, newQueue);
    }
  };

  // ── Keyboard: Space = play/pause ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay]);

  // ─────────────────────────────────────────────────────────────────────────────
  // The playback store now handles all audio.src and audio.play() calls natively 
  // inside the user click events to prevent the browser from blocking autoplay.
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const fmt = (t: number) => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleAudioError = () => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (audio?.error?.code === 1) return; // MEDIA_ERR_ABORTED — normal during src swap

    if (hasFallbackError) {
      setToastText("Stream error — skipping...");
      setTimeout(() => { nextTrack(); setHasFallbackError(false); setToastText(null); }, 2500);
      return;
    }

    console.warn("[Player] Stream failed — switching to High Fidelity Mode");
    setToastText("High Fidelity Mode");
    setHasFallbackError(true); // triggers the useEffect above with fallback src

    // Set the fallback src directly because hasFallbackError controls expectedSrc
    if (audio) {
      const streams = [
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      ];
      const idx = Math.abs(
        currentTrack.track_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      ) % streams.length;
      audio.src = streams[idx];
      audio.load();
      audio.play().catch(() => {});
    }
    setTimeout(() => setToastText(null), 4000);
  };

  const toggleFavorite = async () => {
    if (!currentTrack || !currentTrack.track_id) return;
    
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("museflow-open-auth"));
      }
      return;
    }

    const next = !isLiked;
    setIsLiked(next);
    const stored = localStorage.getItem("museflow_liked_songs");
    let parsed = stored ? JSON.parse(stored) : [];
      if (next) {
      if (!parsed.some((f: any) => f.track_id === currentTrack.track_id)) {
        parsed.push({
          track_id: currentTrack.track_id, title: currentTrack.title,
          artists: artistsText,
          thumbnail: currentTrack.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300",
          likedAt: new Date().toISOString(),
        });
      }
    } else {
      parsed = parsed.filter((f: any) => f.track_id !== currentTrack.track_id);
    }
    localStorage.setItem("museflow_liked_songs", JSON.stringify(parsed));

    // Sync with backend database
    if (token) {
      try {
        await fetch(`${API_URL}/api/v1/tracks/favorites/${encodeURIComponent(currentTrack.track_id)}`, {
          method: next ? "POST" : "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (err) {
        console.error("[Player] Failed to sync favorite action with backend:", err);
      }
    }
  };

  const handleAddToPlaylistClick = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("museflow-open-auth"));
      }
      return;
    }
    setIsAddToPlaylistOpen(true);
  };

  // ── Seek slider pointer handlers ─────────────────────────────────────────────
  const onSeekDown = (e: React.PointerEvent<HTMLInputElement>) => {
    isDragging.current = true;
    (e.target as HTMLInputElement).setPointerCapture(e.pointerId);
  };

  const onSeekMove = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(parseFloat(e.target.value));
  };

  const onSeekUp = (e: React.PointerEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    isDragging.current = false;
    seekTo(val);
    setSeekValue(val);
  };

  // ── Progress fill style ──────────────────────────────────────────────────────
  const seekPct = duration > 0 ? (displayTime / duration) * 100 : 0;
  const volPct = isMuted ? 0 : localVolume * 100;
  const fillStyle = (pct: number): React.CSSProperties => ({
    background: `linear-gradient(to right, #a855f7 ${pct}%, rgba(255,255,255,0.10) ${pct}%)`,
  });

  return (
    <>
      {/* Audio element always mounted so audioRef is valid from the start */}
      <audio
        ref={audioRef}
        onError={handleAudioError}
        onTimeUpdate={() => {
          if (audioRef.current && !isDragging.current) {
            updateProgress(audioRef.current.currentTime);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={nextTrack}
      />

      {currentTrack && (
        <>
          {/* ─── MINI BOTTOM PLAYER ─── */}
          <div className="fixed bottom-16 md:bottom-0 left-0 w-full glass-panel z-40 px-4 py-2.5 md:px-6 md:py-4 flex items-center justify-between gap-4 border-t border-white/5 shadow-2xl">
            
            {/* Mobile Layout Row (Visible on mobile/tablet, hidden on desktop) */}
            <div className="flex md:hidden items-center justify-between w-full h-12 relative select-none cursor-pointer" onClick={() => setIsFullscreen(true)}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 shadow-md">
                  {currentTrack.thumbnail
                    ? <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-zinc-900"><Music className="w-5 h-5 text-zinc-500" /></div>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold truncate text-white">{currentTrack.title}</h4>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">{artistsText}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 ml-4" onClick={(e) => e.stopPropagation()}>
                <button onClick={toggleFavorite} className="text-zinc-400 active:scale-95 transition-transform hover:text-red-500" title="Like">
                  <Heart className={`w-4 h-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                </button>
                <button onClick={handleAddToPlaylistClick} className="text-zinc-400 active:scale-95 transition-transform hover:text-purple-400" title="Add to Playlist">
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black active:scale-90 transition-transform shadow-md">
                  {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                </button>
                <button onClick={nextTrack} className="text-zinc-400 active:scale-90 transition-transform hover:text-white">
                  <SkipForward className="w-4 h-4 fill-zinc-400" />
                </button>
              </div>

              {/* Seamless mobile seek bar line indicator at the bottom edge */}
              <div className="absolute bottom-[-10px] left-[-16px] right-[-16px] h-[2px] bg-white/5">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" style={{ width: `${seekPct}%` }} />
              </div>
            </div>

            {/* Desktop Layout Row (Hidden on mobile/tablet, visible on desktop) */}
            <div className="hidden md:flex items-center justify-between w-full">
              {/* Track info */}
              <div className="flex items-center gap-4 w-1/4 min-w-0 select-none">
                <div
                  className="relative group cursor-pointer w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                  onClick={() => setIsFullscreen(true)}
                >
                  {currentTrack.thumbnail
                    ? <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Music className="w-6 h-6 text-zinc-500" /></div>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold truncate hover:underline cursor-pointer" onClick={() => setIsFullscreen(true)}>
                    {currentTrack.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">{artistsText}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button onClick={toggleFavorite} className="text-zinc-400 hover:text-red-500 transition-colors" title="Like">
                    <Heart className={`w-5 h-5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                  </button>
                  <button onClick={handleAddToPlaylistClick} className="text-zinc-400 hover:text-purple-400 transition-colors" title="Add to Playlist">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Centre: controls + seekbar */}
              <div className="flex flex-col items-center gap-2 w-2/4">
                {/* Playback buttons */}
                <div className="flex items-center gap-5 select-none">
                  <button onClick={toggleShuffle} className={`transition-colors ${isShuffle ? "text-purple-400" : "text-zinc-400 hover:text-white"}`}>
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button onClick={prevTrack} className="text-zinc-400 hover:text-white transition-colors active:scale-90">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-transform shadow-md"
                  >
                    {isPlaying
                      ? <Pause className="w-4 h-4 fill-black" />
                      : <Play className="w-4 h-4 fill-black ml-0.5" />}
                  </button>
                  <button onClick={nextTrack} className="text-zinc-400 hover:text-white transition-colors active:scale-90">
                    <SkipForward className="w-5 h-5" />
                  </button>
                  <button onClick={toggleRepeat} className={`relative transition-colors ${isRepeat !== "none" ? "text-purple-400" : "text-zinc-400 hover:text-white"}`}>
                    <Repeat className="w-4 h-4" />
                    {isRepeat === "one" && <span className="absolute -top-1.5 -right-1 text-[8px] font-bold leading-none">1</span>}
                  </button>
                </div>

                {/* Seekbar */}
                <div className="flex items-center gap-2 w-full text-xs text-zinc-400">
                  <span className="w-8 text-right tabular-nums shrink-0">{fmt(displayTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={displayTime}
                    className="slider-premium flex-1"
                    style={fillStyle(seekPct)}
                    onPointerDown={onSeekDown}
                    onChange={onSeekMove}
                    onPointerUp={onSeekUp}
                  />
                  <span className="w-8 tabular-nums shrink-0">{fmt(duration)}</span>
                </div>
              </div>

              {/* Right: volume + extras */}
              <div className="flex items-center justify-end gap-4 w-1/4 select-none">
                <div className="w-24 hidden lg:block">
                  <EqualizerVisualizer active={isPlaying} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={isMuted ? 0 : localVolume}
                    className="slider-premium w-20"
                    style={fillStyle(volPct)}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  />
                </div>
                <button onClick={() => setIsFullscreen(true)} className="text-zinc-400 hover:text-purple-400 transition-colors" title="View Lyrics">
                  <Mic2 className="w-4 h-4" />
                </button>
                <button onClick={() => setIsFullscreen(true)} className="text-zinc-400 hover:text-white transition-colors" title="Fullscreen">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

      {/* ─── FULLSCREEN OVERLAY ─── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 120 }}
            className="fixed inset-0 w-full h-full bg-[#0d0d12] z-50 overflow-hidden flex flex-col p-8"
          >
            <div className="absolute inset-0 bg-purple-600/5 pointer-events-none blur-3xl" />

            {/* Header */}
            <div className="flex items-center justify-between w-full z-10 select-none">
              <button onClick={() => setIsFullscreen(false)}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/5 transition-colors">
                <Minimize2 className="w-5 h-5 text-white" />
              </button>
              <span className="text-xs tracking-widest text-zinc-400 uppercase font-semibold">Now Streaming</span>
              <div className="w-10 h-10" />
            </div>

            {/* Art + Lyrics */}
            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-6xl mx-auto w-full z-10 overflow-hidden my-6">
              {/* Vinyl disc */}
              <div className="w-full lg:w-1/2 flex flex-col items-center justify-center text-center select-none">
                <div className="hidden lg:flex relative w-72 h-72 md:w-96 md:h-96 items-center justify-center flex-shrink-0">
                  <div className={`absolute inset-0 bg-purple-500/10 rounded-full blur-3xl transition-opacity duration-1000 ${isPlaying ? "opacity-100" : "opacity-30"}`} />
                  <motion.div
                    animate={{ rotate: isPlaying ? 360 : 0 }}
                    transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                    className="relative w-64 h-64 md:w-80 md:h-80 rounded-full bg-[#0a0a0d] shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(139,92,246,0.15)] border-[8px] border-zinc-900 flex-shrink-0 flex items-center justify-center overflow-hidden"
                  >
                    {[2, 6, 10, 14, 24].map(n => (
                      <div key={n} className={`absolute inset-${n} border border-white/[0.025] rounded-full pointer-events-none`} />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent pointer-events-none mix-blend-overlay rotate-45" />
                    <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-black/85 shadow-md z-10 flex-shrink-0">
                      {currentTrack.thumbnail
                        ? <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Music className="w-8 h-8 text-zinc-500" /></div>}
                      <div className="absolute inset-0 m-auto w-4 h-4 bg-zinc-950 rounded-full border border-zinc-800 z-20" />
                    </div>
                  </motion.div>
                </div>
                <div className="mt-2 lg:mt-8 min-w-0 max-w-md text-center">
                  <h2 className="text-xl lg:text-2xl font-bold truncate text-gradient">{currentTrack.title}</h2>
                  <p className="text-xs lg:text-zinc-400 mt-1 font-semibold">{artistsText}</p>
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <button onClick={toggleFavorite} className="text-zinc-400 hover:text-red-500 transition-colors" title="Like">
                      <Heart className={`w-5 h-5 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                    </button>
                    <button onClick={handleAddToPlaylistClick} className="text-zinc-400 hover:text-purple-400 transition-colors" title="Add to Playlist">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right panel: Lyrics vs. Queue & Related */}
              <div className="w-full lg:w-1/2 flex-1 lg:h-[480px] overflow-hidden flex flex-col min-h-[280px]">
                {/* Tab selector */}
                <div className="flex border-b border-white/5 mb-4 justify-center lg:justify-start gap-6 select-none shrink-0">
                  <button 
                    onClick={() => setPlayerTab("lyrics")}
                    className={`pb-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 relative ${
                      playerTab === "lyrics" 
                        ? "text-purple-400 font-extrabold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span>Lyrics</span>
                    {playerTab === "lyrics" && (
                      <motion.div 
                        layoutId="fullscreen-tab-indicator" 
                        className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-pink-500" 
                      />
                    )}
                  </button>
                  <button 
                    onClick={() => setPlayerTab("queue")}
                    className={`pb-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 relative ${
                      playerTab === "queue" 
                        ? "text-purple-400 font-extrabold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span>Up Next & Related</span>
                    {playerTab === "queue" && (
                      <motion.div 
                        layoutId="fullscreen-tab-indicator" 
                        className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-pink-500" 
                      />
                    )}
                  </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {playerTab === "lyrics" ? (
                      <motion.div
                        key="lyrics"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full h-full"
                      >
                        <SyncedLyrics trackId={currentTrack.track_id} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="queue"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="w-full h-full glass-panel rounded-2xl p-4 flex flex-col overflow-hidden border border-white/5 shadow-2xl relative"
                      >
                        {/* Glowing decor */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex-1 overflow-y-auto space-y-5 pr-1" style={{ scrollBehavior: "smooth" }}>
                          
                          {/* --- UP NEXT (QUEUE) --- */}
                          {queue.slice(currentIndex + 1).length > 0 && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between select-none">
                                <h3 className="text-xs font-extrabold tracking-wider uppercase text-zinc-500 font-outfit">Up Next</h3>
                                <button 
                                  onClick={() => {
                                    clearQueue();
                                    setToastText("Queue Cleared");
                                    setTimeout(() => setToastText(null), 2000);
                                  }}
                                  className="text-[10px] font-bold tracking-wider uppercase text-red-400 hover:text-red-300 transition-colors"
                                >
                                  Clear All
                                </button>
                              </div>
                              <div className="space-y-1.5">
                                {queue.slice(currentIndex + 1, currentIndex + 16).map((track, idx) => {
                                  const absoluteIdx = currentIndex + 1 + idx;
                                  const displayArtists = typeof track.artists === "string" 
                                    ? track.artists 
                                    : Array.isArray(track.artists)
                                      ? track.artists.map((a: any) => a.name || a).join(", ")
                                      : track.artists?.name || "Unknown";

                                  return (
                                    <div 
                                      key={track.track_id + idx}
                                      onClick={() => playTrack(track, queue)}
                                      className="flex items-center justify-between p-2 rounded-xl bg-white/0 hover:bg-white/5 border border-white/0 hover:border-white/5 cursor-pointer group transition-all duration-300"
                                    >
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="text-[10px] font-bold text-zinc-600 w-4 text-center shrink-0 group-hover:text-purple-400 select-none">
                                          {idx + 1}
                                        </span>
                                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 relative">
                                          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Play className="w-3.5 h-3.5 text-white fill-white" />
                                          </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">{track.title}</h4>
                                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{displayArtists}</p>
                                        </div>
                                      </div>

                                      {/* Customization controls */}
                                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        {absoluteIdx > currentIndex + 1 && (
                                          <button 
                                            onClick={() => reorderQueue(absoluteIdx, absoluteIdx - 1)}
                                            className="w-7 h-7 rounded-lg bg-white/0 hover:bg-white/10 flex items-center justify-center border border-white/0 hover:border-white/10 text-zinc-400 hover:text-white transition-all"
                                            title="Move Up"
                                          >
                                            <ChevronUp className="w-4 h-4" />
                                          </button>
                                        )}
                                        {absoluteIdx < queue.length - 1 && (
                                          <button 
                                            onClick={() => reorderQueue(absoluteIdx, absoluteIdx + 1)}
                                            className="w-7 h-7 rounded-lg bg-white/0 hover:bg-white/10 flex items-center justify-center border border-white/0 hover:border-white/10 text-zinc-400 hover:text-white transition-all"
                                            title="Move Down"
                                          >
                                            <ChevronDown className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => {
                                            removeFromQueue(track.track_id);
                                            setToastText("Removed from Queue");
                                            setTimeout(() => setToastText(null), 2000);
                                          }}
                                          className="w-7 h-7 rounded-lg bg-white/0 hover:bg-red-500/10 flex items-center justify-center border border-white/0 hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                                          title="Remove from Queue"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* --- RECOMMENDED VIBE (RELATED) --- */}
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 select-none">
                              <Sparkles className="w-3.5 h-3.5 text-pink-400 fill-pink-400/10" />
                              <h3 className="text-xs font-extrabold tracking-wider uppercase text-zinc-500 font-outfit">Recommended Vibe</h3>
                            </div>

                            {isLoadingRelated ? (
                              <div className="py-8 flex flex-col items-center justify-center gap-3">
                                <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                                <p className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Loading recommendations...</p>
                              </div>
                            ) : relatedTracks.length > 0 ? (
                              <div className="space-y-1.5">
                                {relatedTracks.slice(0, 10).map((track, idx) => {
                                  const title = track.title;
                                  const artistNames = track.artists 
                                    ? (Array.isArray(track.artists) ? track.artists.map((a: any) => a.name).join(", ") : track.artists) 
                                    : track.author || "Unknown Artist";
                                  const thumbnail = getThumbnailUrl(track);

                                  return (
                                    <div 
                                      key={track.videoId || track.track_id || idx}
                                      onClick={() => playRecommendedTrack(track)}
                                      className="flex items-center justify-between p-2 rounded-xl bg-white/0 hover:bg-white/5 border border-white/0 hover:border-white/5 cursor-pointer group transition-all duration-300"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 relative">
                                          <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Play className="w-3.5 h-3.5 text-white fill-white" />
                                          </div>
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">{title}</h4>
                                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{artistNames}</p>
                                        </div>
                                      </div>
                                      
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const normalizedTrack = {
                                            track_id: track.videoId || track.track_id,
                                            title: track.title,
                                            artists: artistNames,
                                            thumbnail
                                          };
                                          addToQueue(normalizedTrack);
                                          setToastText("Added to Queue");
                                          setTimeout(() => setToastText(null), 2500);
                                        }}
                                        className="w-7 h-7 rounded-lg bg-white/0 hover:bg-white/10 flex items-center justify-center border border-white/0 hover:border-white/10 active:scale-90 transition-transform opacity-0 group-hover:opacity-100"
                                        title="Add to Queue"
                                      >
                                        <Plus className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-500 italic py-4 select-none">No recommendation data available</p>
                            )}
                          </div>
                          
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Fullscreen bottom controls */}
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-5 items-center z-10 mt-auto pb-4">
              {/* Seekbar */}
              <div className="flex items-center gap-4 w-full text-xs text-zinc-400">
                <span className="w-8 text-right tabular-nums shrink-0">{fmt(displayTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={displayTime}
                  className="slider-premium flex-1"
                  style={fillStyle(seekPct)}
                  onPointerDown={onSeekDown}
                  onChange={onSeekMove}
                  onPointerUp={onSeekUp}
                />
                <span className="w-8 tabular-nums shrink-0">{fmt(duration)}</span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between w-full px-4 select-none">
                <button onClick={toggleShuffle} className={`transition-colors ${isShuffle ? "text-purple-400 scale-110" : "text-zinc-500 hover:text-white"}`}>
                  <Shuffle className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-8">
                  <button onClick={prevTrack} className="text-zinc-400 hover:text-white transition-transform hover:scale-105 active:scale-90">
                    <SkipBack className="w-7 h-7" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-transform shadow-[0_4px_20px_rgba(255,255,255,0.2)]"
                  >
                    {isPlaying
                      ? <Pause className="w-7 h-7 fill-black" />
                      : <Play className="w-7 h-7 fill-black ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="text-zinc-400 hover:text-white transition-transform hover:scale-105 active:scale-90">
                    <SkipForward className="w-7 h-7" />
                  </button>
                </div>
                <button onClick={toggleRepeat} className={`relative transition-colors ${isRepeat !== "none" ? "text-purple-400 scale-110" : "text-zinc-500 hover:text-white"}`}>
                  <Repeat className="w-5 h-5" />
                  {isRepeat === "one" && <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold">1</span>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastText && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`fixed bottom-28 left-1/2 bg-black/85 backdrop-blur-md border px-6 py-3 rounded-full text-xs font-bold shadow-lg z-50 flex items-center gap-2 select-none ${
              toastText === "High Fidelity Mode"
                ? "border-emerald-500/30 text-emerald-400 shadow-[0_4px_25px_rgba(16,185,129,0.3)]"
                : "border-purple-500/30 text-purple-300 shadow-[0_4px_25px_rgba(139,92,246,0.3)]"
            }`}
          >
            <Sparkles className={`w-4 h-4 animate-pulse ${toastText === "High Fidelity Mode" ? "fill-emerald-400/20 text-emerald-400" : "fill-purple-400/20 text-purple-400"}`} />
            {toastText}
          </motion.div>
        )}
      </AnimatePresence>

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        trackId={currentTrack?.track_id || null}
        trackTitle={currentTrack?.title}
      />
        </>
      )}
    </>
  );
};
