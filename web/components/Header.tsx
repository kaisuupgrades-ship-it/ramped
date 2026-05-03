import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { navLinks, tickerItems } from "@/lib/site";

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-bg-0/80 border-b border-line">
      <div className="max-w-[1180px] mx-auto px-6 flex items-center justify-between h-[68px]">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
          <span className="text-text-0">Ramped AI</span>
        </Link>
        <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href as never}
              className="text-[14.5px] text-text-1 hover:text-text-0 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Button href="/book" size="sm" variant="primary">Book a call →</Button>
        </nav>
      </div>
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
    </header>
  );
}
