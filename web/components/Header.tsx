"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { navLinks, tickerItems } from "@/lib/site";

export function Header() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close on Escape, and lock body scroll while drawer is open.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-bg-0/80 border-b border-line">
      <div className="max-w-[1180px] mx-auto px-6 flex items-center justify-between h-[68px]">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight" onClick={() => setDrawerOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Ramped AI" className="w-8 h-8 object-contain" />
          <span className="text-text-0">Ramped AI</span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-5">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href as never}
              className="text-[14.5px] text-text-1 hover:text-text-0 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Button href="/portal" size="sm" variant="blue">Portal</Button>
          <Button href="/book" size="sm" variant="primary">Book a call →</Button>
        </nav>

        {/* Mobile: compact CTA + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Button href="/book" size="sm" variant="primary" className="text-[13px] px-3">Book →</Button>
          <button
            type="button"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setDrawerOpen((o) => !o)}
            className="w-10 h-10 rounded-lg bg-bg-2 border border-line-2 grid place-items-center text-text-1 hover:text-text-0 hover:border-line-2"
          >
            {drawerOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Ticker */}
      <div className="border-t border-line/60 overflow-hidden">
        <div className="ticker-track flex gap-12 py-2.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-text-2">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-good" />
              {t}
            </span>
          ))}
        </div>
        <style>{`
          @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .ticker-track { animation: ticker 40s linear infinite; }
          @media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
        `}</style>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 top-[calc(68px+33px)] bg-bg-0/70 backdrop-blur-sm z-40"
          />
          {/* Panel */}
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile primary"
            className="md:hidden absolute left-0 right-0 top-[calc(68px+33px)] bg-bg-1 border-b border-line shadow-lg z-50 px-6 py-5 flex flex-col gap-1"
          >
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href as never}
                onClick={() => setDrawerOpen(false)}
                className="block px-3 py-3 rounded-lg text-text-0 text-[15.5px] font-medium hover:bg-bg-2 transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 pt-3 border-t border-line flex flex-col gap-2">
              <Button href="/portal" size="lg" variant="blue" className="w-full" onClick={() => setDrawerOpen(false)}>
                Portal
              </Button>
              <Button href="/book" size="lg" variant="primary" className="w-full" onClick={() => setDrawerOpen(false)}>
                Book a discovery call →
              </Button>
            </div>
            <Link
              href="/free-roadmap"
              onClick={() => setDrawerOpen(false)}
              className="mt-1 block text-center px-3 py-3 rounded-lg text-text-2 text-[14px] hover:text-text-0"
            >
              Get your free roadmap →
            </Link>
          </nav>
        </>
      )}
    </header>
  );
}
