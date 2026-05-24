"use client";

import { Monitor, Phone, Settings2, Twitter, LogOut, CheckCircle2 } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";

interface DashboardProps {
  session: any;
  linkedAccounts: {
    twitter: boolean;
    telegram: boolean;
  };
  telegramBotUsername: string;
}

export default function Dashboard({ session, linkedAccounts, telegramBotUsername }: DashboardProps) {
  const telegramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session && !linkedAccounts.telegram && telegramRef.current) {
      // Clear any existing script
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

  return (
    <main className="min-h-screen flex flex-col md:flex-row items-center justify-center p-6 lg:p-12"
          style={{ background: 'linear-gradient(135deg, #09090b 50%, #0c1a3b 50%)' }}>
      
      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-12 items-center">
        
        {/* Left Side: Brand & Logo */}
        <header className="flex-1 flex flex-col gap-4 text-center md:text-left z-10">
          <h1 className="text-7xl lg:text-9xl font-bold tracking-tight text-white font-[family-name:var(--font-playfair)]">
            <span className="text-red-600">P</span>ulze
          </h1>
          <p className="text-zinc-300 text-xl font-light tracking-wide max-w-sm mx-auto md:mx-0">
            Unified Identity. Link your platforms once, access your AI everywhere.
          </p>
        </header>

        {/* Right Side: Identity Cards */}
        <section className="flex-1 w-full max-w-md flex flex-col gap-4 z-10">
          {/* Main Account Card */}
          <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 p-6 rounded-2xl flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
                <Settings2 className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-100">Primary Account</h2>
            </div>

            {!session ? (
              <>
                <p className="text-zinc-400 text-sm">
                  Sign in to create your master account and link your identities.
                </p>
                <div className="mt-auto pt-4">
                  <button 
                    onClick={() => signIn('google')}
                    className="w-full bg-white text-zinc-950 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-200 transition-colors"
                  >
                    Sign in with Google
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mt-2 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/50">
                  {session.user?.image && (
                    <img src={session.user.image} alt="Avatar" className="w-10 h-10 rounded-full border border-zinc-700" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{session.user?.name}</span>
                    <span className="text-xs text-zinc-500">{session.user?.email}</span>
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  <button 
                    onClick={() => signOut()}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-300 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Linked Identities */}
          <div className="flex flex-col gap-4">
            
            {/* X (Twitter) Card */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Twitter className={`w-5 h-5 ${linkedAccounts.twitter ? 'text-blue-400' : 'text-zinc-400'}`} />
                <div>
                  <h3 className="font-medium text-zinc-200">X (Twitter)</h3>
                  <p className="text-xs text-zinc-500">
                    {linkedAccounts.twitter ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
              {linkedAccounts.twitter ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
              ) : (
                <button 
                  onClick={() => signIn('twitter')}
                  disabled={!session}
                  className="text-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 py-1.5 px-4 rounded-lg font-medium transition-colors"
                >
                  Connect
                </button>
              )}
            </div>

            {/* Telegram Card */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className={`w-5 h-5 ${linkedAccounts.telegram ? 'text-blue-400' : 'text-zinc-400'}`} />
                <div>
                  <h3 className="font-medium text-zinc-200">Telegram</h3>
                  <p className="text-xs text-zinc-500">
                    {linkedAccounts.telegram ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
              {linkedAccounts.telegram ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
              ) : (
                <div ref={telegramRef} className={!session ? "opacity-50 pointer-events-none" : ""}>
                  {/* Telegram script will mount here */}
                  {!session && (
                    <button disabled className="text-sm bg-zinc-800 text-zinc-300 py-1.5 px-4 rounded-lg font-medium">
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-zinc-400" />
                <div>
                  <h3 className="font-medium text-zinc-200">Discord</h3>
                  <p className="text-xs text-zinc-500">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
