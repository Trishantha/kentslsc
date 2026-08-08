'use client';

import { useState } from 'react';
import { Navbar } from './Navbar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileAppMenu } from './MobileAppMenu';

interface MobileNavShellProps {
  children: React.ReactNode;
}

export function MobileNavShell({ children }: MobileNavShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Navbar onMenuOpen={() => setMenuOpen(true)} />
      {children}
      <MobileBottomNav onMenuOpen={() => setMenuOpen(true)} />
      <MobileAppMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
