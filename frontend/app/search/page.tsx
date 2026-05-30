"use client";

import React, { useState, useEffect } from "react";
import { Search as SearchIcon, Music, Play, Loader2, Disc, ArrowRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaybackStore, Track } from "../../store/usePlaybackStore";
import { API_URL } from "../../lib/api";

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

// Rich local database of classic tracks for instant offline lookup/fallbacks
const OFFLINE_DATABASE = [
  {
    videoId: "dQw4w9WgXcQ",
    title: "Blinding Lights",
    artists: "The Weeknd",
    album: "After Hours",
    thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "kJQP7kiw5Fk",
    title: "Fix You",
    artists: "Coldplay",
    album: "X&Y",
    thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "y6120QOlsfU",
    title: "Sandstorm",
    artists: "Darude",
    album: "Before the Storm",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "8UVNT4cl5yY",
    title: "Resonance",
    artists: "HOME",
    album: "Odyssey",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "L_XJ_s5074",
    title: "Midnight City",
    artists: "M83",
    album: "Hurry Up, We're Dreaming",
    thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "9bZkp7q19f0",
    title: "Gangnam Style",
    artists: "PSY",
    album: "Psy 6甲",
    thumbnail: "https://images.unsplash.com/photo-1514525253161-c97d3d27a1d4?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "y6120QOlsfU",
    title: "Intro",
    artists: "The XX",
    album: "xx",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "H5v3kku4y6Q",
    title: "Lose Yourself",
    artists: "Eminem",
    album: "8 Mile",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "gCYcHz2k5Lo",
    title: "Stronger",
    artists: "Kanye West",
    album: "Graduation",
    thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300",
    category: "songs"
  },
  {
    videoId: "fJ9rUzIMcZQ",
    title: "Eye of the Tiger",
    artists: "Survivor",
    album: "Eye of the Tiger",
    thumbnail: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=300",
    category: "songs"
  }
];

