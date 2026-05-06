"use client";

/**
 * Timeline cards — fade in with a stagger and animate their progress bar
 * from 0 → target width once the section enters the viewport. Ported from
 * the legacy IntersectionObserver behavior.
 */
import * as React from "react";

interface Week {
  num: string;
  week: string;
  title: string;
  body: string;
  width: string;
}

export function TimelineCards({ weeks }: { weeks: Week[] }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="grid md:grid-cols-2 gap-4">
      {weeks.map((t, i) => (
        <div
          key={t.num}
          className={`bg-bg-1 bg-gradient-to-b from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.005)] border border-line rounded-2xl p-7 relative overflow-hidden transition-all duration-700 ease-out ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
          style={{ transitionDelay: inView ? `${i * 140}ms` : "0ms" }}
        >
          <div className="font-mono text-[12px] tracking-[0.08em] text-text-3 mb-2">{t.num}</div>
          <div className="text-[12.5px] font-mono uppercase tracking-[0.08em] text-blue-2 font-semibold mb-3">{t.week}</div>
          <h3 className="text-[20px] font-bold tracking-tight m-0 text-text-0">{t.title}</h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-1 m-0">{t.body}</p>
          <div className="mt-5 h-1 rounded-full bg-bg-3 overflow-hidden">
            <div
              className="tl-bar h-full rounded-full bg-gradient-to-r from-blue to-orange"
              style={{ width: inView ? t.width : "0%", transitionDelay: inView ? `${i * 140 + 200}ms` : "0ms" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
