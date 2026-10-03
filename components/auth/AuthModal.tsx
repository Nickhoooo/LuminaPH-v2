"use client";

import { createContext, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import AuthForm, { type AuthMode } from "./AuthForm";

const AuthContext = createContext<((mode: AuthMode) => void) | null>(null);

export default function AuthModal({ children, initialMode = null }: {
  children: ReactNode;
  initialMode?: AuthMode | null;
}) {
  const [mode, setMode] = useState<AuthMode | null>(initialMode);
  const [closing, setClosing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const isOpen = mode !== null;

  useEffect(() => {
    if (!isOpen) return;
    const element = dialog.current;
    const oldOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = oldOverflow;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      lastTrigger.current?.focus();
    };
  }, [isOpen]);

  function open(nextMode: AuthMode) {
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setClosing(false);
    setMode(nextMode);
  }

  function close() {
    if (closing) return;
    setClosing(true);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    closeTimer.current = setTimeout(() => {
      setMode(null);
      setClosing(false);
      // Remove the direct-entry auth flag when its modal is dismissed.
      const url = new URL(window.location.href);
      if (url.searchParams.has("auth")) {
        url.searchParams.delete("auth");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    }, duration);
  }

  return (
    <AuthContext.Provider value={open}>
      {children}
      <dialog ref={dialog} className="auth-dialog" data-closing={closing}
        aria-labelledby="auth-title" aria-describedby="auth-description"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}>
        {mode && (
          <div className="auth-panel">
            <div className="auth-topline">
              <span className="auth-wordmark">Lumina<span>PH</span><span className="auth-wordmark-dot" aria-hidden="true" /></span>
              <button type="button" onClick={close} aria-label="Close authentication dialog" className="auth-close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <AuthForm key={mode} mode={mode} onSwitch={setMode} />
            <p className="auth-footnote">One topic at a time. A little further every day.</p>
          </div>
        )}
      </dialog>
    </AuthContext.Provider>
  );
}

export function AuthTrigger({ mode = "login", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { mode?: AuthMode }) {
  const open = useContext(AuthContext);
  if (!open) throw new Error("AuthTrigger must be inside AuthModal.");
  return <button {...props} type="button" aria-haspopup="dialog" onClick={() => open(mode)}>{children}</button>;
}