const PRE_SEARCH_VIBES = [
  { name: "Late Night Coding", gradient: "from-indigo-600 to-purple-600", query: "lofi coding focus" },
  { name: "High-Energy Workout", gradient: "from-pink-600 to-rose-600", query: "gym motivation hype" },
  { name: "Rainy Day Chill", gradient: "from-cyan-600 to-blue-600", query: "acoustic chill indie" },
  { name: "Synthwave Highway", gradient: "from-violet-600 to-fuchsia-600", query: "synthwave retro" },
  { name: "Espresso Jazz Lounge", gradient: "from-amber-700 to-amber-900", query: "coffee jazz bgm" },
  { name: "Deep Focus Ambient", gradient: "from-emerald-600 to-teal-600", query: "binaural ambient drone" }
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "songs" | "albums" | "artists">("all");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const { playTrack, setQueue } = usePlaybackStore();

  // Handle live search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setErrorInfo(null);
      return;
    }

    const timer = setTimeout(() => {
      triggerSearch(query, activeFilter);
    }, 450);

    return () => clearTimeout(timer);
  }, [query, activeFilter]);

  const triggerSearch = async (searchQuery: string, filter: string) => {
    setIsLoading(true);
    setErrorInfo(null);

    // Map frontend filter naming to FastAPI filters
    const filterMapping = {
      all: undefined,
      songs: "songs",
      albums: "albums",
      artists: "artists"
    };

    const targetType = filterMapping[filter as keyof typeof filterMapping];
    const url = `${API_URL}/api/v1/tracks/search?query=${encodeURIComponent(searchQuery)}${targetType ? `&type=${targetType}` : ""}`;

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Normalize ytmusicapi data
          const normalized = data.map((item: any) => {
            const artistsStr = item.artists 
              ? (Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(", ") : item.artists) 
              : item.author || "Unknown Artist";

            const thumbnail = getThumbnailUrl(item);

            return {
              track_id: item.videoId || item.browseId,
              title: item.title || item.name,
              artists: artistsStr,
              album: item.album ? (typeof item.album === "string" ? item.album : item.album.name) : "Single",
              thumbnail: thumbnail,
              category: item.resultType || (targetType ? targetType : "songs")
            };
          });
          setResults(normalized);
        } else {
          // Fall back to offline search filter
          triggerLocalSearch(searchQuery, filter);
        }
      } else {
        triggerLocalSearch(searchQuery, filter);
      }
    } catch (err) {
      console.warn("[Search] Backend server offline or timed out. Swapping to native high-fidelity database.", err);
      triggerLocalSearch(searchQuery, filter);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerLocalSearch = (searchQuery: string, filter: string) => {
    setErrorInfo("Backend offline. Searching local sandbox catalog.");
    const regex = new RegExp(searchQuery, "i");
    const matched = OFFLINE_DATABASE.filter(item => {
      const matchesText = regex.test(item.title) || regex.test(item.artists) || regex.test(item.album || "");
      if (!matchesText) return false;
      if (filter === "all") return true;
      return item.category === filter;
    });
    setResults(matched);
  };

  const selectPresearchVibe = (vibeQuery: string) => {
    setQuery(vibeQuery);
  };

  const playSong = async (track: any) => {
    // Map track keys to fit the Zustand Track contract
    const resolvedTrack: Track = {
      track_id: track.track_id || track.videoId,
      title: track.title,
      artists: track.artists,
      album: track.album,
      thumbnail: getThumbnailUrl(track)
    };

    // Start playing the song immediately in a single-song queue
    playTrack(resolvedTrack, [resolvedTrack]);

    // Fetch related recommendations in the background
    try {
      const res = await fetch(`${API_URL}/api/v1/tracks/related/${resolvedTrack.track_id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mappedRecs = data.map(item => ({
            track_id: item.videoId || item.track_id,
            title: item.title,
            artists: item.artists ? (Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).join(", ") : item.artists) : item.author || "Unknown Artist",
            thumbnail: getThumbnailUrl(item)
          }));
          
          // Imperatively update Zustand queue using usePlaybackStore.setState
          // This appends recommendations so "Next" plays from the recommendation section!
          usePlaybackStore.setState({
            queue: [resolvedTrack, ...mappedRecs],
            currentIndex: 0
          });
        }
      }
    } catch (err) {
      console.warn("[Search Autoplay] Failed to load recommendations:", err);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-10 max-w-7xl mx-auto pb-36 md:pb-28">
      
      {/* Search Header Banner */}
      <div className="select-none">
        <h1 className="text-4xl font-extrabold text-gradient tracking-tight">Search</h1>
        <p className="text-zinc-400 mt-2">Explore millions of high-fidelity tracks, artists, and curated vibes.</p>
      </div>

      {/* Floating Glowing Search Bar & Filters */}
      <div className="space-y-6">
        <div className="relative group max-w-3xl">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-purple-400 transition-colors">
            <SearchIcon className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Search songs, albums, artists, or natural language prompts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-5 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/35 transition-all shadow-xl"
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-5 flex items-center">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 select-none">
          {(["all", "songs", "albums", "artists"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-6 py-2.5 rounded-full text-xs font-bold capitalize transition-all border ${
                activeFilter === filter
                  ? "bg-white text-black border-white shadow-[0_4px_15px_rgba(255,255,255,0.15)]"
                  : "bg-white/5 text-zinc-400 border-white/5 hover:text-white hover:bg-white/10"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {results.length > 0 ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h2 className="text-xl font-bold text-gradient">Search Results</h2>
              {errorInfo && (
                <span className="text-xs bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full border border-purple-500/15 flex items-center gap-1.5 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 fill-purple-400/20" />
                  {errorInfo}
                </span>
              )}
            </div>

            {activeFilter === "all" ? (
              /* Split Layout: Top Result (2/5) & Songs (3/5) */
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left Side: Top Result Card */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <h3 className="text-base font-bold text-zinc-400 select-none">Top Result</h3>
                  <motion.div
                    onClick={() => playSong(results[0])}
                    whileHover={{ scale: 1.005 }}
                    className="glass-panel p-6 rounded-3xl border border-white/5 cursor-pointer group flex flex-col justify-between h-[320px] relative overflow-hidden shadow-2xl"
                  >
                    {/* Ambient colored backdrop reflecting thumbnail */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-12 -mt-12 group-hover:bg-purple-500/15 transition-colors" />
                    
                    <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-lg bg-zinc-850 flex-shrink-0">
                      <img
                        src={results[0].thumbnail}
                        alt={results[0].title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                        <Play className="w-8 h-8 fill-white text-white" />
                      </div>
                    </div>
                    
                    <div className="space-y-2 select-none relative z-10 mt-auto">
                      <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider">
                        {results[0].category || "Song"}
                      </span>
                      <h2 className="text-2xl font-extrabold truncate text-white group-hover:text-purple-300 transition-colors mt-2.5">
                        {results[0].title}
                      </h2>
                      <p className="text-sm text-zinc-400 truncate mt-1">
                        {results[0].artists}
                      </p>
                    </div>
                    
                    {/* Bottom circular hover action */}
                    <div className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-[0_8px_25px_rgba(168,85,247,0.4)]">
                      <Play className="w-6 h-6 fill-white ml-1 text-white" />
                    </div>
                  </motion.div>
                </div>

                {/* Right Side: Songs row list */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  <h3 className="text-base font-bold text-zinc-400 select-none">Songs</h3>
                  <div className="space-y-2">
                    {results.slice(0, 4).map((item, idx) => (
                      <motion.div
                        key={item.track_id + idx}
                        onClick={() => playSong(item)}
                        whileHover={{ x: 4 }}
                        className="flex items-center justify-between p-3 rounded-2xl glass-card cursor-pointer group/row select-none animate-fadeIn"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-850">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover/row:scale-105 transition-transform duration-555"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/row:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-3.5 h-3.5 fill-white text-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold truncate text-white group-hover/row:text-purple-300 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">{item.artists}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {item.album && item.album !== "Single" && (
                            <span className="text-xs text-zinc-550 truncate max-w-[140px] hidden md:block">
                              {item.album}
                            </span>
                          )}
                          <span className="text-[10px] bg-white/5 text-zinc-450 px-2 py-0.5 rounded uppercase font-semibold">
                            {item.category || "Song"}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Uniform tabular list for filtered views (songs, albums, artists) */
              <div className="space-y-2 max-w-4xl">
                {results.map((item, idx) => (
                  <motion.div
                    key={item.track_id + idx}
                    onClick={() => playSong(item)}
                    whileHover={{ x: 4 }}
                    className="flex items-center justify-between p-3 rounded-2xl glass-card cursor-pointer group/row select-none animate-fadeIn"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="text-xs text-zinc-500 font-bold w-5 text-center group-hover/row:text-purple-400 transition-colors">
                        {idx + 1}
                      </span>
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-850">
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover/row:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/row:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-white text-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold truncate text-white group-hover/row:text-purple-300 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{item.artists}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {item.album && item.album !== "Single" && (
                        <span className="text-xs text-zinc-500 truncate max-w-[180px] hidden md:block">
                          {item.album}
                        </span>
                      )}
                      <span className="text-[10px] bg-white/5 text-zinc-450 px-2 py-0.5 rounded uppercase font-semibold">
                        {item.category || "Song"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="pre-search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8 select-none"
          >
            {/* Curated Vibe cards */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-zinc-300">Browse Curated Vibes</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
                {PRE_SEARCH_VIBES.map((vibe, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectPresearchVibe(vibe.query)}
                    className={`relative overflow-hidden aspect-[4/3] rounded-2xl bg-gradient-to-br ${vibe.gradient} p-5 cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all group`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />
                    <h3 className="font-bold text-sm leading-tight text-white">{vibe.name}</h3>
                    <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Offline library catalog highlights */}
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-bold text-zinc-300">Popular Recommendations</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                {OFFLINE_DATABASE.slice(0, 5).map((track, idx) => (
                  <div
                    key={track.videoId + idx}
                    onClick={() => playSong(track)}
                    className="glass-card rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden shadow-md">
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <Play className="w-8 h-8 fill-white text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate text-white group-hover:text-purple-400 transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate mt-1">{track.artists}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
