import React, { useState } from 'react';
import NavBar from './NavBar';
import AIStyleFinderFinal from './AIStyleFinderFinal';
import Wardrobe from './Wardrobe';

export default function App() {
  const [currentPage, setCurrentPage] = useState("scan");
  
  // 1. Create the shared lock state at the highest level
  const [isAppProcessing, setIsAppProcessing] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 2. Pass the lock down to the NavBar */}
      <NavBar 
        activePage={currentPage} 
        onNavigate={setCurrentPage} 
        isProcessing={isAppProcessing} 
      />

      <main className="flex-1">
        {currentPage === "scan" ? (
          <AIStyleFinderFinal 
            onNavigate={setCurrentPage} 
            // 3. Give the scanner the ability to trigger the lock
            setIsProcessing={setIsAppProcessing} 
          />
        ) : (
          <Wardrobe />
        )}
      </main>
    </div>
  );
}