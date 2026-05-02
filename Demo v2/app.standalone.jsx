/* Main app — hero, timeline, CTA, booking modal, tweaks. */

const { useEffect: useEffect2, useState: useState2, useRef: useRef2 } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentBlue": "#3b82f6",
  "accentOrange": "#fb923c",
  "headline": "Your AI Department, Live in 30 Days.",
  "guaranteeDays": 30,
  "speedMultiplier": 1,
  "showConfetti": true,
  "heroLayout": "stacked"
} /*EDITMODE-END*/;

function useCountUp(target, duration = 1600, start = false) {
  const [val, setVal] = useState2(0);
  useEffect2(() => {
    if (!start) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

function Stat({ label, target, format, delta, decimals = 0, prefix = "", suffix = "", start }) {
  const v = useCountUp(target, 1600, start);
  const display = format ? format(v) : prefix + v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{display}</div>
      {delta && <div className="delta">▲ {delta}</div>}
    </div>);

}

function Hero({ onBook, t }) {
  const [start, setStart] = useState2(false);
  useEffect2(() => {
    const t2 = setTimeout(() => setStart(true), 200);
    return () => clearTimeout(t2);
  }, []);

  // Split headline into two lines: everything before last comma, after last comma
  const headline = t?.headline || "Your AI Department, Live in 30 Days.";
  const lastComma = headline.lastIndexOf(",");
  const line1 = lastComma > -1 ? headline.slice(0, lastComma + 1) : headline;
  const line2 = lastComma > -1 ? headline.slice(lastComma + 1).trim() : "";

  return (
    <section className="hero">
      <div className="hero-grid"></div>
      <div className="container" style={{ position: "relative" }}>
        <span className="eyebrow">
          <span className="dot"></span>
          AI department deployment · {t?.guaranteeDays || 30} days · live agents
        </span>
        <h1>
          {line1}{line2 && <br />}
          {line2 && <span className="accent">{line2}</span>}
        </h1>
        <p className="lede">
          Ramped deploys autonomous AI agents directly into your business systems —
          HubSpot, NetSuite, QuickBooks, Slack, and the rest of your stack — running
          real work in production by day {t?.guaranteeDays || 30}. Not a chatbot. A department.
        </p>
        <div className="hero-ctas">
          <button className="btn btn-orange" onClick={onBook}>
            Book discovery call →
          </button>
          <a href="#demo" className="btn btn-ghost">Try the live demo</a>
        </div>
        <div className="hero-trust">
          <span><span className="check">✓</span> {t?.guaranteeDays || 30}-day deployment guarantee</span>
          <span><span className="check">✓</span> SOC 2 Type II</span>
          <span><span className="check">✓</span> No-replace your existing tools</span>
        </div>

        <div className="stats">
          <Stat start={start} label="Hours saved / week" target={40} suffix="" delta="per deployed agent" />
          <Stat start={start} label="Pipeline added / qtr" target={1200000} format={(v) =>
          "$" + (v / 1000).toFixed(0) + "K"
          } delta="avg. across customers" />
          <Stat start={start} label="Days to production" target={t?.guaranteeDays || 30} delta="guaranteed" />
          <Stat start={start} label="ROI in year one" target={9.4} decimals={1} suffix="x" delta="median" />
        </div>
      </div>
    </section>);

}

function Timeline() {
  const [inView, setInView] = useState2(false);
  const ref = useRef2(null);
  useEffect2(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setInView(true);
    }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const phases = [
  { week: "Week 1", title: "Discovery & system map", body: "We map your stack, processes, and data. Identify the highest-leverage agents to build.", w: 25 },
  { week: "Week 2", title: "Agent build & integration", body: "Custom agents wired into HubSpot, NetSuite, QuickBooks, Slack — trained on your data and tone.", w: 50 },
  { week: "Week 3", title: "Shadow run & calibration", body: "Agents run alongside your team. We tune outputs, edge cases, and approval thresholds.", w: 75 },
  { week: "Week 4", title: "Live in production", body: "Hand-off complete. Agents are autonomous, observable, and improving from every interaction.", w: 100 }];


  return (
    <section className="section" id="timeline">
      <div className="container" ref={ref}>
        <div className="section-head">
          <span className="eyebrow"><span className="dot"></span>The 30-day deployment</span>
          <h2>Four weeks. From kickoff to autonomous.</h2>
          <p>Most AI projects die in pilot purgatory. Ramped runs a fixed-scope deployment with a live agent in production by day thirty — or you don't pay.</p>
        </div>
        <div className="timeline-wrap">
          {phases.map((p, i) =>
          <div key={i} className={"tl-card" + (inView ? " in-view" : "")} style={{ "--w": p.w + "%" }}>
              <div className="tl-num">0{i + 1}/04</div>
              <div className="week">{p.week}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <div className="tl-bar"></div>
            </div>
          )}
        </div>
      </div>
    </section>);

}

function CTASection({ onBook }) {
  return (
    <section className="cta-section" id="cta">
      <div className="container">
        <div className="cta-card">
          <h2>Get a live agent in 30 days,<br />or your deposit back.</h2>
          <p>Twenty-minute discovery call. We'll map your highest-leverage agent and tell you, on the spot, whether Ramped is a fit.</p>
          <div className="cta-row">
            <button className="btn btn-orange" onClick={onBook}>Book discovery call</button>
            <a href="#demo" className="btn btn-ghost">See the demo again</a>
          </div>
          <div className="cta-foot">Backed by the <strong>30-day deployment guarantee</strong> · Average response in under 2 hours</div>
        </div>
      </div>
    </section>);

}

function BookingModal({ open, onClose }) {
  const [submitted, setSubmitted] = useState2(false);
  const [form, setForm] = useState2({ name: "", email: "", company: "", focus: "Sales & RevOps" });
  useEffect2(() => {
    if (!open) return;
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {!submitted ?
        <>
            <h3>Book a discovery call</h3>
            <p>Twenty minutes. We'll scope your first agent and confirm the 30-day plan.</p>
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jamie Rivera" />
            </div>
            <div className="field">
              <label>Work email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jamie@company.com" />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Northwind Logistics" />
            </div>
            <div className="field">
              <label>Where would you start?</label>
              <select value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })}>
                <option>Sales & RevOps</option>
                <option>Finance & Accounting</option>
                <option>Operations & Inventory</option>
                <option>Customer Support</option>
                <option>Not sure yet</option>
              </select>
            </div>
            <button className="btn btn-orange" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
          onClick={() => setSubmitted(true)}
          disabled={!form.name || !form.email}>
              Confirm booking →
            </button>
          </> :

        <div className="booked">
            <div className="big-check"></div>
            <h3 style={{ marginBottom: 8 }}>You're booked.</h3>
            <p>Calendar invite is on its way to <strong style={{ color: "var(--text-0)" }}>{form.email || "your inbox"}</strong>. Talk soon.</p>
          </div>
        }
      </div>
    </div>);

}

