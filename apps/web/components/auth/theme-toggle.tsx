"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const isLight = root.dataset.theme ? root.dataset.theme === "light" : false;
    root.dataset.theme = isLight ? "dark" : "light";
  };

  return (
    <button className="auth-pill" id="theme" type="button" onClick={toggleTheme}>
      Switch theme
    </button>
  );
}
