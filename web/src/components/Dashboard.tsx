"use client";

import { Monitor, Phone, Settings2, Twitter, LogOut, CheckCircle2, Play, Volume2, Globe, Clock, MessageSquare, Send, Hash, User, Radio, Trash2, Plus } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { updateUserSettings, addWatchlistItem, removeWatchlistItem } from "../app/actions";

interface DashboardProps {
  session: any;
  linkedAccounts: {
    twitter: boolean;
    telegram: boolean;
    discord: boolean;
  };
  telegramBotUsername: string;
  userSettings?: { voice_style: string, language: string, delivery_preference: string };
  audioSummaries?: any[];
  watchlists?: any[];
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

export default function Dashboard({ session, linkedAccounts, telegramBotUsername, userSettings, audioSummaries = [], watchlists = [] }: DashboardProps) {
  const telegramRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (session && !linkedAccounts.telegram && telegramRef.current) {
      telegramRef.current.innerHTML = "";
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", telegramBotUsername);
      script.setAttribute("data-size", "large");
      script.setAttribute("data-auth-url", `${window.location.origin}/api/auth/telegram`);
      script.setAttribute("data-request-access", "write");
      script.async = true;
      telegramRef.current.appendChild(script);
    }
  }, [session, linkedAccounts.telegram, telegramBotUsername]);

  if (!mounted) return null;

  // -------------------------
  // LOGGED OUT EXPERIENCE
  // -------------------------
  if (!session?.user) {
    return (
      <main className="min-h-screen relative flex flex-col items-center justify-center p-6 lg:p-12 overflow-hidden bg-zinc-950">
        
        {/* Ambient Background Glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,_transparent_40%,_#0c1a3b_100%)] pointer-events-none" />

        <div className="w-full max-w-5xl flex flex-col md:flex-row gap-16 items-center z-10">
          
          <motion.header 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 flex flex-col gap-4 text-center md:text-left"
          >
            <h1 className="text-7xl lg:text-9xl font-bold tracking-tight text-white font-[family-name:var(--font-playfair)]">
              <span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">P</span>ulze
            </h1>
            <p className="text-zinc-300 text-xl font-light tracking-wide max-w-sm mx-auto md:mx-0">
              Unified Identity. Link your platforms once, access your AI everywhere.
            </p>
          </motion.header>

          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex-1 w-full max-w-md flex flex-col gap-4"
          >
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-8 rounded-3xl flex flex-col gap-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-800/80 border border-zinc-700/50 p-3 rounded-xl shadow-inner">
                  <Settings2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-100">Welcome</h2>
                  <p className="text-zinc-400 text-sm">Create your master account.</p>
                </div>
              </div>
              <div className="mt-4">
                <button 
                  onClick={() => signIn('google')}
                  className="w-full bg-white text-zinc-950 font-semibold py-3 px-4 rounded-xl hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                  Sign in with Google
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    );
  }

  // -------------------------
  // LOGGED IN EXPERIENCE (SaaS Dashboard)
  // -------------------------
  return (
    <main className="min-h-screen relative flex flex-col p-6 lg:p-10 overflow-hidden bg-zinc-950 text-zinc-50">
      
      {/* Ambient Dashboard Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Nav */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl mx-auto flex items-center justify-between z-10 mb-12"
      >
        <h1 className="text-4xl font-bold tracking-tight text-white font-[family-name:var(--font-playfair)]">
          <span className="text-red-600">P</span>ulze
        </h1>
        <div className="flex items-center gap-4 bg-zinc-900/50 backdrop-blur-md border border-zinc-800/80 py-2 px-4 rounded-full">
          {session.user?.image && (
            <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full border border-zinc-700" />
          )}
          <span className="font-medium text-sm hidden sm:block">{session.user?.name}</span>
          <button 
            onClick={() => signOut()}
            className="ml-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </motion.nav>

      <motion.div 
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 z-10"
      >
        
        {/* Left Column: Identites & Settings */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          <motion.div variants={fadeUp} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-3xl flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">Connected Platforms</h2>
            
            {/* X Card */}
            <motion.div whileHover={{ y: -2 }} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition-shadow hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)] group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${linkedAccounts.twitter ? 'bg-blue-500/10' : 'bg-zinc-800/50'}`}>
                  <Twitter className={`w-5 h-5 ${linkedAccounts.twitter ? 'text-blue-400' : 'text-zinc-500'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200 text-sm">X (Twitter)</h3>
                  <p className="text-xs text-zinc-500">{linkedAccounts.twitter ? "Active" : "Not connected"}</p>
                </div>
              </div>
              {linkedAccounts.twitter ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <button onClick={() => signIn('twitter')} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 px-3 rounded-lg font-medium transition-colors">
                  Connect
                </button>
              )}
            </motion.div>

            {/* Discord Card */}
            <motion.div whileHover={{ y: -2 }} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition-shadow hover:shadow-[0_4px_20px_rgba(88,101,242,0.15)] group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${linkedAccounts.discord ? 'bg-[#5865F2]/10' : 'bg-zinc-800/50'}`}>
                  <MessageSquare className={`w-5 h-5 ${linkedAccounts.discord ? 'text-[#5865F2]' : 'text-zinc-500'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200 text-sm">Discord</h3>
                  <p className="text-xs text-zinc-500">{linkedAccounts.discord ? "Active" : "Not connected"}</p>
                </div>
              </div>
              {linkedAccounts.discord ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <button onClick={() => signIn('discord')} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 px-3 rounded-lg font-medium transition-colors">
                  Connect
                </button>
              )}
            </motion.div>

            {/* Telegram Card */}
            <motion.div whileHover={{ y: -2 }} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between transition-shadow hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)] group">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${linkedAccounts.telegram ? 'bg-blue-500/10' : 'bg-zinc-800/50'}`}>
                  <Phone className={`w-5 h-5 ${linkedAccounts.telegram ? 'text-blue-400' : 'text-zinc-500'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-200 text-sm">Telegram</h3>
                  <p className="text-xs text-zinc-500">{linkedAccounts.telegram ? "Active" : "Not connected"}</p>
                </div>
              </div>
              {linkedAccounts.telegram ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <div ref={telegramRef} className="scale-90 origin-right">
                  {!session && <button disabled className="text-xs bg-zinc-800 py-1.5 px-3 rounded-lg font-medium">Connect</button>}
                </div>
              )}
            </motion.div>
          </motion.div>

          <motion.div variants={fadeUp} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-3xl flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <Volume2 className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-zinc-100">AI Voice Engine</h2>
            </div>
            
            <form action={updateUserSettings} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Summary Voice Style</label>
                <select name="voiceStyle" defaultValue={userSettings?.voice_style || "Standard (Professional)"} onChange={(e) => e.target.form?.requestSubmit()} className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl p-3 focus:outline-none focus:border-zinc-600 appearance-none">
                  <option>Standard (Professional)</option>
                  <option>Marcus (Fun & Energetic)</option>
                  <option>RoastMaster (Sarcastic)</option>
                  <option>Storyteller</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Translation Target</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select name="language" defaultValue={userSettings?.language || "English"} onChange={(e) => e.target.form?.requestSubmit()} className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl p-3 pl-9 w-full focus:outline-none focus:border-zinc-600 appearance-none">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Delivery Preference</label>
                <p className="text-xs text-zinc-500 -mt-1">Where to send audio when you tag @pulze_agent on X</p>
                <div className="relative">
                  <Send className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select name="deliveryPreference" defaultValue={userSettings?.delivery_preference || "x"} onChange={(e) => e.target.form?.requestSubmit()} className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl p-3 pl-9 w-full focus:outline-none focus:border-zinc-600 appearance-none">
                    <option value="x">Reply on X (Twitter)</option>
                    <option value="discord" disabled={!linkedAccounts.discord}>Discord DM {!linkedAccounts.discord ? '(not connected)' : ''}</option>
                    <option value="telegram" disabled={!linkedAccounts.telegram}>Telegram DM {!linkedAccounts.telegram ? '(not connected)' : ''}</option>
                  </select>
                </div>
              </div>
            </form>
          </motion.div>

        </div>

        {/* Middle Column: X Intelligence */}
        <div className="lg:col-span-1 flex flex-col">
          <motion.div variants={fadeUp} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-3xl h-full flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Twitter className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold text-zinc-100">X Intelligence</h2>
            </div>
            
            <p className="text-xs text-zinc-400">Add targets to monitor. Pulse will send you automated digests.</p>

            <form action={addWatchlistItem} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <select name="type" className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl p-2 focus:outline-none focus:border-zinc-600">
                  <option value="account">Account</option>
                  <option value="topic">Topic</option>
                  <option value="space_topic">Spaces</option>
                </select>
                <div className="relative flex-1">
                  <input type="text" name="target" placeholder="@username or keyword" required className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-xl p-2 w-full focus:outline-none focus:border-zinc-600" />
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </form>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar">
              {watchlists.length === 0 ? (
                <div className="text-zinc-500 text-sm p-4 text-center border border-dashed border-zinc-800 rounded-xl">No active monitors.</div>
              ) : (
                watchlists.map((item, i) => (
                  <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-zinc-950/50 border border-zinc-800/50 p-3 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      {item.type === 'account' ? <User className="w-4 h-4 text-blue-400" /> : item.type === 'topic' ? <Hash className="w-4 h-4 text-green-400" /> : <Radio className="w-4 h-4 text-purple-400" />}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-200">{item.target}</span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.type.replace('_', ' ')} • {item.frequency}</span>
                      </div>
                    </div>
                    <form action={removeWatchlistItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Recent Summaries */}
        <div className="lg:col-span-1 flex flex-col">
          <motion.div variants={fadeUp} className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-6 rounded-3xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-zinc-100">Recent Summaries</h2>
              <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">View All</button>
            </div>

            <div className="flex flex-col gap-3">
              {audioSummaries.length === 0 ? (
                <div className="text-zinc-500 text-sm p-4 text-center">No summaries generated yet.</div>
              ) : (
                audioSummaries.map((item, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ scale: 1.01 }}
                    className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group cursor-pointer transition-colors hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-4">
                      <button className="bg-zinc-800 group-hover:bg-red-600/20 group-hover:text-red-500 p-3 rounded-full transition-colors text-zinc-400">
                        <Play className="w-5 h-5 fill-current" />
                      </button>
                      <div>
                        <h4 className="font-medium text-zinc-200">{item.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                          <span className="bg-zinc-800 px-2 py-0.5 rounded-md capitalize">{item.platform}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-zinc-500 text-sm font-mono">{Math.floor(item.duration_seconds / 60)}:{String(item.duration_seconds % 60).padStart(2, '0')}</span>
                  </motion.div>
                ))
              )}
            </div>

            <div className="mt-auto pt-8 flex items-center justify-center">
              <p className="text-zinc-500 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Pulze is listening across your platforms
              </p>
            </div>
          </motion.div>
        </div>

      </motion.div>
    </main>
  );
}
