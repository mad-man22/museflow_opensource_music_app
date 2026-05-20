"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, UserCircle2, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";
import { AuthModal } from "../auth/AuthModal";

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    const handleOpenAuth = () => {
      setIsAuthOpen(true);
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
    setShowUserMenu(false);
    window.location.reload();
  };

  const navItems = [
    { name: "Home",    href: "/",        icon: Home    },
    { name: "Search",  href: "/search",  icon: Search  },
    { name: "Library", href: "/library", icon: Library },
  ];

  const avatarLetter =
    user?.user_metadata?.display_name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    null;

  return (
    <>
      {/* ── Bottom tab bar ── */}
      <div className="fixed bottom-0 left-0 w-full z-50 md:hidden select-none">
        {/* User quick-menu (slides up above the tab bar) */}
        <AnimatePresence>
          {showUserMenu && user && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              className="mx-4 mb-2 rounded-2xl bg-[#0f0f18]/95 border border-white/10 backdrop-blur-xl p-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {avatarLetter}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {user.user_metadata?.display_name || "MuseFlow User"}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold active:scale-95 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar itself */}
        <div className="h-16 bg-[#08080b]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Nav links */}
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setShowUserMenu(false)}
                className="relative flex flex-col items-center gap-1 py-1.5 px-4 min-w-[64px] text-center"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-glow"
                    className="absolute inset-0 rounded-xl bg-purple-500/10 border border-purple-500/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`w-5 h-5 ${isActive ? "text-purple-400" : "text-zinc-500"}`} />
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-white" : "text-zinc-500"}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* Auth button */}
          {user ? (
            /* Logged-in avatar button */
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="relative flex flex-col items-center gap-1 py-1.5 px-4 min-w-[64px]"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                {avatarLetter}
              </div>
              <span className="text-[10px] font-semibold tracking-wide text-purple-300">Account</span>
            </button>
          ) : (
            /* Sign-in button */
            <button
              onClick={() => { setShowUserMenu(false); setIsAuthOpen(true); }}
              className="relative flex flex-col items-center gap-1 py-1.5 px-4 min-w-[64px]"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600/30 to-pink-500/30 border border-purple-500/40 flex items-center justify-center">
                <UserCircle2 className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <span className="text-[10px] font-semibold tracking-wide text-purple-400">Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Auth modal — shared, renders above everything */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
};
