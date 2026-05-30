"use client";

import React, { useState, useEffect } from "react";
import { 
  Heart, History, ListMusic, Play, Plus, Disc, Loader2, 
  Sparkles, Music, Trash2, ArrowLeft, Calendar, Clock, ChevronRight 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaybackStore, Track } from "../../store/usePlaybackStore";

// Type definitions
interface LibraryTrack {
  track_id: string;
  title: string;
  artists: string;
  thumbnail: string;
  album?: string;
  likedAt?: string;
  playedAt?: string;
}

interface LocalPlaylist {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  tracks: LibraryTrack[];
  createdAt: string;
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<"liked" | "playlists" | "history">("liked");
  const [likedSongs, setLikedSongs] = useState<LibraryTrack[]>([]);
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([]);
  const [history, setHistory] = useState<LibraryTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  
  // Track selected playlist for drill-down view
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const { playTrack, setQueue, currentTrack } = usePlaybackStore();

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

  const normalizeAlbum = (album: any): string => {
    if (!album) return "";
    if (typeof album === "string") return album;
    return album?.name || "";
  };

  // Load from local storage and backend on mount, and listen for updates
  useEffect(() => {
    loadLibraryData();

    const handleLibraryUpdate = () => {
      console.log("[Library] Reactive update triggered via event");
      loadLibraryData();
    };

    window.addEventListener("library-updated", handleLibraryUpdate);
    return () => {
      window.removeEventListener("library-updated", handleLibraryUpdate);
    };
  }, []);

