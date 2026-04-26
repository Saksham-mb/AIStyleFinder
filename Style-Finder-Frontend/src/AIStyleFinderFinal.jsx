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

// ─── Recent Scan Card ─────────────────────────────────────────────────────────
function ScanCard({ scan, index = 0 }) {
  const empty = !scan;

  if (empty) {
    return (
      <div
        className="group relative flex flex-col overflow-hidden rounded-2xl
                   bg-maroon-deep/80 shadow-lg shadow-black/30
                   transition-all duration-300 ease-out"
        style={{ animationDelay: `${index * 90}ms` }}
      >
        <div className="relative overflow-hidden w-full">
          <div className="m-3 overflow-hidden rounded-xl border-[2.5px] border-sand/10 shadow-inner shadow-black/20">
            <div className="overflow-hidden rounded-[9px] border border-sand/5">
              <div className="aspect-[4/5] w-full animate-pulse bg-maroon-dark/50" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-2 justify-center">
          <div className="h-px w-10 bg-gold/10 mx-auto mb-2" />
          <p className="font-jost text-xs text-sand/20 text-center">Your recent scans will appear here</p>
        </div>
      </div>
    );
  }

  // 1. Format the timestamp
  const dateString = new Date(scan.scanned_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // 2. THE FIX: Bulletproof data normalization
  const rawItems = scan.analysis_payload?.items || scan.analysis_payload || [];
  
  const displayItems = Array.isArray(rawItems)
    ? rawItems.map(item => {
        // Case A: It's just a raw string from Gemini
        if (typeof item === "string") return { type: item, brand: null };
        
        // Case B: It is the full SerpApi payload (This caused the crash!)
        if (item && typeof item === "object" && item.detectedItem) {
          return {
            type: item.detectedItem,
            // Grab the brand from the top search result to make the card look premium
            brand: item.results && item.results.length > 0 ? item.results[0].brand : null
          };
        }
        
        // Case C: Standard pre-formatted {type, brand} or {value} object
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
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {/* ── image area ─────────────────────────────────────── */}
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

      {/* ── info area ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-2">
        <h3 className="font-instrument text-xl leading-tight text-sand/90 sm:text-2xl">
          Archive Look
        </h3>
        <div className="h-px w-10 bg-gold/40" />

        {/* ── THE FIXED JSX ── */}
        <ul className="flex flex-col gap-1.5 min-h-[44px]">
          {displayItems.length > 0 ? (
            displayItems.map((item, i) => (
              <li key={i} className="font-jost text-sm leading-snug">
                {/* No more dangerous || item fallback */}
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIStyleFinderFinal({ onNavigate, setIsProcessing }) {
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

  // Sync the local processing state with the global NavBar lock
  useEffect(() => {
    if (setIsProcessing) {
      setIsProcessing(appState === "scanning" || appState === "searching");
    }
  }, [appState, setIsProcessing]);

  // ── Fetch recent scans whenever we return to idle ──
  useEffect(() => {
    if (appState !== "idle" || !currentUser) return;
    (async () => {
      try {
        const token = await currentUser.getIdToken();
        const res   = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/wardrobe?limit=3`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        setRecentScans(await res.json());
      } catch { /* non-critical — placeholders show */ }
    })();
  }, [appState, currentUser]);

  const displayScans = [...recentScans];
  while (displayScans.length < 3) displayScans.push(null);

  // ── File handling ──
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

  // ── Label cycling ──
  const startLabelCycle = (labels) => {
    let i = 0;
    setLoadingLabel(labels[0]);
    labelIntervalRef.current = setInterval(() => { i = (i + 1) % labels.length; setLoadingLabel(labels[i]); }, 1600);
  };
  const stopLabelCycle = () => clearInterval(labelIntervalRef.current);

  // ── API Call 1: analyze image ──
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
      if (!res.ok) {if (res.status === 429) throw new Error("RATE_LIMIT");throw new Error(res.status === 401 ? "Auth failed." : "Analyze failed.");}
      const data = await res.json();
      setCloudImageURL(data.imageUrl);
      stopLabelCycle();
      setDetectedItems(data.items.map((val, id) => ({ id, value: val })));
      setAppState("verifying");
    } catch (err) {
      console.error(err); stopLabelCycle(); setAppState("uploaded");
      if (err.message === "RATE_LIMIT") {
        alert("Whoa, slow down! You've hit the scan limit. Please wait 60 seconds.");
      } else {
        alert("Error scanning image. Please check your connection.");
      }
    }
  };

  // ── API Call 2: find dupes ──
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
      if (!res.ok) {if (res.status === 429) throw new Error("RATE_LIMIT");throw new Error(res.status === 401 ? "Auth failed." : "Analyze failed.");}
      stopLabelCycle(); setResults(await res.json()); setAppState("results");
    } catch (err) {
      console.error(err); stopLabelCycle(); setAppState("verifying");
      if (err.message === "RATE_LIMIT") {
        alert("Whoa, slow down! You've hit the scan limit. Please wait 60 seconds.");
      } else {
        alert("Error finding dupes. Please check your connection.");
      }
    }
  };

  // ── Item editing ──
  const handleDeleteItem = (id) => setDetectedItems((p) => p.filter((i) => i.id !== id));
  const handleEditItem   = (id, v) => setDetectedItems((p) => p.map((i) => i.id === id ? { ...i, value: v } : i));

  // ── Reset ──
  const handleReset = () => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(null); setSelectedFile(null); setCloudImageURL(null);
    setDetectedItems([]); setResults([]);
    setAppState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Derived booleans ──
  const isIdle         = appState === "idle";
  const showScanBtn    = appState === "uploaded";
  const showScanning   = appState === "scanning";
  const showVerifyList = ["verifying", "searching", "results"].includes(appState) && detectedItems.length > 0;
  const showFindBtn    = appState === "verifying";
  const showSearching  = appState === "searching";
  const showResultsContainer   = appState === "results";
  const isProcessing = appState === "scanning" || appState === "searching";

  return (
    <>
      <div className="min-h-screen bg-maroon-dark text-sand font-jost selection:bg-gold/30 flex flex-col relative overflow-hidden">
        
        {/* Main Content Area */}
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-10 pt-10 sm:pt-16 relative min-h-[500px] flex flex-col justify-center">
          
          <div className="w-full flex justify-center relative">
            
            {/* ── LEFT COLUMN: MARKETING (Fades out gently) ── */}
            <div className={`flex flex-col lg:absolute lg:left-0 lg:top-1/2 lg:-translate-y-1/2 w-full lg:w-[45%] transition-all duration-700 ease-in-out z-0 overflow-hidden lg:overflow-visible ${isIdle ? "opacity-100 max-h-[800px] pointer-events-auto" : "opacity-0 max-h-0 lg:max-h-[800px] pointer-events-none"}`}>
              <div className="flex flex-col mx-auto transition-all duration-700 w-full">
                <div className="mb-5 flex items-center gap-3">
                <span className="inline-block h-px w-6 border-t border-sand/20" />
                <span className="font-montserrat text-[10px] uppercase tracking-[0.15em] text-sand/40">
                  AI-powered fashion search
                </span>
              </div>
              <h1 className="font-bokor text-5xl leading-tight text-sand transition-colors">
                See it.<br />
                <span className="italic text-gold">Find it.</span><br />
                Own it.
              </h1>
              <p className="mt-4 max-w-sm font-jost text-sm leading-relaxed text-sand/50">
                Upload any outfit photo. Get exact matches and budget dupes instantly.
              </p>
              <div className="mt-8 flex items-start gap-8">
                {[
                  // { value: "12,400+", label: "looks scanned" },
                  { value: "100+",       label: "retailers searched" },
                  { value: "<10s",     label: "avg result" },
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="font-instrument text-xl text-gold">{stat.value}</span>
                    <span className="font-jost text-[9px] uppercase tracking-widest text-sand/30">{stat.label}</span>
                  </div>
                ))}
              </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: THE ENGINE ── */}
            <div className={`w-full flex transition-[margin,width] duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isIdle ? "lg:w-[50%] lg:ml-[50%] justify-center" : "w-full ml-0 justify-center"}`}>
              <div className="w-full max-w-md shrink-0 flex justify-center z-10 relative">
                <div
                  className={`w-full rounded-2xl border transition-all duration-700 bg-maroon-deeper flex flex-col relative shadow-2xl p-6 ${isDragOver ? "border-gold/50" : "border-maroon/30"}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                
                {/* Unified Dropzone & Image Area (Expands after arriving) */}
                <div 
                  className={`relative w-full shrink-0 rounded-xl overflow-hidden flex flex-col items-center justify-center bg-maroon-dark ${isDragOver ? "border-2 border-dashed border-gold/50 shadow-inner" : "border border-maroon/40"} ${isIdle ? "mb-0" : "mb-2"}`}
                  style={{
                    height: isIdle ? "400px" : "max(400px, calc(100vh - 220px))",
                    transition: isIdle 
                      ? "height 0.5s ease-in-out, margin-bottom 0.5s ease, background-color 0.3s, border-color 0.3s" 
                      : "height 0.8s cubic-bezier(0.4,0,0.2,1) 800ms, margin-bottom 0.8s cubic-bezier(0.4,0,0.2,1) 800ms, background-color 0.3s, border-color 0.3s"
                  }}
                  onClick={() => !imageURL && fileInputRef.current?.click()}
                >
                  
                  {/* Background Image (When Uploaded) */}
                  {(imageURL || cloudImageURL) && (
                    <img src={imageURL || cloudImageURL} alt="Uploaded outfit"
                      className={`w-full h-full object-cover absolute inset-0 block cursor-pointer transition-opacity duration-700 ${isIdle ? "opacity-0" : "opacity-100"}`}
                      onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    />
                  )}

                  {/* Idle Content Overlay */}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center w-full h-full transition-opacity duration-700 bg-maroon-deeper ${isIdle ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
                    <div className="mb-5 mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-maroon/60 text-sand/40 bg-maroon-dark/50 shadow-inner cursor-pointer">
                      <CameraIcon />
                    </div>
                    <p className="mb-1 font-instrument text-2xl text-sand">What's your fit today?</p>
                    <p className="mb-7 font-jost text-[13px] tracking-wide text-sand/40">Drop an image or click to browse</p>
                    <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="rounded-lg bg-gold px-8 py-3.5 font-jost text-xs font-semibold uppercase tracking-[0.15em] text-espresso transition-all duration-300 hover:bg-gold-light hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:-translate-y-0.5 active:translate-y-0">
                      Upload photo
                    </button>
                    <span className="my-5 font-jost text-[11px] text-sand/20 flex items-center gap-4 w-[60%] before:h-px before:flex-1 before:bg-maroon after:h-px after:flex-1 after:bg-maroon">OR</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="rounded-lg border border-maroon px-6 py-2.5 font-jost text-xs uppercase tracking-widest text-sand/60 transition-colors duration-300 hover:border-maroon-light hover:text-sand hover:bg-maroon-dark bg-maroon-dark/30">
                      Take a photo
                    </button>
                  </div>

                  {/* Change Button Overlay (When Uploaded) */}
                  <button 
                    className={`absolute bottom-4 right-4 bg-espresso/60 backdrop-blur border border-sand/10 text-sand text-xs uppercase tracking-widest px-4 py-2 rounded-lg transition-all duration-700 hover:bg-espresso shadow ${isIdle || isProcessing ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100 pointer-events-auto translate-y-0"}`}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    disabled={isProcessing}
                  >
                    Change
                  </button>

                </div>

                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />

                {/* Action Buttons & Loaders (Scanning Flow) */}
                <div className={`transition-all duration-700 overflow-hidden w-full ${showScanBtn ? "max-h-[100px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
                  <button onClick={handleScan}
                    className="w-full rounded-xl bg-gold text-espresso font-instrument italic text-xl py-4 shadow-sm transition-colors hover:bg-gold/90">
                    Scan Fit
                  </button>
                </div>

                <div className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full ${showScanning ? "max-h-[100px] opacity-100 mt-2 py-2" : "max-h-0 opacity-0 mt-0 py-0"}`}>
                  <div className="w-full flex flex-col items-center gap-3">
                    <div className="w-full h-1 bg-maroon rounded-full overflow-hidden">
                      <div className="h-full w-1/2 bg-gold rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
                    </div>
                    <span className="font-jost text-[10px] tracking-widest uppercase text-sand/60">{loadingLabel}</span>
                  </div>
                </div>

                <div className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full ${showVerifyList ? "max-h-[1000px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
                  <div className="w-full flex flex-col gap-2">
                    {detectedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-maroon-dark border border-maroon rounded-lg px-4 py-3">
                        <input
                          className={`bg-transparent border-none outline-none font-jost text-sm text-sand flex-1 ${appState !== "verifying" ? "pointer-events-none opacity-60" : ""}`}
                          value={item.value}
                          onChange={(e) => handleEditItem(item.id, e.target.value)}
                          placeholder="Item name..."
                        />
                        {appState === "verifying" && (
                          <button className="text-sand/40 hover:text-sand ml-2" onClick={() => handleDeleteItem(item.id)}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full ${showFindBtn ? "max-h-[100px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
                  <button onClick={handleFindMyFit} disabled={detectedItems.length === 0}
                    className="w-full rounded-xl bg-gold text-espresso font-instrument italic text-2xl py-4 shadow-[0_4px_14px_rgba(212,175,55,0.2)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gold-light hover:shadow-[0_6px_20px_rgba(212,175,55,0.4)] disabled:shadow-none disabled:hover:bg-gold">
                    Find My Fit
                  </button>
                </div>

                <div className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full ${showSearching ? "max-h-[100px] opacity-100 mt-2 py-2" : "max-h-0 opacity-0 mt-0 py-0"}`}>
                  <div className="w-full flex flex-col items-center gap-3">
                    <div className="w-full h-1 bg-maroon rounded-full overflow-hidden">
                      <div className="h-full w-1/2 bg-gold rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
                    </div>
                    <span className="font-jost text-[10px] tracking-widest uppercase text-gold/80">{loadingLabel}</span>
                  </div>
                </div>

                <div className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full ${showResultsContainer ? "max-h-[2500px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
                  <div className="w-full flex flex-col gap-3">
                    {results.length === 0 ? (
                       <div className="text-center py-6 border border-maroon border-dashed rounded-xl bg-maroon-dark/50">
                          <p className="font-jost text-sand/60 text-sm">We couldn't find exact matches for these items.</p>
                       </div>
                    ) : (
                    results.map((r, idx) => (
                      <div key={idx} className="bg-espresso-light/30 rounded-xl p-4 border border-maroon/20">
                        <h3 className="font-jost text-sm font-semibold text-sand mb-3 tracking-wide">{r.detectedItem}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {r.results.map((ri, i) => (
                            <a 
                              key={i}
                              href={ri.url !== "#" && ri.url ? ri.url : undefined}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`p-3 rounded-lg border transition-all flex flex-col justify-between group ${
                                ri.url !== "#" && ri.url ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                              } ${
                                ri.type === "Premium Match" 
                                  ? "bg-gold/10 border-gold/30 hover:border-gold/60 hover:bg-gold/20" 
                                  : "bg-maroon-deeper border-maroon hover:border-maroon-light hover:bg-maroon-dark"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-jost text-[10px] uppercase tracking-wider ${
                                  ri.type === "Premium Match" ? "text-gold/80" : "text-sand/60"
                                }`}>
                                  {ri.type}
                                </span>
                                <svg className={`w-3 h-3 transition-colors ${
                                  ri.type === "Premium Match" ? "text-gold/50 group-hover:text-gold" : "text-sand/40 group-hover:text-sand"
                                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                              <div>
                                <div className={`font-jost text-sm font-medium transition-colors ${
                                  ri.type === "Premium Match" ? "text-gold group-hover:text-yellow-400" : "text-sand group-hover:text-white"
                                }`}>
                                  {ri.brand}
                                </div>
                                <div className="font-jost text-xs mt-1 text-sand/70">{ri.price}</div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                    <button onClick={handleReset}
                      className="mt-4 text-sand/50 hover:text-sand font-jost text-[11px] uppercase tracking-widest transition-colors py-3 border border-maroon rounded-lg hover:bg-maroon-dark/80 w-full text-center">
                      ↩ Start Over
                    </button>
                  </div>
                </div>

              </div>
             </div>
            </div>
          </div>

          {/* ── RECENT SCANS (Fades out when not idle) ── */}
          <section className={`transition-all duration-700 overflow-hidden ${isIdle ? "opacity-100 max-h-[1000px] mt-16 pb-20" : "opacity-0 max-h-0 mt-0 pb-0"}`}>
            <div className="flex items-center">
              <span className="font-jost text-[10px] uppercase tracking-[0.14em] text-sand/30">Recent scans</span>
              <span className="mx-4 flex-1 border-t border-maroon" />
              <span onClick={() => { if (!isProcessing) onNavigate?.("wardrobe"); }} className={`font-jost text-[10px] tracking-wide transition-colors ${isProcessing ? "text-sand/20 cursor-not-allowed" : "cursor-pointer text-gold/60 hover:text-gold"}`}>
                View all →
              </span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {displayScans.map((scan, i) => (
                <ScanCard key={scan?.scan_id ?? `placeholder-${i}`} scan={scan} index={i} />
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightboxOpen && (
        <div onClick={() => setLightboxOpen(false)} className="fixed inset-0 z-[999] bg-espresso/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-full max-h-[90vh]">
            <img src={imageURL} alt="Outfit preview" className="max-w-full max-h-[85vh] object-contain rounded-xl border border-maroon shadow-2xl" />
            <button onClick={() => setLightboxOpen(false)} className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-maroon border border-sand text-sand flex items-center justify-center text-sm">✕</button>
          </div>
        </div>
      )}
    </>
  );
}
