import { useState, useRef, useEffect } from "react";
import { useAuth } from './context/AuthContext';

const SCAN_LABELS   = ["Analyzing threads...", "Reading your fit...", "Detecting items..."];
const SEARCH_LABELS = ["Scouring the web...",  "Finding your fit...", "Matching styles..."];

// ─── Camera SVG ───────────────────────────────────────────────────────────────
function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="3" />
      <circle cx="12" cy="13" r="4" />
      <path d="M7 6V5a1 1 0 011-1h2l1-1.5h2L14 3.5h0l1 1.5h2a1 1 0 011 1v1" />
    </svg>
  );
}

// ─── Recent Scan Card (idle landing strip) ────────────────────────────────────
function ScanCard({ scan }) {
  const empty = !scan;
  return (
    <div className="group overflow-hidden rounded-xl border border-maroon bg-maroon-deeper
                    transition-all duration-200 hover:border-maroon-deep hover:scale-[1.01]">
      {empty ? (
        <div className="aspect-[4/3] w-full animate-pulse bg-maroon" />
      ) : (
        <img
          src={scan.image_url}
          alt={scan.analysis_payload?.outfitName || "Scan"}
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      <div className="p-3">
        {empty ? (
          <p className="font-jost text-xs text-sand/20">Your first scan will appear here</p>
        ) : (
          <>
            <p className="font-instrument text-sm text-sand">
              {scan.analysis_payload?.outfitName || "Scanned outfit"}
            </p>
            <p className="mt-1 font-jost text-[9px] uppercase tracking-widest text-sand/30">
              {new Date(scan.scanned_at).toLocaleDateString("en-GB", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// appState: "idle" | "uploaded" | "scanning" | "verifying" | "searching" | "results"

export default function AIStyleFinder({ onNavigate }) {
  const { currentUser } = useAuth();

  const [appState,      setAppState]      = useState("idle");
  const [selectedFile,  setSelectedFile]  = useState(null);
  const [imageURL,      setImageURL]      = useState(null);
  const [cloudImageURL, setCloudImageURL] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [results,       setResults]       = useState([]);
  const [loadingLabel,  setLoadingLabel]  = useState(SCAN_LABELS[0]);
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [isDragOver,    setIsDragOver]    = useState(false);
  const [recentScans,   setRecentScans]   = useState([]);

  const fileInputRef     = useRef(null);
  const labelIntervalRef = useRef(null);
  const nextIdRef        = useRef(100);

  // ── Fetch recent scans whenever we return to idle ───────────────────────────
  useEffect(() => {
    if (appState !== "idle" || !currentUser) return;
    (async () => {
      try {
        const token = await currentUser.getIdToken();
        const res   = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/wardrobe`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        setRecentScans((await res.json()).slice(0, 3));
      } catch { /* non-critical — placeholders show */ }
    })();
  }, [appState, currentUser]);

  // Pad to always render 3 cards
  const displayScans = [...recentScans];
  while (displayScans.length < 3) displayScans.push(null);

  // ── File handling ───────────────────────────────────────────────────────────
  const applyFile = (file) => {
    if (!file) return;
    if (imageURL) URL.revokeObjectURL(imageURL);
    setSelectedFile(file);
    setImageURL(URL.createObjectURL(file));
    setDetectedItems([]);
    setResults([]);
    setAppState("uploaded");
  };
  const handleFileInput = (e) => applyFile(e.target.files[0]);
  const handleDrop      = (e) => { e.preventDefault(); setIsDragOver(false); applyFile(e.dataTransfer.files[0]); };
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = ()  => setIsDragOver(false);

  // ── Label cycling ───────────────────────────────────────────────────────────
  const startLabelCycle = (labels) => {
    let i = 0;
    setLoadingLabel(labels[0]);
    labelIntervalRef.current = setInterval(() => { i = (i + 1) % labels.length; setLoadingLabel(labels[i]); }, 1600);
  };
  const stopLabelCycle = () => clearInterval(labelIntervalRef.current);

  // ── API Call 1: analyze image ───────────────────────────────────────────────
  const handleScan = async () => {
    if (!currentUser) { alert("Please sign in with Google to scan outfits."); return; }
    if (!selectedFile) return;
    setAppState("scanning");
    startLabelCycle(SCAN_LABELS);
    try {
      const token    = await currentUser.getIdToken();
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/analyze-image`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Auth failed." : "Analyze failed.");
      const data = await res.json();
      setCloudImageURL(data.imageUrl);
      stopLabelCycle();
      setDetectedItems(data.items.map((val, id) => ({ id, value: val })));
      setAppState("verifying");
    } catch (err) {
      console.error(err); stopLabelCycle(); setAppState("uploaded");
      alert("Error scanning image. Is the backend running with a valid Gemini API key?");
    }
  };

  // ── API Call 2: find dupes ──────────────────────────────────────────────────
  const handleFindMyFit = async () => {
    setAppState("searching");
    startLabelCycle(SEARCH_LABELS);
    try {
      const token = await currentUser.getIdToken();
      const res   = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/search-dupes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: detectedItems.map((i) => i.value), image_url: cloudImageURL }),
      });
      if (!res.ok) throw new Error("Search failed.");
      stopLabelCycle(); setResults(await res.json()); setAppState("results");
    } catch (err) {
      console.error(err); stopLabelCycle(); setAppState("verifying");
      alert("Error finding dupes. Check your Python backend logs.");
    }
  };

  // ── Item editing ────────────────────────────────────────────────────────────
  const handleDeleteItem = (id) => setDetectedItems((p) => p.filter((i) => i.id !== id));
  const handleEditItem   = (id, v) => setDetectedItems((p) => p.map((i) => i.id === id ? { ...i, value: v } : i));
  const handleAddItem    = () => { const id = nextIdRef.current++; setDetectedItems((p) => [...p, { id, value: "" }]); };

  // ── Reset to idle ───────────────────────────────────────────────────────────
  const handleReset = () => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(null); setSelectedFile(null);
    setDetectedItems([]); setResults([]);
    setAppState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Derived booleans ────────────────────────────────────────────────────────
  const showScanBtn    = appState === "uploaded";
  const showScanning   = appState === "scanning";
  const showVerifyList = ["verifying", "searching", "results"].includes(appState) && detectedItems.length > 0;
  const showFindBtn    = appState === "verifying";
  const showSearching  = appState === "searching";
  const showResults    = appState === "results" && results.length > 0;

  // ══════════════════════════════════════════════════════════════════════════
  // IDLE — dark editorial landing
  // ══════════════════════════════════════════════════════════════════════════
  if (appState === "idle") {
    return (
      <div className="min-h-screen bg-maroon-dark">

        {/* Hero */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10
                            px-6 pb-0 pt-16 sm:px-10 lg:grid-cols-2">

          {/* Left: copy */}
          <div className="animate-fadeUp">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-block h-px w-6 border-t border-sand/20" />
              <span className="font-montserrat text-[10px] uppercase tracking-[0.15em] text-sand/40">
                AI-powered fashion search
              </span>
            </div>

            <h1 className="font-bokor text-5xl leading-tight text-sand">
              See it.<br />
              <span className="italic text-gold">Find it.</span><br />
              Own it.
            </h1>

            <p className="mt-4 max-w-sm font-jost text-sm leading-relaxed text-sand/50">
              Upload any outfit photo. Get exact matches and budget dupes&nbsp;— instantly.
            </p>

            <div className="mt-8 flex items-start gap-8">
              {[
                { value: "12,400+", label: "looks scanned"      },
                { value: "3",       label: "retailers searched" },
                { value: "<8s",     label: "avg result"         },
              ].map((stat, i) => (
                <div key={i} className="animate-fadeUp flex flex-col"
                  style={{ animationDelay: `${i * 80}ms` }}>
                  <span className="font-instrument text-xl text-gold">{stat.value}</span>
                  <span className="font-jost text-[9px] uppercase tracking-widest text-sand/30">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: upload zone */}
          <div
            className={[
              "animate-lbFadeIn flex flex-col items-center rounded-2xl border",
              "bg-espresso p-8 text-center transition-colors duration-200",
              isDragOver ? "border-gold" : "border-maroon",
            ].join(" ")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center
                            rounded-full border border-maroon/60 text-sand/40">
              <CameraIcon />
            </div>
            <p className="mb-1 font-instrument text-lg text-sand">What's your fit today?</p>
            <p className="mb-6 font-jost text-xs tracking-wide text-sand/30">
              Drop an image or click to browse
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-gold px-6 py-3 font-jost text-xs font-semibold uppercase
                         tracking-[0.12em] text-espresso transition-colors duration-150
                         hover:bg-gold/90 active:bg-gold/80"
            >
              Upload photo
            </button>
            <span className="my-3 font-jost text-xs text-sand/20">— or —</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-maroon px-5 py-2 font-jost text-xs uppercase
                         tracking-widest text-sand/40 transition-colors duration-150
                         hover:border-maroon-deep hover:text-sand/60"
            >
              Take a photo
            </button>

            {/* Single shared file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </section>

        {/* Recent scans strip */}
        <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
          <div className="flex items-center">
            <span className="font-jost text-[10px] uppercase tracking-[0.14em] text-sand/30">
              Recent scans
            </span>
            <span className="mx-4 flex-1 border-t border-maroon" />
            <span
              onClick={() => onNavigate?.("wardrobe")}
              className="cursor-pointer font-jost text-[10px] tracking-wide
                         text-gold/60 transition-colors duration-150 hover:text-gold"
            >
              View all →
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {displayScans.map((scan, i) => (
              <ScanCard key={scan?.id ?? `placeholder-${i}`} scan={scan} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCAN FLOW — uploaded → scanning → verifying → searching → results
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="min-h-screen bg-sand flex justify-center font-jost">
        <div className="w-full max-w-[393px] flex flex-col items-center gap-14 px-5 py-[54px] pb-20">

          {/* Header */}
          <div className="flex items-center justify-center w-full">
            <span className="font-mont-alt text-[32px] font-semibold text-espresso mr-1.5 tracking-tight leading-none">AI</span>
            <span className="font-bokor text-[54px] text-espresso leading-[0.9] mr-1.5">Style</span>
            <span className="font-mont-alt text-[32px] font-semibold text-espresso tracking-tight leading-none">Finder</span>
          </div>

          {/* Body */}
          <div className="w-full bg-maroon rounded-lg p-1.5 flex flex-col gap-1.5 shadow-[0_6px_32px_rgba(40,8,8,0.22)]">
            <div className="bg-white/25 rounded p-6 px-[15px] flex flex-col items-center gap-4">

              {/* Image area */}
              <div
                className={[
                  "w-full bg-maroon/70 rounded-md border-2 border-maroon-dark",
                  "flex flex-col items-center justify-center gap-[18px]",
                  "overflow-hidden relative transition-colors duration-200",
                  imageURL ? "min-h-[380px] cursor-default" : "min-h-[300px] cursor-pointer",
                ].join(" ")}
                onClick={() => !imageURL && fileInputRef.current?.click()}
              >
                {imageURL ? (
                  <>
                    <img src={imageURL} alt="Uploaded outfit"
                      className="w-full h-full object-cover absolute inset-0 block cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    />
                    <button className="change-btn"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      Change
                    </button>
                  </>
                ) : (
                  <>
                    <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
                      <circle cx="34" cy="34" r="32" stroke="rgba(231,212,174,0.3)" strokeWidth="1.5"/>
                      <rect x="18" y="25" width="32" height="22" rx="3.5" stroke="rgba(231,212,174,0.6)" strokeWidth="1.5"/>
                      <circle cx="34" cy="36" r="7" stroke="rgba(231,212,174,0.6)" strokeWidth="1.5"/>
                      <circle cx="34" cy="36" r="3" fill="rgba(231,212,174,0.3)"/>
                      <rect x="27" y="22" width="8" height="4" rx="1.5" stroke="rgba(231,212,174,0.45)" strokeWidth="1.2"/>
                      <circle cx="46" cy="29" r="1.8" fill="rgba(231,212,174,0.45)"/>
                    </svg>
                    <span className="font-instrument text-[26px] text-sand text-center leading-[1.25] px-3">
                      What's Your Fit Today?
                    </span>
                    <span className="font-jost text-[13px] italic text-sand/65">
                      Click to browse your gallery
                    </span>
                  </>
                )}
              </div>

              {/* Shared file input — same ref used by both idle and scan-flow zones */}
              <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden" onChange={handleFileInput} />

              {showScanBtn && (
                <button onClick={handleScan}
                  className="action-btn w-full bg-maroon-deep border-none rounded-[15px] py-[17px] px-4
                             font-instrument italic text-[26px] text-sand cursor-pointer
                             shadow-[inset_0_-3px_10px_rgba(0,0,0,0.28)] tracking-[0.3px]
                             flex items-center justify-center transition-[filter,transform] duration-150">
                  Scan Fit
                </button>
              )}

              {showScanning && (
                <div className="w-full flex flex-col items-center gap-3 py-2">
                  <div className="w-full h-[3px] bg-white/15 rounded-sm overflow-hidden">
                    <div className="loading-bar h-full w-[45%] bg-sand rounded-sm animate-barPulse origin-left" />
                  </div>
                  <span className="font-jost text-[11px] tracking-[2.5px] uppercase text-sand/60">{loadingLabel}</span>
                </div>
              )}

              {showVerifyList && (
                <div className="w-full flex flex-col gap-2">
                  {detectedItems.map((item) => (
                    <div key={item.id}
                      className="flex items-center justify-between bg-white/20 rounded-[10px]
                                 px-[15px] py-[10px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.14)]">
                      <input
                        className={["chip-input bg-transparent border-none outline-none",
                          "font-montserrat text-[14px] font-medium text-sand flex-1",
                          appState !== "verifying" ? "pointer-events-none" : ""].join(" ")}
                        value={item.value}
                        onChange={(e) => handleEditItem(item.id, e.target.value)}
                        placeholder="Item name..."
                      />
                      {appState === "verifying" && (
                        <button
                          className="bg-transparent border-none text-sand/60 cursor-pointer
                                     text-[15px] pl-3 leading-none font-montserrat font-semibold shrink-0"
                          onClick={() => handleDeleteItem(item.id)}>✕</button>
                      )}
                    </div>
                  ))}
                  {appState === "verifying" && (
                    <div onClick={handleAddItem}
                      className="flex items-center bg-white/[0.08] rounded-[10px] px-[15px] py-[10px]
                                 border border-dashed border-sand/[0.28] cursor-pointer">
                      <span className="font-montserrat text-[13px] font-medium text-sand/45 tracking-[0.3px]">
                        + Add another item
                      </span>
                    </div>
                  )}
                </div>
              )}

              {showFindBtn && (
                <button onClick={handleFindMyFit} disabled={detectedItems.length === 0}
                  className="action-btn mt-2 w-full bg-maroon-deeper border-none rounded-[15px] py-[17px] px-4
                             font-instrument italic text-[26px] text-sand cursor-pointer
                             shadow-[inset_0_-3px_10px_rgba(0,0,0,0.28)] tracking-[0.3px]
                             flex items-center justify-center transition-[filter,transform] duration-150">
                  Find My Fit
                </button>
              )}

              {showSearching && (
                <div className="w-full flex flex-col items-center gap-3 py-2">
                  <div className="w-full h-[3px] bg-white/15 rounded-sm overflow-hidden">
                    <div className="loading-bar h-full w-[45%] bg-gold rounded-sm animate-barPulse origin-left" />
                  </div>
                  <span className="font-jost text-[11px] tracking-[2.5px] uppercase text-gold/80">{loadingLabel}</span>
                </div>
              )}

            </div>

            {showResults && (
              <div className="w-full flex flex-col gap-2.5 px-1 pb-1">
                {results.map((result, idx) => (
                  <div key={idx}
                    className="result-item bg-sand/[0.38] rounded-[10px] px-6 py-5 flex flex-col gap-2.5
                               shadow-[0_2px_14px_rgba(0,0,0,0.14)] animate-fadeUp"
                    style={{ animationDelay: `${idx * 0.1}s` }}>
                    <div className="font-instrument text-[19px] text-sand leading-[1.3]">
                      {idx + 1}. {result.detectedItem}
                    </div>
                    <div className="pl-1 flex flex-col gap-[7px]">
                      {[0, 1].map((ri) => (
                        <div key={ri} className="font-montserrat text-[13px] text-sand/85 leading-[1.5]">
                          {`• ${result.results[ri].type} — `}
                          <span className="text-gold underline cursor-pointer font-medium">{result.results[ri].brand}</span>
                          <span className="text-sand font-semibold ml-1">{result.results[ri].price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={handleReset}
                  className="reset-btn self-center bg-transparent border border-sand/35 rounded-lg
                             px-7 py-2.5 text-sand/70 font-jost text-[11px] tracking-[2.5px]
                             uppercase cursor-pointer mt-1 transition-[border-color,color] duration-200">
                  ↩ Start Over
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[999] bg-[rgba(10,6,4,0.88)] flex items-center justify-center p-6 animate-lbFadeIn">
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-full max-h-[90vh]">
            <img src={imageURL} alt="Outfit preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg border-2 border-maroon block" />
            <button onClick={() => setLightboxOpen(false)}
              className="absolute -top-3.5 -right-3.5 w-8 h-8 rounded-full bg-maroon
                         border-[1.5px] border-sand text-sand text-sm font-semibold
                         cursor-pointer flex items-center justify-center leading-none">✕</button>
          </div>
        </div>
      )}
    </>
  );
}