function App() {
  const [bookOpen, setBookOpen] = useState2(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const openBook = () => setBookOpen(true);
  const closeBook = () => setBookOpen(false);

  useEffect2(() => {
    const h = () => openBook();
    window.addEventListener("ramped:book", h);
    return () => window.removeEventListener("ramped:book", h);
  }, []);

  // Apply accent colors to CSS vars
  useEffect2(() => {
    const r = document.documentElement;
    r.style.setProperty("--blue", t.accentBlue);
    r.style.setProperty("--orange", t.accentOrange);
    // Derive lighter variants
    r.style.setProperty("--blue-2", t.accentBlue);
    r.style.setProperty("--orange-2", t.accentOrange);
    window.__rampedSpeed = t.speedMultiplier;
    window.__rampedConfetti = t.showConfetti;
  }, [t.accentBlue, t.accentOrange, t.speedMultiplier, t.showConfetti]);

  return (
    <>
      <nav className="nav">
        <div className="container nav-inner">
          <div className="logo">
            <div className="logo-mark"><img src={window.__resources.logo} alt="Ramped" /></div>
            <div className="logo-text">Ramped Ai<span></span></div>
          </div>
          <div className="nav-links">
            <a href="#demo">Demo</a>
            <a href="#timeline">{t.guaranteeDays}-day plan</a>
            <a href="#cta">Pricing</a>
            <a href="#cta">Customers</a>
          </div>
          <button className="btn btn-orange btn-sm" onClick={openBook}>Book call</button>
        </div>
      </nav>

      <Hero onBook={openBook} t={t} />

      <section className="section" id="demo">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow"><span className="dot"></span>Live demo · the Ramped Bot in action</span>
            <h2>Pick a playbook. Watch it run end-to-end.</h2>
            <p>This is a real interface, with real-time agent reasoning. Click any workflow to watch the agent work across your stack — and see the metrics it produces.</p>
          </div>
          <ChatDemo />
        </div>
      </section>

      <Timeline />
      <CTASection onBook={openBook} />

      <footer className="foot">
        <div className="container">
          © 2026 Ramped AI · Original demo prototype · <span style={{ color: "var(--text-2)" }}>Your AI department, live in {t.guaranteeDays} days.</span>
        </div>
      </footer>

      <BookingModal open={bookOpen} onClose={closeBook} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand" />
        <TweakColor label="Primary (blue)" value={t.accentBlue} onChange={(v) => setTweak("accentBlue", v)} />
        <TweakColor label="Accent (orange)" value={t.accentOrange} onChange={(v) => setTweak("accentOrange", v)} />

        <TweakSection label="Hero" />
        <TweakText label="Headline" value={t.headline} onChange={(v) => setTweak("headline", v)} />
        <TweakSlider label="Guarantee (days)" value={t.guaranteeDays} min={14} max={60} step={1} unit=" days" onChange={(v) => setTweak("guaranteeDays", v)} />

        <TweakSection label="Demo" />
        <TweakRadio label="Agent speed" value={t.speedMultiplier === 0.5 ? "Slow" : t.speedMultiplier === 2 ? "Fast" : "Normal"}
        options={["Slow", "Normal", "Fast"]}
        onChange={(v) => setTweak("speedMultiplier", v === "Slow" ? 0.5 : v === "Fast" ? 2 : 1)} />
        <TweakToggle label="Confetti on success" value={t.showConfetti} onChange={(v) => setTweak("showConfetti", v)} />
      </TweaksPanel>
    </>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);