  const loadLibraryData = async () => {
    setIsLoading(true);
    
    // 1. Load LocalStorage fallbacks
    const localLiked = localStorage.getItem("museflow_liked_songs");
    const localHistory = localStorage.getItem("museflow_history");
    const localPlaylists = localStorage.getItem("museflow_playlists");

    const parsedLiked = localLiked ? JSON.parse(localLiked) : [];
    const parsedHistory = localHistory ? JSON.parse(localHistory) : [];
    const parsedPlaylists = localPlaylists ? JSON.parse(localPlaylists) : [];

    // Normalize any stored artist objects to strings to avoid React render errors
    const normLiked = parsedLiked.map((t: any) => ({ ...t, artists: normalizeArtists(t.artists), album: normalizeAlbum(t.album) }));
    const normHistory = parsedHistory.map((t: any) => ({ ...t, artists: normalizeArtists(t.artists), album: normalizeAlbum(t.album) }));
    const normPlaylists = parsedPlaylists.map((p: any) => ({
      ...p,
      tracks: Array.isArray(p.tracks)
        ? p.tracks.map((t: any) => ({ ...t, artists: normalizeArtists(t.artists), album: normalizeAlbum(t.album) }))
        : [],
    }));

    setLikedSongs(normLiked);
    setHistory(normHistory);
    setPlaylists(normPlaylists);

    // 2. Enrich from FastAPI Backend if token is active
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
        
        // Fetch favorites
        const favsRes = await fetch(`http://${host}:8000/api/v1/tracks/favorites`, {
          headers: { "Authorization": `Bearer ${token}` },
          signal: AbortSignal.timeout(3000)
        });
            if (favsRes.ok) {
          const favsData = await favsRes.json();
          if (Array.isArray(favsData)) {
              const formatted = favsData.map((item: any) => ({
              track_id: item.track_id,
              title: item.title,
                  artists: normalizeArtists(item.artists),
                  album: normalizeAlbum(item.album) || "Single",
              thumbnail: item.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300",
              likedAt: item.liked_at
            }));
            setLikedSongs(formatted);
            localStorage.setItem("museflow_liked_songs", JSON.stringify(formatted));
          }
        }

        // Fetch history
        const histRes = await fetch(`http://${host}:8000/api/v1/tracks/history`, {
          headers: { "Authorization": `Bearer ${token}` },
          signal: AbortSignal.timeout(3000)
        });
        if (histRes.ok) {
          const histData = await histRes.json();
          if (Array.isArray(histData)) {
            const formatted = histData.map((item: any) => ({
              track_id: item.track_id,
              title: item.title,
              artists: normalizeArtists(item.artists),
              album: normalizeAlbum(item.album) || "Single",
              thumbnail: item.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300",
              playedAt: item.played_at
            }));
            setHistory(formatted);
            localStorage.setItem("museflow_history", JSON.stringify(formatted));
          }
        }

        // Fetch playlists
        const plRes = await fetch(`http://${host}:8000/api/v1/playlists`, {
          headers: { "Authorization": `Bearer ${token}` },
          signal: AbortSignal.timeout(3000)
        });
        if (plRes.ok) {
          const plData = await plRes.json();
          if (Array.isArray(plData)) {
            // Hydrate tracks for each playlist in parallel
            const hydratedPlaylists = await Promise.all(
              plData.map(async (pl: any) => {
                try {
                  const detailRes = await fetch(`http://${host}:8000/api/v1/playlists/${pl.id}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                  });
                  if (detailRes.ok) {
                    const details = await detailRes.json();
                    return {
                      id: pl.id,
                      title: pl.title,
                      description: pl.description || "",
                      coverUrl: pl.cover_url || "https://images.unsplash.com/photo-1514525253161-c97d3d27a1d4?q=80&w=300",
                      createdAt: pl.created_at,
                      tracks: (details.tracks || []).map((t: any) => ({
                        track_id: t.track_id,
                        title: t.title,
                        artists: normalizeArtists(t.artists) || "Unknown Artist",
                        thumbnail: t.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300",
                        album: normalizeAlbum(t.album) || "Single"
                      }))
                    };
                  }
                } catch (e) {
                  console.error(`Failed to hydrate details for playlist ${pl.id}`, e);
                }
                return {
                  id: pl.id,
                  title: pl.title,
                  description: pl.description || "",
                  coverUrl: pl.cover_url || "https://images.unsplash.com/photo-1514525253161-c97d3d27a1d4?q=80&w=300",
                  createdAt: pl.created_at,
                  tracks: []
                };
              })
            );
            setPlaylists(hydratedPlaylists);
            localStorage.setItem("museflow_playlists", JSON.stringify(hydratedPlaylists));
          }
        }

      } catch (err) {
        console.warn("[Library] Backend sync skipped. Running purely on local client-side sandbox database.", err);
      }
    }
    setIsLoading(false);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;

    const gradientCovers = [
      "https://images.unsplash.com/photo-1514525253161-c97d3d27a1d4?q=80&w=300",
      "https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=300",
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300"
    ];
    const randomCover = gradientCovers[Math.floor(Math.random() * gradientCovers.length)];

    let playlistId = "pl_" + Math.random().toString(36).substring(2, 11);
    let createdAt = new Date().toISOString();
    let description = newPlaylistDesc || "Curated playlist created by you.";
    let coverUrl = randomCover;

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
        const res = await fetch(`http://${host}:8000/api/v1/playlists`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: newPlaylistTitle.trim(),
            description: description,
            is_public: false,
            cover_url: coverUrl
          })
        });
        if (res.ok) {
          const remote = await res.json();
          playlistId = remote.id;
          createdAt = remote.created_at;
          coverUrl = remote.cover_url || coverUrl;
        }
      } catch (err) {
        console.warn("[Library] Playlist backend creation failed, saving locally:", err);
      }
    }

    const newPlaylist: LocalPlaylist = {
      id: playlistId,
      title: newPlaylistTitle.trim(),
      description: description,
      coverUrl: coverUrl,
      tracks: [],
      createdAt: createdAt
    };

    const updated = [newPlaylist, ...playlists];
    setPlaylists(updated);
    localStorage.setItem("museflow_playlists", JSON.stringify(updated));

    // Reset Form
    setNewPlaylistTitle("");
    setNewPlaylistDesc("");
    setIsCreatingPlaylist(false);
  };

  const deletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token && !id.startsWith("pl_")) {
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
        await fetch(`http://${host}:8000/api/v1/playlists/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (err) {
        console.error("[Library] Failed to delete playlist on backend:", err);
      }
    }

    const updated = playlists.filter(p => p.id !== id);
    setPlaylists(updated);
    localStorage.setItem("museflow_playlists", JSON.stringify(updated));
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
    }
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token && !playlistId.startsWith("pl_")) {
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
        await fetch(`http://${host}:8000/api/v1/playlists/${playlistId}/tracks/${encodeURIComponent(trackId)}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (err) {
        console.error("[Library] Failed to remove track from playlist on backend:", err);
      }
    }

    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        return {
          ...p,
          tracks: p.tracks.filter(t => t.track_id !== trackId)
        };
      }
      return p;
    });
    setPlaylists(updatedPlaylists);
    localStorage.setItem("museflow_playlists", JSON.stringify(updatedPlaylists));
  };

  const handleDeleteFavorite = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
        await fetch(`http://${host}:8000/api/v1/tracks/favorites/${encodeURIComponent(trackId)}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (err) {
        console.error("[Library] Failed to delete favorite on backend:", err);
      }
    }

    const updated = likedSongs.filter(item => item.track_id !== trackId);
    setLikedSongs(updated);
    localStorage.setItem("museflow_liked_songs", JSON.stringify(updated));
  };

  const playCollection = (tracksToPlay: LibraryTrack[], startIndex = 0) => {
    if (tracksToPlay.length === 0) return;
    const mapped: Track[] = tracksToPlay.map(t => ({
      track_id: t.track_id,
      title: t.title,
      artists: normalizeArtists(t.artists),
      album: normalizeAlbum(t.album),
      thumbnail: t.thumbnail
    }));
    setQueue(mapped, startIndex);
  };

  const playSingleTrack = (track: LibraryTrack, collection: LibraryTrack[]) => {
    const idx = collection.findIndex(t => t.track_id === track.track_id);
    playCollection(collection, idx >= 0 ? idx : 0);
  };

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Recently";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto min-h-screen pb-36 md:pb-28">
      
      {/* --- WELCOME HERO BANNER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 select-none bg-gradient-to-r from-purple-950/15 via-zinc-950/10 to-transparent p-6 rounded-3xl border border-white/[0.02]">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-widest mb-1 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            Personal Space
          </div>
          <h1 className="text-4xl font-extrabold text-gradient tracking-tight">Your Library</h1>
          <p className="text-zinc-400 mt-2 text-sm max-w-md leading-relaxed">
            Manage your offline sandbox, listen to your synced favorites, and orchestrate custom mood collections.
          </p>
        </div>
        <button
          onClick={() => setIsCreatingPlaylist(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(139,92,246,0.3)] hover:scale-[1.03] active:scale-[0.97] transition-all self-start md:self-auto text-white"
        >
          <Plus className="w-4.5 h-4.5" />
          Create Playlist
        </button>
      </div>

      {/* --- QUICK DASHBOARD TILES --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
        {/* Liked Stats Tile */}
        <div 
          onClick={() => { setActiveTab("liked"); setSelectedPlaylistId(null); }}
          className={`glass-panel rounded-3xl p-6 relative overflow-hidden cursor-pointer border group/tile transition-all duration-300 ${
            activeTab === "liked" && !selectedPlaylistId ? "border-purple-500/40 shadow-[0_8px_30px_rgba(139,92,246,0.1)] bg-purple-950/5" : "border-white/5 hover:border-purple-500/20"
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8 group-hover/tile:scale-125 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 flex items-center justify-center text-purple-400 border border-purple-500/20">
              <Heart className="w-5.5 h-5.5 fill-purple-400/20" />
            </div>
            {likedSongs.length > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); playCollection(likedSongs); }}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover/tile:opacity-100 scale-90 group-hover/tile:scale-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
              </button>
            )}
          </div>
          <h3 className="text-lg font-bold text-white group-hover/tile:text-purple-400 transition-colors">Liked Songs</h3>
          <p className="text-zinc-400 text-xs mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            {likedSongs.length} tracks saved
          </p>
        </div>

        {/* Playlists Stats Tile */}
        <div 
          onClick={() => { setActiveTab("playlists"); setSelectedPlaylistId(null); }}
          className={`glass-panel rounded-3xl p-6 relative overflow-hidden cursor-pointer border group/tile transition-all duration-300 ${
            activeTab === "playlists" && !selectedPlaylistId ? "border-pink-500/40 shadow-[0_8px_30px_rgba(236,72,153,0.1)] bg-pink-950/5" : "border-white/5 hover:border-pink-500/20"
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8 group-hover/tile:scale-125 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-2xl bg-pink-500/15 flex items-center justify-center text-pink-400 border border-pink-500/20">
              <ListMusic className="w-5.5 h-5.5" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white group-hover/tile:text-pink-400 transition-colors">Playlists</h3>
          <p className="text-zinc-400 text-xs mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
            {playlists.length} custom mixers
          </p>
        </div>

        {/* Recently Played Stats Tile */}
        <div 
          onClick={() => { setActiveTab("history"); setSelectedPlaylistId(null); }}
          className={`glass-panel rounded-3xl p-6 relative overflow-hidden cursor-pointer border group/tile transition-all duration-300 ${
            activeTab === "history" && !selectedPlaylistId ? "border-cyan-500/40 shadow-[0_8px_30px_rgba(6,182,212,0.1)] bg-cyan-950/5" : "border-white/5 hover:border-cyan-500/20"
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-8 -mt-8 group-hover/tile:scale-125 transition-transform duration-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
              <History className="w-5.5 h-5.5" />
            </div>
            {history.length > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); playCollection(history); }}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover/tile:opacity-100 scale-90 group-hover/tile:scale-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
              </button>
            )}
          </div>
          <h3 className="text-lg font-bold text-white group-hover/tile:text-cyan-400 transition-colors">Listening History</h3>
          <p className="text-zinc-400 text-xs mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
            {history.length} songs logged
          </p>
        </div>
      </div>

      {/* --- UNIFIED HEADER & SLIDING TAB PILL --- */}
      <div className="border-b border-white/5 pb-5 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 p-1 rounded-2xl w-fit">
          {(["liked", "playlists", "history"] as const).map((tab) => {
            const label = tab === "liked" ? "Liked Songs" : tab === "playlists" ? "Playlists" : "History";
            const isActive = activeTab === tab && !selectedPlaylistId;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedPlaylistId(null);
                }}
                className="relative px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300"
                style={{
                  color: isActive ? "#ffffff" : "#a1a1aa",
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeLibraryTab"
                    className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab === "liked" && <Heart className={`w-3.5 h-3.5 ${isActive ? "fill-purple-400 text-purple-400" : ""}`} />}
                  {tab === "playlists" && <ListMusic className="w-3.5 h-3.5" />}
                  {tab === "history" && <History className="w-3.5 h-3.5" />}
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {selectedPlaylistId && selectedPlaylist && (
          <button
            onClick={() => setSelectedPlaylistId(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Playlists
          </button>
        )}
      </div>

      {/* --- MAIN TAB / DETAIL CONTENT DECK --- */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading" 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm text-zinc-400 font-semibold animate-pulse">Loading catalog cache...</p>
            </motion.div>
          ) : selectedPlaylistId && selectedPlaylist ? (
            /* --- PLAYLIST DETAILED DRILL-DOWN VIEW --- */
            <motion.div
              key={`playlist-detail-${selectedPlaylist.id}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row gap-6 md:items-end select-none">
                <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group bg-gradient-to-tr from-purple-800 to-pink-600 flex-shrink-0">
                  <img
                    src={selectedPlaylist.coverUrl}
                    alt={selectedPlaylist.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Music className="w-8 h-8 text-white/70 animate-bounce" />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold tracking-widest text-pink-400 uppercase bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full">
                    Custom Playlist
                  </span>
                  <h2 className="text-3xl font-extrabold text-white mt-1">{selectedPlaylist.title}</h2>
                  <p className="text-zinc-400 text-sm max-w-xl">{selectedPlaylist.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-2 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Created {formatDate(selectedPlaylist.createdAt)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Disc className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} />
                      {selectedPlaylist.tracks.length} tracks
                    </span>
                  </div>
                </div>
              </div>

              {selectedPlaylist.tracks.length === 0 ? (
                /* Empty Playlist State */
                <div className="flex flex-col items-center justify-center text-center py-20 bg-zinc-900/10 rounded-3xl border border-dashed border-white/5">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                      className="absolute w-20 h-20 rounded-full bg-pink-500/5 blur-xl pointer-events-none"
                    />
                    <svg className="w-16 h-16 text-pink-500/30 drop-shadow-[0_0_15px_rgba(236,72,153,0.3)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-lg text-white">This playlist is empty</h3>
                  <p className="text-zinc-500 text-sm max-w-sm mt-1">
                    Search for songs on the search console and look for the playlist option to populate your custom deck!
                  </p>
                </div>
              ) : (
                /* Playlist Track Table */
                <div className="overflow-x-auto w-full glass-panel rounded-3xl border border-white/5">
                  <table className="w-full border-collapse text-left text-sm text-zinc-400">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-extrabold select-none bg-white/[0.01]">
                        <th className="py-4 px-4 w-14 text-center">#</th>
                        <th className="py-4 px-4 min-w-[240px]">Title</th>
                        <th className="py-4 px-4 hidden md:table-cell">Album</th>
                        <th className="py-4 px-4 w-20 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPlaylist.tracks.map((track, idx) => {
                        const isCurrent = currentTrack?.track_id === track.track_id;
                        return (
                          <tr
                            key={track.track_id + idx}
                            onClick={() => playSingleTrack(track, selectedPlaylist.tracks)}
                            className={`group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer ${
                              isCurrent ? "bg-purple-500/5 text-purple-300" : ""
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center font-bold text-xs select-none">
                              <span className="group-hover:hidden flex items-center justify-center">
                                {isCurrent ? (
                                  <span className="w-4 h-4 text-purple-400 flex items-center justify-center animate-pulse">
                                    ▶
                                  </span>
                                ) : (
                                  idx + 1
                                )}
                              </span>
                              <span className="hidden group-hover:flex items-center justify-center text-white">
                                <Play className="w-3.5 h-3.5 fill-white" />
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3.5 min-w-0">
                                <img
                                  src={track.thumbnail}
                                  alt={track.title}
                                  className="w-10 h-10 rounded-xl object-cover bg-zinc-900 border border-white/5 flex-shrink-0 shadow-md"
                                />
                                <div className="min-w-0">
                                  <h4 className={`text-sm font-semibold truncate ${isCurrent ? "text-purple-400" : "text-white"}`}>
                                    {track.title}
                                  </h4>
                                  <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artists}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 hidden md:table-cell">
                              <span className="text-xs text-zinc-400 truncate block max-w-[200px]">
                                {track.album || "Single"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button 
                                onClick={(e) => removeTrackFromPlaylist(selectedPlaylist.id, track.track_id, e)}
                                className="text-zinc-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                                title="Remove from playlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          ) : activeTab === "liked" ? (
            /* --- LIKED SONGS VIEW --- */
            likedSongs.length === 0 ? (
              <motion.div
                key="empty-liked"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-28 bg-gradient-to-b from-purple-950/5 to-transparent rounded-3xl border border-white/[0.02] select-none"
              >
                {/* SVG glowing pulse heart empty state */}
                <div className="relative w-36 h-36 flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                    className="absolute w-24 h-24 rounded-full bg-purple-500/10 blur-xl pointer-events-none"
                  />
                  <svg className="w-20 h-20 text-purple-500/40 drop-shadow-[0_0_18px_rgba(168,85,247,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                    className="absolute inset-0 border border-dashed border-purple-500/20 rounded-full"
                  />
                </div>
                <h3 className="font-bold text-xl text-white">No Liked Songs Yet</h3>
                <p className="text-zinc-500 text-sm max-w-sm mt-2 leading-relaxed px-4">
                  Start searching for your favorite tracks and hit the heart icon to curate your dashboard here.
                </p>
              </motion.div>
            ) : (
              /* Liked Track Table */
              <motion.div
                key="liked-list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto w-full glass-panel rounded-3xl border border-white/5"
              >
                <table className="w-full border-collapse text-left text-sm text-zinc-400">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-extrabold select-none bg-white/[0.01]">
                      <th className="py-4 px-4 w-14 text-center">#</th>
                      <th className="py-4 px-4 min-w-[240px]">Title</th>
                      <th className="py-4 px-4 hidden md:table-cell">Album</th>
                      <th className="py-4 px-4 hidden lg:table-cell">Date Saved</th>
                      <th className="py-4 px-4 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {likedSongs.map((track, idx) => {
                      const isCurrent = currentTrack?.track_id === track.track_id;
                      return (
                        <tr
                          key={track.track_id + idx}
                          onClick={() => playSingleTrack(track, likedSongs)}
                          className={`group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer ${
                            isCurrent ? "bg-purple-500/5 text-purple-300" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-bold text-xs select-none">
                            <span className="group-hover:hidden flex items-center justify-center">
                              {isCurrent ? (
                                <span className="w-4 h-4 text-purple-400 flex items-center justify-center animate-pulse">
                                  ▶
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </span>
                            <span className="hidden group-hover:flex items-center justify-center text-white">
                              <Play className="w-3.5 h-3.5 fill-white" />
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-10 h-10 rounded-xl object-cover bg-zinc-900 border border-white/5 flex-shrink-0 shadow-md"
                              />
                              <div className="min-w-0">
                                <h4 className={`text-sm font-semibold truncate ${isCurrent ? "text-purple-400" : "text-white"}`}>
                                  {track.title}
                                </h4>
                                <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artists}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <span className="text-xs text-zinc-400 truncate block max-w-[200px]">
                              {track.album || "Single"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 hidden lg:table-cell">
                            <span className="text-xs text-zinc-500">
                              {formatDate(track.likedAt)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button 
                              onClick={(e) => handleDeleteFavorite(track.track_id, e)}
                              className="text-zinc-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                              title="Delete from favorites"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            )
          ) : activeTab === "playlists" ? (
            /* --- PLAYLISTS GRID VIEW --- */
            playlists.length === 0 ? (
              <motion.div
                key="empty-playlists"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-28 bg-gradient-to-b from-pink-950/5 to-transparent rounded-3xl border border-white/[0.02] select-none"
              >
                {/* SVG glowing pulse playlists empty state */}
                <div className="relative w-36 h-36 flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                    className="absolute w-24 h-24 rounded-full bg-pink-500/10 blur-xl pointer-events-none"
                  />
                  <svg className="w-20 h-20 text-pink-500/40 drop-shadow-[0_0_18px_rgba(236,72,153,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                    className="absolute inset-0 border border-dashed border-pink-500/20 rounded-full"
                  />
                </div>
                <h3 className="font-bold text-xl text-white">No custom playlists</h3>
                <p className="text-zinc-500 text-sm max-w-sm mt-2 leading-relaxed px-4">
                  Create a custom playlist and group your favorite selections by genre, activity or vibe.
                </p>
              </motion.div>
            ) : (
              /* Playlists Card Grid */
              <motion.div
                key="playlists-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 select-none"
              >
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => setSelectedPlaylistId(playlist.id)}
                    className="glass-card rounded-3xl p-4 flex flex-col gap-3.5 group relative cursor-pointer border border-white/5 hover:border-pink-500/30"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg bg-gradient-to-tr from-purple-900/35 to-pink-900/35 border border-white/5">
                      <img
                        src={playlist.coverUrl}
                        alt={playlist.title}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                      />
                      {playlist.tracks.length > 0 && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); playCollection(playlist.tracks); }}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300"
                        >
                          <button className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-lg hover:scale-105 active:scale-95">
                            <Play className="w-5 h-5 fill-black ml-0.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 px-1">
                      <h4 className="text-sm font-semibold truncate text-white group-hover:text-pink-400 transition-colors">
                        {playlist.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate mt-1 flex items-center gap-1.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                        {playlist.tracks.length} songs
                      </p>
                    </div>
                    <button
                      onClick={(e) => deletePlaylist(playlist.id, e)}
                      className="absolute top-6 right-6 w-8 h-8 rounded-full bg-black/75 backdrop-blur-md text-zinc-400 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white/5 shadow-md active:scale-90"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )
          ) : (
            /* --- RECENT HISTORY VIEW --- */
            history.length === 0 ? (
              <motion.div
                key="empty-history"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-28 bg-gradient-to-b from-cyan-950/5 to-transparent rounded-3xl border border-white/[0.02] select-none"
              >
                {/* SVG glowing pulse history empty state */}
                <div className="relative w-36 h-36 flex items-center justify-center mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                    className="absolute w-24 h-24 rounded-full bg-cyan-500/10 blur-xl pointer-events-none"
                  />
                  <svg className="w-20 h-20 text-cyan-500/40 drop-shadow-[0_0_18px_rgba(6,182,212,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  </svg>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
                    className="absolute inset-0 border border-dashed border-cyan-500/20 rounded-full"
                  />
                </div>
                <h3 className="font-bold text-xl text-white">Your listening history is empty</h3>
                <p className="text-zinc-500 text-sm max-w-sm mt-2 leading-relaxed px-4">
                  Once you start listening to songs, your recently played tracks will appear here.
                </p>
              </motion.div>
            ) : (
              /* History Track Table */
              <motion.div
                key="history-list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto w-full glass-panel rounded-3xl border border-white/5"
              >
                <table className="w-full border-collapse text-left text-sm text-zinc-400">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-extrabold select-none bg-white/[0.01]">
                      <th className="py-4 px-4 w-14 text-center">#</th>
                      <th className="py-4 px-4 min-w-[240px]">Title</th>
                      <th className="py-4 px-4 hidden md:table-cell">Album</th>
                      <th className="py-4 px-4 hidden lg:table-cell">Played At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((track, idx) => {
                      const isCurrent = currentTrack?.track_id === track.track_id;
                      return (
                        <tr
                          key={track.track_id + idx}
                          onClick={() => playSingleTrack(track, history)}
                          className={`group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer ${
                            isCurrent ? "bg-purple-500/5 text-purple-300" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-bold text-xs select-none">
                            <span className="group-hover:hidden flex items-center justify-center">
                              {isCurrent ? (
                                <span className="w-4 h-4 text-purple-400 flex items-center justify-center animate-pulse">
                                  ▶
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </span>
                            <span className="hidden group-hover:flex items-center justify-center text-white">
                              <Play className="w-3.5 h-3.5 fill-white" />
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-10 h-10 rounded-xl object-cover bg-zinc-900 border border-white/5 flex-shrink-0 shadow-md"
                              />
                              <div className="min-w-0">
                                <h4 className={`text-sm font-semibold truncate ${isCurrent ? "text-purple-400" : "text-white"}`}>
                                  {track.title}
                                </h4>
                                <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artists}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <span className="text-xs text-zinc-400 truncate block max-w-[200px]">
                              {track.album || "Single"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 hidden lg:table-cell">
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(track.playedAt)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* --- CREATE PLAYLIST MODAL DRAWER --- */}
      <AnimatePresence>
        {isCreatingPlaylist && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md glass-panel rounded-[2.5rem] p-6 md:p-8 space-y-6 border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.15)]"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gradient">Create Mixer Playlist</h3>
                <p className="text-xs text-zinc-400 leading-normal">
                  Customize a new sandbox sound tracklist playlist with descriptions.
                </p>
              </div>

              <form onSubmit={handleCreatePlaylist} className="space-y-5">
                <div>
                  <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block mb-1">
                    Playlist Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Chill Late Nights, Coding Focus..."
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 focus:bg-white/[0.04] transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    placeholder="Describe the vibes of this customized tracklist..."
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 focus:bg-white/[0.04] transition-all resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingPlaylist(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-2xl text-xs transition-colors border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3.5 rounded-2xl text-xs transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-500/20"
                  >
                    Create Playlist
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
