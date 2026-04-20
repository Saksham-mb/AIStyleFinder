import React, { useState, useEffect } from "react";
import { useAuth } from './context/AuthContext';

/* ─── Outfit Card (Wired to Real Database Payload) ───────────────────── */
function OutfitCard({ scan, index }) {
  // 1. Format the timestamp
  const dateString = new Date(scan.scanned_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // 2. Safely normalize the SerpApi/Gemini payload
  const rawItems = scan.analysis_payload?.items || scan.analysis_payload || [];
  const displayItems = Array.isArray(rawItems)
    ? rawItems.map(item => {
        if (typeof item === "string") return { type: item, brand: null };
        if (item && typeof item === "object" && item.detectedItem) {
          return {
            type: item.detectedItem,
            brand: item.results && item.results.length > 0 ? item.results[0].brand : null
          };
        }
        return {
          type: item.type || item.value || "Item",
          brand: item.brand || null
        };
      })
    : [];

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl
                 bg-maroon-deep/80 shadow-lg shadow-black/30
                 transition-all duration-300 ease-out
                 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* ── image area ── */}
      <div className="relative overflow-hidden">
        <div className="m-3 overflow-hidden rounded-xl border-[2.5px] border-sand/25 shadow-inner shadow-black/20">
          <div className="overflow-hidden rounded-[9px] border border-sand/10">
            <img
              src={scan.image_url}
              alt="Archive Look"
              className="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>
        </div>
        <span className="absolute right-5 top-5 rounded-full bg-espresso/70 px-3 py-1 font-jost text-[10px] font-medium uppercase tracking-[0.15em] text-sand/70 backdrop-blur-md">
          {dateString}
        </span>
      </div>

      {/* ── info area ── */}
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-2">
        <h3 className="font-instrument text-xl leading-tight text-sand/90 sm:text-2xl">
          Archive Look
        </h3>
        <div className="h-px w-10 bg-gold/40" />

        <ul className="flex flex-col gap-1.5">
          {displayItems.length > 0 ? (
            displayItems.map((item, i) => (
              <li key={i} className="font-jost text-sm leading-snug">
                <span className="text-sand/45">{item.type}</span>
                {item.brand && (
                  <>
                    <span className="mx-1.5 text-sand/25">—</span>
                    <span className="font-medium text-gold">{item.brand}</span>
                  </>
                )}
              </li>
            ))
          ) : (
            <li className="font-jost text-sm leading-snug italic text-sand/30">
              Details saved in archive
            </li>
          )}
        </ul>
      </div>

      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
    </div>
  );
}

/* ─── Wardrobe Page ──────────────────────────────────────────────────── */
export default function Wardrobe() {
  const { currentUser } = useAuth();
  const [wardrobe, setWardrobe] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWardrobe = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const API_BASE = import.meta.env.VITE_API_BASE_URL;
        
        // Fetch ALL scans for this user
        const response = await fetch(`${API_BASE}/api/wardrobe`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch wardrobe");

        const data = await response.json();
        setWardrobe(data);
      } catch (error) {
        console.error("Wardrobe Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWardrobe();
  }, [currentUser]);

  return (
    <section className="min-h-screen bg-maroon-dark px-4 py-12 sm:px-8 lg:px-16 animate-fadeUp">
      {/* ── header ── */}
      <header className="mx-auto mb-12 max-w-5xl text-center">
        <p className="mb-2 font-jost text-xs font-medium uppercase tracking-[0.3em] text-gold/70">
          My Archive
        </p>
        <h1 className="font-bokor text-5xl lowercase tracking-wide text-sand sm:text-6xl lg:text-7xl">
          Wardrobe
        </h1>
        <div className="mx-auto mt-4 flex items-center justify-center gap-3">
          <span className="h-px w-12 bg-sand/20" />
          <span className="font-instrument text-sm italic text-sand/40">
            curated looks
          </span>
          <span className="h-px w-12 bg-sand/20" />
        </div>
      </header>

      {/* ── Dynamic Grid ── */}
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
           <div className="w-1/4 h-1 bg-maroon rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-gold rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
           </div>
        </div>
      ) : wardrobe.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <p className="font-instrument text-2xl text-sand/60 mb-2">Your archive is empty.</p>
          <p className="font-jost text-sm text-sand/40">Head back to the scanner to find your first fit.</p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {wardrobe.map((scan, i) => (
            <OutfitCard key={scan.scan_id || i} scan={scan} index={i} />
          ))}
        </div>
      )}

      {/* ── footer flourish ── */}
      {!isLoading && wardrobe.length > 0 && (
        <div className="mx-auto mt-16 flex items-center justify-center gap-2">
          {[...Array(3)].map((_, i) => (
            <span key={i} className="inline-block h-1 w-1 rounded-full bg-gold/30" />
          ))}
        </div>
      )}
    </section>
  );
}