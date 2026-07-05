import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * No Framer route transitions here — they were the main source of jank between / and /explore.
 * Pages handle their own motion sparingly.
 */
export default function PublicLandingLayout() {
  useEffect(() => {
    document.body.classList.add('theme-aurora', 'landing-public-active');
    return () => {
      document.body.classList.remove('theme-aurora', 'landing-public-active');
    };
  }, []);

  return (
    <div className="public-landing-root">
      <Outlet />
    </div>
  );
}
