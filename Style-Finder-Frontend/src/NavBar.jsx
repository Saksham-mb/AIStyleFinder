import React from 'react';
import { useAuth } from './context/AuthContext';

export default function NavBar({ activePage = "scan", onNavigate, isProcessing = false }) {
  const { currentUser, loginWithGoogle, logout } = useAuth();

  const navLink = (label, page) => {
    const isActive = activePage === page;
    return (
      <span
        onClick={() => {if (!isProcessing && onNavigate) onNavigate(page);}}
        className={[
          "font-jost text-xs uppercase tracking-widest pb-1 transition-colors duration-150",
          isProcessing ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          isActive
            ? "text-gold border-b border-gold"
            : "text-sand/40 hover:text-sand/70",
        ].join(" ")}
      >
        {label}
      </span>
    );
  };

  return (
    <nav className="flex h-14 w-full items-center justify-between bg-maroon-deeper px-6 border-b border-maroon">
      {/* ── Logo ── */}
      <div className="flex items-center cursor-pointer">
        <span className="font-jost text-sm tracking-widest text-sand">AI </span>
        <span className="font-bokor text-xl text-gold">Style</span>
        <span className="font-jost text-sm tracking-widest text-sand"> Finder</span>
      </div>

      {/* ── Right side: nav links + auth ── */}
      <div className="flex items-center gap-6">
        {navLink("Scan", "scan")}
        {navLink("Wardrobe", "wardrobe")}

        {!currentUser ? (
          <button
            onClick={loginWithGoogle}
            disabled={isProcessing}
            className="rounded bg-gold px-4 py-2 font-jost text-xs font-semibold uppercase tracking-[0.1em] text-espresso transition-colors duration-150 hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign In
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {currentUser.photoURL && (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="h-7 w-7 rounded-full border border-maroon"
              />
            )}
            <button
              onClick={logout}
              disabled={isProcessing}
              className={`rounded border px-3 py-1.5 font-jost text-[10px] uppercase tracking-widest transition-colors duration-150 ${
                isProcessing
                  ? "border-maroon/20 text-sand/20 cursor-not-allowed"
                  : "border-maroon text-sand/40 hover:border-maroon-deep hover:text-sand/60 cursor-pointer"
              }`}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}