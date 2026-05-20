"use client";

import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  X, ListMusic, Plus, Loader2, Check, ChevronRight,
  Music, FolderPlus, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Playlist {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string | null;
  trackTitle?: string;
}

const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

const API = getApiUrl();

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen, onClose, trackId, trackTitle,
}) => {
  const [playlists, setPlaylists]       = useState<Playlist[]>([]);
  const [loading, setLoading]           = useState(false);
  const [adding, setAdding]             = useState<string | null>(null); // playlist id being added to
  const [added, setAdded]               = useState<string | null>(null); // confirmed added
  const [error, setError]               = useState<string | null>(null);

  // Create-new-playlist state
  const [showCreate, setShowCreate]     = useState(false);
  const [newTitle, setNewTitle]         = useState("");
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else        document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Fetch playlists whenever modal opens
  const fetchPlaylists = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { setError("Sign in to manage playlists."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/v1/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not load playlists.");
      setPlaylists(await res.json());
    } catch (e: any) {
      setError(e.message || "Failed to load playlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAdded(null); setAdding(null); setError(null);
      setShowCreate(false); setNewTitle(""); setCreateError(null);
      fetchPlaylists();
    }
  }, [isOpen, fetchPlaylists]);

  // Add track to a playlist
  const addToPlaylist = async (playlistId: string) => {
    if (!trackId) return;
    const token = localStorage.getItem("token");
    if (!token) { setError("Sign in to manage playlists."); return; }
    setAdding(playlistId);
    try {
      const res = await fetch(
        `${API}/api/v1/playlists/${playlistId}/tracks?track_id=${encodeURIComponent(trackId)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to add track.");
      }
      setAdded(playlistId);
      setTimeout(() => { setAdded(null); onClose(); }, 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(null);
    }
  };

  // Create new playlist then add track
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) { setCreateError("Name is required."); return; }
    const token = localStorage.getItem("token");
    if (!token) { setCreateError("Sign in first."); return; }
    setCreating(true); setCreateError(null);
    try {
      // Create playlist
      const res = await fetch(`${API}/api/v1/playlists`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: "", is_public: false }),
      });
      if (!res.ok) throw new Error("Could not create playlist.");
      const created: Playlist = await res.json();

      // Add current track immediately
      if (trackId) {
        await fetch(
          `${API}/api/v1/playlists/${created.id}/tracks?track_id=${encodeURIComponent(trackId)}`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
      }

      setPlaylists((prev) => [created, ...prev]);
      setAdded(created.id);
      setShowCreate(false);
      setNewTitle("");
      setTimeout(() => { setAdded(null); onClose(); }, 1200);
    } catch (e: any) {
      setCreateError(e.message || "Create failed.");
    } finally {
      setCreating(false);
    }
  };

  /* ── Modal JSX ── */
  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1,   y: 0  }}
            exit={{   opacity: 0, scale: 0.9,  y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative z-10 w-full overflow-hidden flex flex-col"
            style={{
              maxWidth: "min(440px, 100%)",
              maxHeight: "min(600px, 90dvh)",
              borderRadius: "clamp(1.25rem, 4vw, 1.75rem)",
              background: "linear-gradient(145deg, #0e0e18 0%, #0a0a12 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 32px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0" style={{
              background:
                "radial-gradient(ellipse 70% 40% at 80% 0%, rgba(139,92,246,0.1) 0%, transparent 70%), " +
                "radial-gradient(ellipse 50% 40% at 20% 100%, rgba(236,72,153,0.07) 0%, transparent 70%)",
            }} />

            {/* ── Header ── */}
            <div className="relative flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600/30 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <ListMusic className="w-4.5 h-4.5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Add to Playlist</h2>
                  {trackTitle && (
                    <p className="text-[11px] text-zinc-500 truncate max-w-[200px] mt-0.5">{trackTitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/8 text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-90 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body — scrollable ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "none" }}>

              {/* Error banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 mb-3 px-3 py-2.5 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-500/20 rounded-2xl"
                  >
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Loading playlists…</span>
                </div>
              )}

              {/* Playlist list */}
              {!loading && !error && (
                <div className="space-y-1.5">
                  {playlists.length === 0 && !showCreate && (
                    <p className="text-center text-xs text-zinc-500 py-6">No playlists yet. Create one below!</p>
                  )}
                  {playlists.map((pl) => {
                    const isAdded   = added   === pl.id;
                    const isAdding  = adding  === pl.id;
                    return (
                      <motion.button
                        key={pl.id}
                        onClick={() => !isAdded && !isAdding && addToPlaylist(pl.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/30 hover:bg-white/[0.06] transition-all duration-200 text-left group"
                        style={isAdded ? { borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.05)" } : {}}
                      >
                        {/* Cover */}
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                          {pl.cover_url
                            ? <img src={pl.cover_url} alt={pl.title} className="w-full h-full object-cover" />
                            : <Music className="w-4 h-4 text-zinc-500" />
                          }
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{pl.title}</p>
                          {pl.description && (
                            <p className="text-[11px] text-zinc-500 truncate">{pl.description}</p>
                          )}
                        </div>
                        {/* State icon */}
                        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all">
                          {isAdding && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                          {isAdded  && <Check className="w-4 h-4 text-emerald-400" />}
                          {!isAdding && !isAdded && (
                            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* ── Create new playlist inline form ── */}
              <AnimatePresence>
                {showCreate && (
                  <motion.form
                    key="create-form"
                    onSubmit={handleCreate}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden mt-2"
                  >
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-purple-500/20 space-y-3">
                      <p className="text-xs font-bold text-purple-300 uppercase tracking-widest">New Playlist</p>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Playlist name…"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/8 transition-all"
                      />
                      {createError && (
                        <p className="text-xs text-red-400 font-semibold">{createError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowCreate(false); setNewTitle(""); setCreateError(null); }}
                          className="flex-1 py-2.5 rounded-xl border border-white/8 text-zinc-400 text-xs font-semibold hover:bg-white/5 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={creating || !newTitle.trim()}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_4px_16px_rgba(139,92,246,0.3)]"
                        >
                          {creating
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</>
                            : <><Sparkles className="w-3.5 h-3.5" />Create & Add</>
                          }
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer — Create new button ── */}
            {!showCreate && (
              <div className="px-4 pb-5 pt-3 shrink-0 border-t border-white/[0.05]">
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-purple-500/30 text-purple-400 text-sm font-semibold hover:bg-purple-500/5 hover:border-purple-400/50 active:scale-[0.98] transition-all duration-200"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create new playlist
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return ReactDOM.createPortal(modal, document.body);
};
