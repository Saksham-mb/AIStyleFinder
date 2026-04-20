import { useState, useRef } from "react";
import { useAuth } from './context/AuthContext';

const SCAN_LABELS = [
  "Analyzing threads...",
  "Reading your fit...",
  "Detecting items...",
];

const SEARCH_LABELS = [
  "Scouring the web...",
  "Finding your fit...",
  "Matching styles...",
];

// App states: "idle" | "uploaded" | "scanning" | "verifying" | "searching" | "results"

export default function AIStyleFinder() {
  const { currentUser } = useAuth();
  const [selectedFile, setSelectedFile]   = useState(null);
  const [appState, setAppState]           = useState("idle");
  const [imageURL, setImageURL]           = useState(null);
  const [cloudImageURL, setCloudImageURL] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [results, setResults]             = useState([]);
  const [loadingLabel, setLoadingLabel]   = useState(SCAN_LABELS[0]);
  const [lightboxOpen, setLightboxOpen]   = useState(false);
  const fileInputRef    = useRef(null);
  const labelIntervalRef = useRef(null);
  const nextIdRef       = useRef(100);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (imageURL) URL.revokeObjectURL(imageURL);
    setSelectedFile(file);
    setImageURL(URL.createObjectURL(file));
    setAppState("uploaded");
    setDetectedItems([]);
    setResults([]);
  };

  const startLabelCycle = (labels) => {
    let i = 0;
    setLoadingLabel(labels[0]);
    labelIntervalRef.current = setInterval(() => {
      i = (i + 1) % labels.length;
      setLoadingLabel(labels[i]);
    }, 1600);
  };

  const stopLabelCycle = () => clearInterval(labelIntervalRef.current);

  const handleScan = async () => {
    if (!currentUser) {
      alert("Please sign in with Google to scan outfits.");
      return;
    }
    if (!selectedFile) return;

    setAppState("scanning");
    startLabelCycle(SCAN_LABELS);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const token    = await currentUser.getIdToken();
      const API_BASE = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${API_BASE}/api/analyze-image`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication failed or expired.");
        throw new Error("Failed to analyze image");
      }

      const data = await response.json();
      const formattedItems = data.items.map((val, id) => ({ id, value: val }));

      setCloudImageURL(data.imageUrl);
      stopLabelCycle();
      setDetectedItems(formattedItems);
      setAppState("verifying");

    } catch (error) {
      console.error("Scanning error:", error);
      stopLabelCycle();
      setAppState("uploaded");
      alert("Error scanning image. Is the backend running with a valid Gemini API key?");
    }
  };

  const handleDeleteItem = (id) =>
    setDetectedItems((prev) => prev.filter((item) => item.id !== id));

  const handleEditItem = (id, value) =>
    setDetectedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item))
    );

  const handleAddItem = () => {
    const newId = nextIdRef.current++;
    setDetectedItems((prev) => [...prev, { id: newId, value: "" }]);
  };

  const handleFindMyFit = async () => {
    setAppState("searching");
    startLabelCycle(SEARCH_LABELS);

    try {
      const itemsToSearch = detectedItems.map((item) => item.value);
      const token         = await currentUser.getIdToken();
      const API_BASE      = import.meta.env.VITE_API_BASE_URL;
      const response      = await fetch(`${API_BASE}/api/search-dupes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ items: itemsToSearch , image_url: cloudImageURL}),
      });

      if (!response.ok) throw new Error("Failed to fetch shopping data");

      const data = await response.json();
      stopLabelCycle();
      setResults(data);
      setAppState("results");

    } catch (error) {
      console.error("Aggregator error:", error);
      stopLabelCycle();
      setAppState("verifying");
      alert("Error finding dupes. Check your Python backend logs.");
    }
  };

  const handleReset = () => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(null);
    setDetectedItems([]);
    setResults([]);
    setAppState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Derived Booleans ─────────────────────────────────────────────────────────
  const showScanBtn    = appState === "uploaded";
  const showScanning   = appState === "scanning";
  const showVerifyList =
    ["verifying", "searching", "results"].includes(appState) && detectedItems.length > 0;
  const showFindBtn    = appState === "verifying";
  const showSearching  = appState === "searching";
  const showResults    = appState === "results" && results.length > 0;

  return (
    <>
      {/* ════ PAGE ════ */}
      <div className="min-h-screen bg-sand flex justify-center font-jost">
        <div className="w-full max-w-[393px] flex flex-col items-center gap-14 px-5 py-[54px] pb-20">

          {/* ════ HEADER ════ */}
          <div className="flex items-center justify-center w-full">
            <span className="font-mont-alt text-[32px] font-semibold text-espresso mr-1.5 tracking-tight leading-none">
              AI
            </span>
            <span className="font-bokor text-[54px] text-espresso leading-[0.9] mr-1.5">
              Style
            </span>
            <span className="font-mont-alt text-[32px] font-semibold text-espresso tracking-tight leading-none">
              Finder
            </span>
          </div>

          {/* ════ BODY CONTAINER ════ */}
          <div className="w-full bg-maroon rounded-lg p-1.5 flex flex-col gap-1.5 shadow-[0_6px_32px_rgba(40,8,8,0.22)]">

            {/* ── DYNAMIC DROPZONE ── */}
            <div className="bg-white/25 rounded p-6 px-[15px] flex flex-col items-center gap-4">

              {/* Image Area */}
              <div
                className={[
                  "w-full bg-maroon/70 rounded-md border-2 border-maroon-dark",
                  "flex flex-col items-center justify-center gap-[18px]",
                  "overflow-hidden relative transition-colors duration-200",
                  imageURL ? "min-h-[380px] cursor-default" : "min-h-[300px] cursor-pointer",
                ].join(" ")}
                onClick={() => !imageURL && fileInputRef.current?.click()}
              >
                {!imageURL ? (
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
                ) : (
                  <>
                    <img
                      src={imageURL}
                      alt="Uploaded outfit"
                      className="w-full h-full object-cover absolute inset-0 block cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    />
                    <button
                      className="change-btn"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      Change
                    </button>
                  </>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Scan Fit Button */}
              {showScanBtn && (
                <button
                  className="action-btn w-full bg-maroon-deep border-none rounded-[15px] py-[17px] px-4 font-instrument italic text-[26px] text-sand cursor-pointer shadow-[inset_0_-3px_10px_rgba(0,0,0,0.28)] tracking-[0.3px] flex items-center justify-center transition-[filter,transform] duration-150"
                  onClick={handleScan}
                >
                  Scan Fit
                </button>
              )}

              {/* Scanning Loading State */}
              {showScanning && (
                <div className="w-full flex flex-col items-center gap-3 py-2">
                  <div className="w-full h-[3px] bg-white/15 rounded-sm overflow-hidden">
                    <div className="loading-bar h-full w-[45%] bg-sand rounded-sm animate-barPulse origin-left" />
                  </div>
                  <span className="font-jost text-[11px] tracking-[2.5px] uppercase text-sand/60">
                    {loadingLabel}
                  </span>
                </div>
              )}

              {/* Verification List */}
              {showVerifyList && (
                <div className="w-full flex flex-col gap-2">
                  {detectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white/20 rounded-[10px] px-[15px] py-[10px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.14)]"
                    >
                      <input
                        className={[
                          "chip-input bg-transparent border-none outline-none",
                          "font-montserrat text-[14px] font-medium text-sand flex-1",
                          appState !== "verifying" ? "pointer-events-none" : "",
                        ].join(" ")}
                        value={item.value}
                        onChange={(e) => handleEditItem(item.id, e.target.value)}
                        placeholder="Item name..."
                      />
                      {appState === "verifying" && (
                        <button
                          className="bg-transparent border-none text-sand/60 cursor-pointer text-[15px] pl-3 leading-none font-montserrat font-semibold shrink-0"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  {appState === "verifying" && (
                    <div
                      className="flex items-center bg-white/[0.08] rounded-[10px] px-[15px] py-[10px] border border-dashed border-sand/[0.28] cursor-pointer"
                      onClick={handleAddItem}
                    >
                      <span className="font-montserrat text-[13px] font-medium text-sand/45 tracking-[0.3px]">
                        + Add another item
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Find My Fit Button */}
              {showFindBtn && (
                <button
                  className="action-btn mt-2 w-full bg-maroon-deeper border-none rounded-[15px] py-[17px] px-4 font-instrument italic text-[26px] text-sand cursor-pointer shadow-[inset_0_-3px_10px_rgba(0,0,0,0.28)] tracking-[0.3px] flex items-center justify-center transition-[filter,transform] duration-150"
                  onClick={handleFindMyFit}
                  disabled={detectedItems.length === 0}
                >
                  Find My Fit
                </button>
              )}

              {/* Searching Loading State */}
              {showSearching && (
                <div className="w-full flex flex-col items-center gap-3 py-2">
                  <div className="w-full h-[3px] bg-white/15 rounded-sm overflow-hidden">
                    <div className="loading-bar h-full w-[45%] bg-gold rounded-sm animate-barPulse origin-left" />
                  </div>
                  <span className="font-jost text-[11px] tracking-[2.5px] uppercase text-gold/80">
                    {loadingLabel}
                  </span>
                </div>
              )}

            </div>{/* end dropzone */}

            {/* ── RESULTS AREA ── */}
            {showResults && (
              <div className="w-full flex flex-col gap-2.5 px-1 pb-1">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className="result-item bg-sand/[0.38] rounded-[10px] px-6 py-5 flex flex-col gap-2.5 shadow-[0_2px_14px_rgba(0,0,0,0.14)] animate-fadeUp"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="font-instrument text-[19px] text-sand leading-[1.3]">
                      {idx + 1}. {result.detectedItem}
                    </div>
                    <div className="pl-1 flex flex-col gap-[7px]">
                      <div className="font-montserrat text-[13px] text-sand/85 leading-[1.5]">
                        {`• ${result.results[0].type} — `}
                        <span className="text-gold underline cursor-pointer font-medium">
                          {result.results[0].brand}
                        </span>
                        <span className="text-sand font-semibold ml-1">
                          {result.results[0].price}
                        </span>
                      </div>
                      <div className="font-montserrat text-[13px] text-sand/85 leading-[1.5]">
                        {`• ${result.results[1].type} — `}
                        <span className="text-gold underline cursor-pointer font-medium">
                          {result.results[1].brand}
                        </span>
                        <span className="text-sand font-semibold ml-1">
                          {result.results[1].price}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  className="reset-btn self-center bg-transparent border border-sand/35 rounded-lg px-7 py-2.5 text-sand/70 font-jost text-[11px] tracking-[2.5px] uppercase cursor-pointer mt-1 transition-[border-color,color] duration-200"
                  onClick={handleReset}
                >
                  ↩ Start Over
                </button>
              </div>
            )}

          </div>{/* end bodyContainer */}
        </div>
      </div>

      {/* ════ LIGHTBOX ════ */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-[999] bg-[rgba(10,6,4,0.88)] flex items-center justify-center p-6 animate-lbFadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-[90vh]"
          >
            <img
              src={imageURL}
              alt="Outfit preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg border-2 border-maroon block"
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-3.5 -right-3.5 w-8 h-8 rounded-full bg-maroon border-[1.5px] border-sand text-sand text-sm font-semibold cursor-pointer flex items-center justify-center leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
