"use client";

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  Mail, Lock, User, Sparkles, X, Loader2,
  Music, ArrowRight, ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [displayName, setDisplayName]   = useState("");
  const [errorText, setErrorText]       = useState<string | null>(null);
  const [successText, setSuccessText]   = useState<string | null>(null);
  const [isLoading, setIsLoading]       = useState(false);

  /* Lock body scroll while open */
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else        document.body.style.overflow = "";
    return ()  => { document.body.style.overflow = ""; };
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetForm = () => {
    setEmail(""); setPassword(""); setDisplayName("");
    setErrorText(null); setSuccessText(null);
  };

  const switchTab = (tab: "signin" | "signup") => {
    setActiveTab(tab); setErrorText(null); setSuccessText(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null); setSuccessText(null); setIsLoading(true);

    if (!email.trim() || !password.trim()) {
      setErrorText("Email and password are required.");
      setIsLoading(false); return;
    }

    try {
      if (activeTab === "signup") {
        if (!displayName.trim()) {
          setErrorText("Display name is required.");
          setIsLoading(false); return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        setSuccessText("Account created! Check your email to confirm.");
        setTimeout(() => { switchTab("signin"); setPassword(""); setSuccessText(null); }, 3000);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (error) throw error;
        if (data.session) localStorage.setItem("token", data.session.access_token);
        setSuccessText("Welcome back! Syncing your profile…");
        setTimeout(() => { onSuccess?.(); onClose(); window.location.reload(); }, 1400);
      }
    } catch (err: any) {
      setErrorText(err.message || "An authentication error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setErrorText(null); setSuccessText(null); setIsLoading(true);
    try {
      const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const res = await fetch(`http://${host}:8000/api/v1/auth/guest`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Could not connect to the local guest service.");
      const data = await res.json();
      if (data.session) {
        localStorage.setItem("token", data.session.access_token);
        setSuccessText("Logged in as Local Guest! Syncing profile…");
        setTimeout(() => { onSuccess?.(); onClose(); window.location.reload(); }, 1400);
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to log in as guest.");
    } finally {
      setIsLoading(false);
    }
  };

  // Only run portal on the client (no document on the server)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        /**
         * Portal target: document.body — completely outside the sidebar's
         * backdrop-filter stacking context.
         * z-[300] sits above MobileNav (z-50) and Sidebar.
         */
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">

          {/* ── Backdrop ── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-2xl"
            onClick={onClose}
          />

          {/* ── Card ── */}
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.88, y: 28 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.88, y: 28  }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative z-10 w-full overflow-hidden flex flex-col"
            style={{
              maxWidth: "min(520px, 100%)",
              maxHeight: "min(780px, 92dvh)",
              borderRadius: "clamp(1.25rem, 4vw, 2rem)",
              background: "linear-gradient(145deg, #0e0e18 0%, #0a0a12 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 32px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Ambient glows */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 40% at 80% 0%, rgba(139,92,246,0.12) 0%, transparent 70%), " +
                  "radial-gradient(ellipse 50% 40% at 20% 100%, rgba(236,72,153,0.08) 0%, transparent 70%)",
              }}
            />

            {/* ── Scrollable inner content ── */}
            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>

              {/* HEADER */}
              <div className="relative px-6 pt-7 pb-6 sm:px-9 sm:pt-9 sm:pb-7 border-b border-white/[0.06]">
                {/* Close */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/8 text-zinc-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Brand */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{
                      width: "clamp(2.5rem, 8vw, 3.25rem)",
                      height: "clamp(2.5rem, 8vw, 3.25rem)",
                      borderRadius: "clamp(0.75rem, 2vw, 1rem)",
                      background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                      boxShadow: "0 0 28px rgba(124,58,237,0.45)",
                    }}
                  >
                    <Music style={{ width: "clamp(1.1rem, 3.5vw, 1.5rem)", height: "clamp(1.1rem, 3.5vw, 1.5rem)", color: "#fff" }} />
                  </div>
                  <div>
                    <h1
                      className="font-black text-white tracking-tight"
                      style={{ fontSize: "clamp(1.2rem, 4vw, 1.5rem)" }}
                    >
                      Muse
                      <span
                        style={{
                          background: "linear-gradient(to right, #a78bfa, #f472b6)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        Flow
                      </span>
                    </h1>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">AI-powered music streaming</p>
                  </div>
                </div>

                {/* Headline */}
                <h2
                  className="font-black text-white leading-tight tracking-tight"
                  style={{ fontSize: "clamp(1.5rem, 6vw, 2.25rem)" }}
                >
                  {activeTab === "signin" ? (
                    <>Your music,{" "}
                      <span style={{
                        background: "linear-gradient(to right, #a78bfa, #f472b6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}>everywhere.</span>
                    </>
                  ) : (
                    <>Join the{" "}
                      <span style={{
                        background: "linear-gradient(to right, #a78bfa, #f472b6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}>experience.</span>
                    </>
                  )}
                </h2>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed" style={{ maxWidth: "36ch" }}>
                  {activeTab === "signin"
                    ? "Sign in to sync your library, playlists and history across every device."
                    : "Create a free account and unlock AI playlists, synced favorites, and more."}
                </p>
              </div>

              {/* FORM */}
              <div className="px-6 py-6 sm:px-9 sm:py-7">

                {/* Tab switcher */}
                <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] mb-6 select-none">
                  {(["signin", "signup"] as const).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => switchTab(tab)}
                        className="relative flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
                        style={{ color: isActive ? "#fff" : "#71717a" }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="authTab"
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.15))",
                              border: "1px solid rgba(124,58,237,0.35)",
                              boxShadow: "0 2px 14px rgba(124,58,237,0.15)",
                            }}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span className="relative z-10">
                          {tab === "signin" ? "Sign In" : "Create Account"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Fields */}
                <form onSubmit={handleAuth} className="space-y-4">

                  {/* Display Name — sign-up only */}
                  <AnimatePresence initial={false}>
                    {activeTab === "signup" && (
                      <motion.div
                        key="dn"
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: "auto"             }}
                        exit={{   opacity: 0, height: 0                   }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <FieldLabel>Display Name</FieldLabel>
                        <Field icon={<User className="w-4 h-4" />}>
                          <input
                            type="text" placeholder="e.g. Keertan"
                            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                            className={inputCls} required autoComplete="name"
                          />
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Email */}
                  <div>
                    <FieldLabel>Email Address</FieldLabel>
                    <Field icon={<Mail className="w-4 h-4" />}>
                      <input
                        type="email" placeholder="name@example.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        className={inputCls} required autoComplete="email"
                      />
                    </Field>
                  </div>

                  {/* Password */}
                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <Field icon={<Lock className="w-4 h-4" />}>
                      <input
                        type="password" placeholder="••••••••••"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className={inputCls} required
                        autoComplete={activeTab === "signin" ? "current-password" : "new-password"}
                      />
                    </Field>
                  </div>

                  {/* Status messages */}
                  <AnimatePresence mode="wait">
                    {errorText && (
                      <motion.p
                        key="err"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-start gap-2.5 px-4 py-3 text-sm font-semibold text-red-400 bg-red-950/20 border border-red-500/20 rounded-2xl"
                      >
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0 mt-1.5" />
                        {errorText}
                      </motion.p>
                    )}
                    {successText && (
                      <motion.p
                        key="ok"
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl"
                      >
                        <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
                        {successText}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full overflow-hidden rounded-2xl font-bold text-white text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    style={{
                      padding: "clamp(0.85rem, 2.5vw, 1.1rem) 1.5rem",
                      background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                      boxShadow: "0 8px 30px rgba(124,58,237,0.35)",
                    }}
                  >
                    {/* Animated shimmer */}
                    <motion.span
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ repeat: Infinity, duration: 2.8, ease: "linear", repeatDelay: 0.8 }}
                    />
                    {isLoading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing…</span></>
                    ) : (
                      <><span>{activeTab === "signin" ? "Access MuseFlow" : "Create My Account"}</span><ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>

                  {/* Local Sandbox Guest Option */}
                  <div className="relative flex items-center justify-center my-4 select-none">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                    <span className="relative px-3 bg-[#0a0a12] text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest">or</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                    className="w-full py-3.5 px-5 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/5 border border-white/5 hover:border-purple-500/30 text-purple-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all duration-300 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 fill-purple-300/10" />
                    <span>Continue as Local Guest (Sandbox Mode)</span>
                  </button>
                </form>

                {/* Trust badge */}
                <div className="flex items-center justify-center gap-2 mt-5 text-[11px] text-zinc-600 select-none">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Secured by Supabase · End-to-end encrypted</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Render via portal so the modal always attaches to document.body,
  // escaping any backdrop-filter / transform stacking context in the sidebar.
  if (!mounted) return null;
  return ReactDOM.createPortal(modalContent, document.body);
};

/* ── Small sub-components to keep JSX clean ── */

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] text-zinc-500 font-bold uppercase tracking-widest pl-1 mb-2">
    {children}
  </label>
);

const Field: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="relative group">
    <span className="pointer-events-none absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-600 group-focus-within:text-purple-400 transition-colors">
      {icon}
    </span>
    {children}
  </div>
);

const inputCls =
  "w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder-zinc-600 " +
  "focus:outline-none focus:border-purple-500/60 focus:ring-4 focus:ring-purple-500/8 " +
  "hover:border-white/[0.13] transition-all duration-250";
