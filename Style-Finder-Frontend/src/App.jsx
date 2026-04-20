import React, { useState } from 'react';
import NavBar from './NavBar';
import AIStyleFinderFinal from './AIStyleFinderFinal';
import Wardrobe from './Wardrobe';

export default function App() {
  const [activePage, setActivePage] = useState('scan');

  return (
    <>
      <NavBar activePage={activePage} onNavigate={setActivePage} />
      {activePage === 'scan'     && <AIStyleFinderFinal onNavigate={setActivePage} />}
      {activePage === 'wardrobe' && <Wardrobe />}
    </>
  );
}