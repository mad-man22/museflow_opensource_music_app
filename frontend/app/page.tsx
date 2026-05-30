"use client";

import React, { useEffect, useState } from "react";
import { Play, Sparkles, Flame, RefreshCw, Plus, Disc, Music, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaybackStore, Track } from "../store/usePlaybackStore";
import { API_URL } from "../lib/api";

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

export default function HomePage() {
  const [trending, setTrending] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTracks, setAiTracks] = useState<any[]>([]);
  const [aiVibeName, setAiVibeName] = useState("");

  const { playTrack, setQueue, currentTrack } = usePlaybackStore();
  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recSourceTrackName, setRecSourceTrackName] = useState("");
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  // Load recently played tracks dynamically on song transitions
  useEffect(() => {
    const stored = localStorage.getItem("museflow_history");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const normalized = (parsed || []).map((t: any) => ({
          ...t,
          artists: t.artists && typeof t.artists !== "string"
            ? Array.isArray(t.artists)
              ? t.artists.map((a: any) => (typeof a === "string" ? a : a?.name || a?.author || "")).join(", ")
              : t.artists?.name || t.artists?.author || ""
            : t.artists || "",
        }));
        setRecentlyPlayed(normalized.slice(0, 4));
      } catch (e) {
        console.error("Failed to parse recently played storage:", e);
      }
    }
  }, [currentTrack]);


  // Load trending songs on mount with beautiful premium fallbacks if offline
  useEffect(() => {
    const fetchTrending = async () => {
      const mockTrendingFallback = [
        {
          videoId: "4NRXx6U8ABQ",
          title: "Blinding Lights",
          author: "The Weeknd",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300" }]
        },
        {
          videoId: "kJQP7kiw5Fk",
          title: "Despacito",
          author: "Luis Fonsi",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300" }]
        },
        {
          videoId: "9bZkp7q19f0",
          title: "Gangnam Style",
          author: "PSY",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300" }]
        },
        {
          videoId: "y6120QOlsfU",
          title: "Sandstorm",
          author: "Darude",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300" }]
        },
        {
          videoId: "Jg5wkZ-dJXA",
          title: "Starlight",
          author: "Muse",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300" }]
        },
        {
          videoId: "dXF-a21k00Y",
          title: "Midnight City",
          author: "M83",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300" }]
        }
      ];

      try {
        const res = await fetch(`${API_URL}/api/v1/tracks/trending`, {
          signal: AbortSignal.timeout(10000) // Timeout after 10 seconds to allow cold-start fetches
        });
        if (res.ok) {
          const data = await res.json();
          // If the backend returns empty or invalid charts, use the fallback
          if (Array.isArray(data) && data.length > 0) {
            setTrending(data);
          } else {
            setTrending(mockTrendingFallback);
          }
        } else {
          setTrending(mockTrendingFallback);
        }
      } catch (err) {
        console.warn("[Frontend] Backend offline or slow. Using premium local trending fallbacks.", err);
        setTrending(mockTrendingFallback);
      }
    };
    fetchTrending();
  }, []);

  // Fetch recommendations based on recently played or trending fallback
  useEffect(() => {
    const fetchRecommendations = async () => {
      let seedTrack: any = null;

      if (recentlyPlayed.length > 0) {
        seedTrack = recentlyPlayed[0];
      } else if (trending.length > 0) {
        seedTrack = trending[0];
      }

      if (!seedTrack) return;

      const seedId = seedTrack.videoId || seedTrack.track_id;
      if (!seedId) return;

      setIsLoadingRecommendations(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/tracks/related/${seedId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setRecommendations(data);
            setRecSourceTrackName(seedTrack.title);
            setIsLoadingRecommendations(false);
            return;
          }
        }
      } catch (err) {
        console.warn("[Frontend] Failed to fetch recommendations from backend.", err);
      }

      // Local premium mock fallback if offline/backend fails
      const mockRecommendations = [
        {
          videoId: "kJQP7kiw5Fk",
          title: "Fix You",
          author: "Coldplay",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300" }]
        },
        {
          videoId: "y6120QOlsfU",
          title: "Sandstorm",
          author: "Darude",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300" }]
        },
        {
          videoId: "dXF-a21k00Y",
          title: "Midnight City",
          author: "M83",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300" }]
        },
        {
          videoId: "4NRXx6U8ABQ",
          title: "Blinding Lights",
          author: "The Weeknd",
          thumbnails: [{ url: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300" }]
        }
      ];
      setRecommendations(mockRecommendations);
      setRecSourceTrackName(seedTrack.title);
      setIsLoadingRecommendations(false);
    };

    fetchRecommendations();
  }, [recentlyPlayed, trending]);


  const handleGenerateVibe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setAiTracks([]);
    setAiVibeName("");

    // Setup highly immersive offline local fallbacks based on search tags
    const compileLocalFallback = (keyword: string) => {
      const kw = keyword.toLowerCase();
      
      const energeticList = [
        { track_id: "y6120QOlsfU", title: "Sandstorm", artists: "Darude", thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300" },
        { track_id: "H5v3kku4y6Q", title: "Lose Yourself", artists: "Eminem", thumbnail: "https://images.unsplash.com/photo-1514525253161-c97d3d27a1d4?q=80&w=300" },
        { track_id: "gCYcHz2k5Lo", title: "Stronger", artists: "Kanye West", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300" },
        { track_id: "fJ9rUzIMcZQ", title: "Eye of the Tiger", artists: "Survivor", thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300" }
      ];

      const sadList = [
        { track_id: "kJQP7kiw5Fk", title: "Fix You", artists: "Coldplay", thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300" },
        { track_id: "hLQl3WQQo0A", title: "Someone Like You", artists: "Adele", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300" },
        { track_id: "450p7TMc50M", title: "Skinny Love", artists: "Bon Iver", thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300" }
      ];

      const chillList = [
        { track_id: "dQw4w9WgXcQ", title: "Blinding Lights", artists: "The Weeknd", thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300" },
        { track_id: "8UVNT4cl5yY", title: "Resonance", artists: "HOME", thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300" },
        { track_id: "L_XJ_s5074", title: "Midnight City", artists: "M83", thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300" },
        { track_id: "3Ayg3DQQp0U", title: "Intro", artists: "The XX", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300" }
      ];

      if (kw.includes("gym") || kw.includes("energetic") || kw.includes("workout") || kw.includes("run") || kw.includes("pump")) {
        return energeticList;
      }
      if (kw.includes("sad") || kw.includes("rain") || kw.includes("cry") || kw.includes("cozy") || kw.includes("night")) {
        return sadList;
      }
      return chillList;
    };

    try {
      const res = await fetch(`${API_URL}/api/v1/tracks/ai/generate?prompt=${encodeURIComponent(prompt)}`, {
        method: "POST",
        signal: AbortSignal.timeout(5000) // Timeout after 5s
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setAiTracks(data.tracks);
        } else {
          setAiTracks(compileLocalFallback(prompt));
        }
      } else {
        setAiTracks(compileLocalFallback(prompt));
      }
      setAiVibeName(prompt);
    } catch (err) {
      console.warn("[Frontend] Backend offline or slow. Compiling offline local vibe tracklist.", err);
      setAiTracks(compileLocalFallback(prompt));
      setAiVibeName(prompt);
    } finally {
      setIsGenerating(false);
    }
  };

  const playAllTrending = () => {
    if (trending.length === 0) return;
    
    // Map trending to store Track objects
    const tracksToPlay: Track[] = trending.map((item: any) => ({
      track_id: item.videoId || item.track_id,
      title: item.title,
      artists: item.artists ? item.artists.map((a: any) => a.name).join(", ") : item.author || "Unknown",
      thumbnail: item.thumbnails ? item.thumbnails[0].url : item.thumbnail
    }));

    setQueue(tracksToPlay, 0);
  };

  const playAllAIVibe = () => {
    if (aiTracks.length === 0) return;
    
    const tracksToPlay: Track[] = aiTracks.map((item: any) => ({
      track_id: item.track_id,
      title: item.title,
      artists: Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(", ") : item.artists,
      thumbnail: item.thumbnail
    }));

    setQueue(tracksToPlay, 0);
  };

  const presetVibes = [
    { label: "💻 Late Night Coding", prompt: "ambient lofi beats for late night coding focus" },
    { label: "⚡ Gym Pump", prompt: "high energy synthwave and hyperpop for intense gym workout" },
    { label: "🌧️ Rainy Day Chill", prompt: "melancholy acoustic indie songs for a cozy rainy day chill" },
    { label: "🌌 Cyber Highway", prompt: "retro synthwave driving tunes with deep bass" },
    { label: "☕ Cozy Cafe", prompt: "warm acoustic guitar and soft cafe jazz bgm" }
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-10 max-w-7xl mx-auto pb-36 md:pb-28">
      
      {/* Immersive Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
      >
        <div>
          <h1 className="text-4xl font-extrabold text-gradient tracking-tight">Discover the Vibe</h1>
          <p className="text-zinc-400 mt-2">Welcome to MuseFlow. High-fidelity music streaming powered by Gemini AI.</p>
        </div>
      </motion.div>

      {/* --- RECENTLY PLAYED SECTION --- */}
      {recentlyPlayed.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5 fill-purple-400/20" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-outfit">Recently Played</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {recentlyPlayed.map((track, idx) => (
              <motion.div
                key={track.track_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => playTrack(track, recentlyPlayed)}
                className="glass-card rounded-2xl p-3 flex items-center gap-3.5 cursor-pointer group hover:bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all duration-300"
              >
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800 shadow-md">
                  <img 
                    src={getThumbnailUrl(track)} 
                    alt={track.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                    <Play className="w-4 h-4 fill-white text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold truncate text-white group-hover:text-purple-300 transition-colors duration-300">{track.title}</h4>
                  <p className="text-xs text-zinc-400 truncate mt-1 group-hover:text-zinc-300 transition-colors duration-300">{track.artists}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}
      {/* --- RECOMMENDED SECTION --- */}
      {recommendations.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">
                <Sparkles className="w-5 h-5 fill-pink-400/20" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white font-outfit">Recommended for You</h2>
                {recSourceTrackName && (
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                    Inspired by <span className="text-purple-400">"{recSourceTrackName}"</span>
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={() => {
                const tracksToPlay: Track[] = recommendations.map((item: any) => ({
                  track_id: item.videoId || item.track_id,
                  title: item.title,
                  artists: item.artists ? (Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(", ") : item.artists) : item.author || "Unknown",
                  thumbnail: getThumbnailUrl(item)
                }));
                setQueue(tracksToPlay, 0);
              }}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              Play Vibe Mix
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 select-none">
            {recommendations.slice(0, 6).map((item, idx) => {
              const trackId = item.videoId || item.track_id;
              const title = item.title;
              const artistNames = item.artists 
                ? (Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(", ") : item.artists) 
                : item.author || "Unknown Artist";
              const thumbnail = getThumbnailUrl(item);

              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.03 }}
                  onClick={() => playTrack({
                    track_id: trackId,
                    title,
                    artists: artistNames,
                    thumbnail
                  }, recommendations.map((t: any) => ({
                    track_id: t.videoId || t.track_id,
                    title: t.title,
                    artists: t.artists ? (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(", ") : t.artists) : t.author || "Unknown Artist",
                    thumbnail: getThumbnailUrl(t)
                  })))}
                  className="glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden shadow-lg bg-zinc-900/40">
                    <img 
                      src={thumbnail} 
                      alt={title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-[0_4px_15px_rgba(168,85,247,0.4)]">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 px-0.5">
                    <h4 className="text-sm font-semibold truncate text-white group-hover:text-purple-300 transition-colors duration-300">{title}</h4>
                    <p className="text-xs text-zinc-400 truncate mt-1 group-hover:text-zinc-300 transition-colors duration-300">{artistNames}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}



      {/* --- AI VIBE PLAYLIST GENERATOR (SPOTLIGHT) --- */}
      <motion.section 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl border border-purple-500/10"
      >
        {/* Glowing Ambient Backdrops */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 animate-pulse" style={{ animationDuration: "12s" }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-600/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />
        
        <div className="flex items-center gap-3 mb-6 select-none relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/25 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
            <Sparkles className="w-5 h-5 fill-purple-400/20" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide font-outfit">Gemini AI Playlists</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Let AI compile the perfect soundtrack for your mood</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <form onSubmit={handleGenerateVibe} className="flex flex-col md:flex-row gap-4 max-w-3xl">
            <div className="flex-1 relative group">
              <input 
                type="text"
                placeholder="Type a vibe, e.g., 'ambient lofi beats for late night coding', 'hyperpop gym music'..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-5 pr-5 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/80 focus:ring-4 focus:ring-purple-500/10 transition-all duration-300 shadow-xl"
              />
              <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-focus-within:opacity-10 blur-[2px] transition-opacity duration-300" />
            </div>
            
            <button 
              type="submit"
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 active:from-purple-700 active:to-pink-600 px-8 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(168,85,247,0.25)] hover:shadow-[0_4px_30px_rgba(168,85,247,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 text-white"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white text-white" />
                  <span>Generate Vibe</span>
                </>
              )}
            </button>
          </form>

          {/* Vibe Preset Chips */}
          <div className="space-y-2.5 select-none">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Try these vibes</p>
            <div className="flex flex-wrap gap-2.5">
              {presetVibes.map((vibe) => (
                <button
                  key={vibe.label}
                  type="button"
                  onClick={() => setPrompt(vibe.prompt)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/5 text-zinc-300 hover:text-white hover:bg-white/10 hover:border-purple-500/40 transition-all duration-300 shadow-sm active:scale-95"
                >
                  {vibe.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Generated Tracklist */}
        <AnimatePresence>
          {aiTracks.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <h3 className="text-base font-bold text-gradient">Vibe: "{aiVibeName}"</h3>
                </div>
                <button 
                  onClick={playAllAIVibe}
                  className="bg-white text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform shadow-[0_4px_15px_rgba(255,255,255,0.15)]"
                >
                  <Play className="w-3 h-3 fill-black text-black" /> Play Vibe
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {aiTracks.map((track, idx) => {
                  const title = track.title;
                  const artists = Array.isArray(track.artists) ? track.artists.map((a: any) => a.name).join(", ") : track.artists;
                  const thumbnail = track.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150";

                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => playTrack({
                        track_id: track.track_id,
                        title,
                        artists,
                        thumbnail
                      }, aiTracks.map(t => ({
                        track_id: t.track_id,
                        title: t.title,
                        artists: Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(", ") : t.artists,
                        thumbnail: t.thumbnail
                      })))}
                      className="flex items-center justify-between p-3 rounded-2xl glass-card cursor-pointer group/row select-none"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <span className="text-xs font-bold text-zinc-500 w-5 text-center group-hover/row:text-purple-400 transition-colors">{idx + 1}</span>
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
                          <img 
                            src={thumbnail} 
                            alt={title} 
                            className="w-full h-full object-cover group-hover/row:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/row:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-3.5 h-3.5 fill-white text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold truncate text-white group-hover/row:text-purple-300 transition-colors">{title}</h4>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{artists}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* --- TRENDING CHARTS GRID --- */}
      <motion.section 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
              <Flame className="w-5 h-5 fill-orange-400/20" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-outfit">Global Trending</h2>
          </div>
          <button 
            onClick={playAllTrending}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
          >
            Play All
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 select-none">
          {trending.slice(0, 12).map((item, idx) => {
            const trackId = item.videoId || item.track_id;
            const title = item.title;
            const artistNames = item.artists ? item.artists.map((a: any) => a.name).join(", ") : item.author || "Unknown Artist";
            const thumbnail = item.thumbnails ? item.thumbnails[0].url : item.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150";

            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.03 }}
                onClick={() => playTrack({
                  track_id: trackId,
                  title,
                  artists: artistNames,
                  thumbnail
                }, trending.map((t: any) => ({
                  track_id: t.videoId || t.track_id,
                  title: t.title,
                  artists: t.artists ? t.artists.map((a: any) => a.name).join(", ") : t.author || "Unknown Artist",
                  thumbnail: t.thumbnails ? t.thumbnails[0].url : t.thumbnail
                })))}
                className="glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden shadow-lg bg-zinc-900/40">
                  <img 
                    src={thumbnail} 
                    alt={title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-[0_4px_15px_rgba(168,85,247,0.4)]">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0 px-0.5">
                  <h4 className="text-sm font-semibold truncate text-white group-hover:text-purple-300 transition-colors duration-300">{title}</h4>
                  <p className="text-xs text-zinc-400 truncate mt-1 group-hover:text-zinc-300 transition-colors duration-300">{artistNames}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

    </div>
  );
}
