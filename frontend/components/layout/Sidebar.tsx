"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Music, Sparkles, LogIn, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";
import { usePlaybackStore } from "../../store/usePlaybackStore";
import { supabase } from "../../lib/supabaseClient";
import { AuthModal } from "../auth/AuthModal";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { isPlaying } = usePlaybackStore();
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem("token", session.access_token);
      } else {
        localStorage.removeItem("token");
      }
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem("token", session.access_token);
      } else {
        localStorage.removeItem("token");
      }
    });

    const handleOpenAuth = () => {
      setIsAuthModalOpen(true);
    };
    window.addEventListener("museflow-open-auth", handleOpenAuth);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("museflow-open-auth", handleOpenAuth);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    window.location.reload();
  };

  const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Search", href: "/search", icon: Search },
    { name: "Library", href: "/library", icon: Library },
  ];

  return (
    <aside className="w-64 glass-panel h-full hidden md:flex flex-col p-6 flex-shrink-0 relative overflow-hidden select-none">
      {/* Background Decorative Ambient Orb */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Logo Brand Section */}
      <Link href="/" className="flex items-center gap-3 mb-10 group relative z-10">
        <motion.div 
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all group-hover:shadow-[0_0_25px_rgba(236,72,153,0.5)]"
        >
          <Music className="w-5 h-5 text-white" />
        </motion.div>
        <div>
          <span className="text-xl font-bold tracking-tight text-white transition-colors duration-300">
            Muse<span className="text-purple-400 group-hover:text-pink-400 transition-colors">Flow</span>
          </span>
          <div className="flex items-center gap-0.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
            <Sparkles className="w-2.5 h-2.5 text-purple-500 fill-purple-500/20" />
            AI Streaming
          </div>
        </div>
      </Link>

      {/* Navigation List */}
      <nav className="flex-1 space-y-3 relative z-10">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href} className="relative block group">
              {/* Glow background for active item */}
              {isActive && (
                <motion.div
                  layoutId="active-nav-glow"
                  className="absolute inset-0 rounded-2xl bg-white/5 border border-purple-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_20px_rgba(139,92,246,0.08)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              <div
                className={`flex items-center gap-4 py-3.5 px-5 rounded-2xl transition-all duration-300 relative z-10 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {/* Active left indicator dot */}
                {isActive && (
                  <motion.span
                    layoutId="active-indicator-dot"
                    className="absolute left-0 w-1.5 h-6 rounded-r-full bg-gradient-to-b from-purple-500 to-pink-500"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}

                <Icon
                  className={`w-5 h-5 transition-transform duration-300 group-hover:scale-105 ${
                    isActive ? "text-purple-400" : "text-zinc-400 group-hover:text-zinc-200"
                  }`}
                />
                <span className="text-sm tracking-wide">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Profile / Auth Section */}
      <div className="mt-auto mb-6 relative z-10">
        {user ? (
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden group">
            {/* Ambient subtle glow when hovered */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white shadow-md relative shrink-0">
                {user.user_metadata?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
              </div>
              
              {/* User Info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {user.user_metadata?.display_name || "MuseFlow User"}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-900/50 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-zinc-400 hover:text-red-400 text-xs font-semibold active:scale-95 transition-all duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden group">
            <p className="text-xs font-semibold text-zinc-300 mb-3 text-center">
              Sign in to sync your library
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold text-xs shadow-lg shadow-purple-500/10 active:scale-95 transition-all duration-300"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-white/5 pt-6 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider relative z-10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>MuseFlow v1.0.0</span>
        </div>
        <p className="mt-1.5 text-zinc-600 font-normal normal-case">Native Windows Sandbox Mode</p>
      </div>

      {/* Auth Modal Overlay */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </aside>
  );
};
