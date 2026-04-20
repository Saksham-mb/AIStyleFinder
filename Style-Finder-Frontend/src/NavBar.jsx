import React from 'react';
import { useAuth } from './context/AuthContext';

export default function NavBar({ activePage = "scan", onNavigate }) {
  const { currentUser, loginWithGoogle, logout } = useAuth();

  const navLink = (label, page) => {
    const isActive = activePage === page;
    return (
      <span
        onClick={() => onNavigate && onNavigate(page)}
        className={[
          "font-jost text-xs uppercase tracking-widest cursor-pointer pb-1 transition-colors duration-150",
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
        {/* nav links */}
        {navLink("Scan", "scan")}
        {navLink("Wardrobe", "wardrobe")}

        {/* auth area */}
        {!currentUser ? (
          <button
            onClick={loginWithGoogle}
            className="rounded bg-gold px-4 py-2 font-jost text-xs font-semibold uppercase tracking-[0.1em] text-espresso
                       transition-colors duration-150 hover:bg-gold/90"
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
              className="rounded border border-maroon px-3 py-1.5 font-jost text-[10px] uppercase tracking-widest text-sand/40
                         transition-colors duration-150 hover:border-maroon-deep hover:text-sand/60 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}