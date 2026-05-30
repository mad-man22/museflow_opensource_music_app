import { create } from 'zustand';
import { API_URL, STREAM_SERVICE_URL } from '../lib/api';

export interface Track {
  track_id: string;
  title: string;
  artists: string | { name: string; id?: string }[] | any;
  album?: string | { name: string; id?: string } | any;
  thumbnail?: string;
  duration?: string | number;
  isHighFidelity?: boolean;
}

export const getAudioSrc = (track: Track) => {
  if (track.isHighFidelity) {
    const backupStreams = [
      "https://corsproxy.io/?https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      "https://corsproxy.io/?https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      "https://corsproxy.io/?https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      "https://corsproxy.io/?https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    ];
    const index = Math.abs(
      track.track_id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % backupStreams.length;
    return backupStreams[index];
  }
  return `${STREAM_SERVICE_URL}/play?videoId=${track.track_id}`;
};

interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: Track[];
  currentIndex: number;
  isRepeat: 'none' | 'all' | 'one';
  isShuffle: boolean;
  playbackRate: number;
  audioRef: HTMLAudioElement | null;

  setAudioRef: (ref: HTMLAudioElement | null) => void;
  playTrack: (track: Track, queueList?: Track[]) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  updateProgress: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setPlaybackRate: (rate: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  queue: [],
  currentIndex: -1,
  isRepeat: 'none',
  isShuffle: false,
  playbackRate: 1.0,
  audioRef: null,

  setAudioRef: (ref) => set({ audioRef: ref }),

  // ─── DIRECT AUDIO IMPERATIVE CONTROL ───
  // We execute .play() and .src directly in the event stack (user click)
  // so browsers do not block autoplay with DOMException: NotAllowedError.

  playTrack: (track, queueList) => {
    let newQueue = [...get().queue];
    let newIndex = newQueue.findIndex((t) => t.track_id === track.track_id);

    if (queueList && queueList.length > 0) {
      newQueue = queueList;
      newIndex = newQueue.findIndex((t) => t.track_id === track.track_id);
    }
    if (newIndex === -1) {
      newQueue.push(track);
      newIndex = newQueue.length - 1;
    }

    set({
      currentTrack: track,
      queue: newQueue,
      currentIndex: newIndex,
      isPlaying: true,
      currentTime: 0,
    });

    const { audioRef } = get();
    if (audioRef) {
      audioRef.src = getAudioSrc(track);
      audioRef.load();
      audioRef.play().catch(e => {
        if (e.name !== 'AbortError') console.warn("playTrack play() error:", e);
      });
    }
  },

  togglePlay: () => {
    const { currentTrack, isPlaying, audioRef } = get();
    if (!currentTrack || !audioRef) return;
    
    if (isPlaying) {
      audioRef.pause();
      set({ isPlaying: false });
    } else {
      audioRef.play().catch(e => {
        if (e.name !== 'AbortError') console.warn("togglePlay play() error:", e);
      });
      set({ isPlaying: true });
    }
  },

  setPlaying: (playing) => {
    const { audioRef, isPlaying } = get();
    if (isPlaying === playing) return;
    
    set({ isPlaying: playing });
    if (audioRef) {
      if (playing) {
        audioRef.play().catch(e => {
          if (e.name !== 'AbortError') console.warn("setPlaying play() error:", e);
        });
      } else {
        audioRef.pause();
      }
    }
  },

  nextTrack: async () => {
    const { queue, currentIndex, isRepeat, isShuffle, audioRef, currentTrack } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (isRepeat === 'all') {
          nextIndex = 0;
        } else if (isRepeat === 'one' && currentTrack) {
          nextIndex = currentIndex;
        } else {
          // Queue ran dry! Fetch related recommendations for endless autoplay
          if (currentTrack) {
            try {
              console.log("[Endless Autoplay] Queue ended, loading recommended vibe for song:", currentTrack.title);
              const res = await fetch(`${API_URL}/api/v1/tracks/related/${currentTrack.track_id}`);
              
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                  // Find recommendations
                  const recommendations = data.map((track: any) => ({
                    track_id: track.videoId || track.track_id,
                    title: track.title,
                    artists: track.artists 
                      ? (Array.isArray(track.artists) ? track.artists.map((a: any) => a.name).join(", ") : track.artists) 
                      : track.author || "Unknown Artist",
                    thumbnail: track.thumbnails 
                      ? (track.thumbnails[0]?.url || track.thumbnails[0]) 
                      : track.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300"
                  }));
                  
                  // Find the first recommendation that is NOT already in the queue to break infinite 2-song loops
                  let nextTrackObj = recommendations.find(
                    (rec: any) => !queue.some((qTrack) => qTrack.track_id === rec.track_id)
                  );
                  
                  // Fallback to the top recommendation if all candidates have already been played in this session
                  if (!nextTrackObj) {
                    nextTrackObj = recommendations[0];
                  }
                  
                  const newQueue = [...queue, nextTrackObj];
                  
                  set({
                    queue: newQueue,
                    currentIndex: queue.length,
                    currentTrack: nextTrackObj,
                    currentTime: 0,
                    isPlaying: true,
                  });
                  
                  if (audioRef) {
                    audioRef.src = getAudioSrc(nextTrackObj);
                    audioRef.load();
                    audioRef.play().catch(e => {
                      if (e.name !== 'AbortError') console.warn("nextTrack autoplay play() error:", e);
                    });
                  }
                  return;
                }
              }
            } catch (err) {
              console.warn("[Endless Autoplay] Recommendation fetch failed:", err);
            }
          }

          set({ isPlaying: false });
          if (audioRef) audioRef.pause();
          return;
        }
      }
    }

    const next = queue[nextIndex];
    if (next) {
      set({
        currentIndex: nextIndex,
        currentTrack: next,
        currentTime: 0,
        isPlaying: true,
      });

      if (audioRef) {
        audioRef.src = getAudioSrc(next);
        audioRef.load();
        audioRef.play().catch(e => {
          if (e.name !== 'AbortError') console.warn("nextTrack play() error:", e);
        });
      }
    }
  },

  prevTrack: () => {
    const { queue, currentIndex, isRepeat, audioRef } = get();
    if (queue.length === 0) return;

    // Restart track if more than 3 seconds in
    if (audioRef && audioRef.currentTime > 3) {
      audioRef.currentTime = 0;
      set({ currentTime: 0 });
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      if (isRepeat === 'all') {
        prevIndex = queue.length - 1;
      } else {
        if (audioRef) audioRef.currentTime = 0;
        set({ currentTime: 0 });
        return;
      }
    }

    const prev = queue[prevIndex];
    if (prev) {
      set({
        currentIndex: prevIndex,
        currentTrack: prev,
        currentTime: 0,
        isPlaying: true,
      });

      if (audioRef) {
        audioRef.src = getAudioSrc(prev);
        audioRef.load();
        audioRef.play().catch(e => {
          if (e.name !== 'AbortError') console.warn("prevTrack play() error:", e);
        });
      }
    }
  },

  seekTo: (seconds) => {
    const { audioRef } = get();
    if (audioRef) {
      audioRef.currentTime = seconds;
    }
    set({ currentTime: seconds });
  },

  updateProgress: (seconds) => set({ currentTime: seconds }),
  
  setDuration: (seconds) => set({ duration: seconds }),

  setVolume: (value) => {
    const { audioRef } = get();
    if (audioRef) {
      audioRef.volume = value;
      audioRef.muted = value === 0;
    }
    set({ volume: value, isMuted: value === 0 });
  },

  toggleMute: () => {
    const { isMuted, audioRef } = get();
    const next = !isMuted;
    if (audioRef) audioRef.muted = next;
    set({ isMuted: next });
  },

  addToQueue: (track) => {
    const { queue } = get();
    if (queue.some((t) => t.track_id === track.track_id)) return;
    set({ queue: [...queue, track] });
  },

  removeFromQueue: (trackId) => {
    const { queue, currentIndex, currentTrack, audioRef } = get();
    const targetIdx = queue.findIndex(t => t.track_id === trackId);
    if (targetIdx === -1) return;
    
    const newQueue = queue.filter(t => t.track_id !== trackId);
    let newIndex = currentIndex;
    
    if (targetIdx === currentIndex) {
      if (newQueue.length > 0) {
        if (newIndex >= newQueue.length) {
          newIndex = 0;
        }
        const next = newQueue[newIndex];
        set({ queue: newQueue, currentIndex: newIndex, currentTrack: next, currentTime: 0 });
        if (audioRef && next) {
          audioRef.src = getAudioSrc(next);
          audioRef.load();
          audioRef.play().catch(() => {});
        }
      } else {
        set({ queue: [], currentIndex: -1, currentTrack: null, currentTime: 0, isPlaying: false });
        if (audioRef) audioRef.pause();
      }
    } else {
      if (targetIdx < currentIndex) {
        newIndex -= 1;
      }
      set({ queue: newQueue, currentIndex: newIndex });
    }
  },

  clearQueue: () => {
    const { audioRef } = get();
    set({ queue: [], currentIndex: -1, currentTrack: null, currentTime: 0, isPlaying: false });
    if (audioRef) {
      audioRef.src = "";
      audioRef.pause();
    }
  },

  setQueue: (tracks, startIndex = 0) => {
    const track = tracks[startIndex] || null;
    set({
      queue: tracks,
      currentIndex: startIndex,
      currentTrack: track,
      currentTime: 0,
      isPlaying: !!track,
    });
    
    const { audioRef } = get();
    if (track && audioRef) {
      audioRef.src = getAudioSrc(track);
      audioRef.load();
      audioRef.play().catch(e => {
        if (e.name !== 'AbortError') console.warn("setQueue play() error:", e);
      });
    }
  },

  reorderQueue: (startIndex, endIndex) => {
    const { queue, currentIndex } = get();
    const result = [...queue];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    let nextIndex = currentIndex;
    if (currentIndex === startIndex) nextIndex = endIndex;
    else if (currentIndex > startIndex && currentIndex <= endIndex) nextIndex -= 1;
    else if (currentIndex < startIndex && currentIndex >= endIndex) nextIndex += 1;

    set({ queue: result, currentIndex: nextIndex });
  },

  toggleRepeat: () => {
    const { isRepeat } = get();
    const cycle: Record<'none' | 'all' | 'one', 'none' | 'all' | 'one'> = { none: 'all', all: 'one', one: 'none' };
    set({ isRepeat: cycle[isRepeat] });
  },

  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

  setPlaybackRate: (rate) => {
    const { audioRef } = get();
    if (audioRef) audioRef.playbackRate = rate;
    set({ playbackRate: rate });
  },
}));
