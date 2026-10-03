"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const ThemeContext = createContext({
  emerald: false,
  toggle: () => {},
});

export default function LandingTheme({ children }: { children: ReactNode }) {
  const [emerald, setEmerald] = useState(false);

  return (
    <ThemeContext.Provider
      value={{ emerald, toggle: () => setEmerald((current) => !current) }}
    >
      <div
        data-landing-theme={emerald ? "emerald" : "light"}
        className="landing-theme flex min-h-dvh flex-1 flex-col"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function BackgroundToggle() {
  const { emerald, toggle } = useContext(ThemeContext);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={emerald}
      aria-label="Emerald theme"
      title={emerald ? "Switch to light theme" : "Switch to emerald theme"}
      onClick={toggle}
      className="landing-toggle inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-2 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
    >
      <span>Emerald</span>
      <span
        aria-hidden="true"
        className="landing-switch relative inline-flex h-5 w-8 shrink-0 items-center rounded-full"
      >
        <span
          className={`absolute left-1 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${emerald ? "translate-x-3" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}
