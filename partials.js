/* Shared masthead + footer renderer for Ramped AI site */
(function(){
  // Vercel rewrites .html → clean URL. Match against trailing path segment.
  const seg = location.pathname.replace(/\/$/, "").split("/").pop() || "";
  const isHome = seg===""||seg==="index"||seg==="index.html";
  const isAbout = seg==="about"||seg==="about.html";
  const isCompare = seg==="comparison"||seg==="comparison.html";
  const isResources = seg==="resources"||seg==="resources.html";
  const headerHTML = `
  <header class="mast" role="banner">
    <div class="mast-bar">
      <a href="/" class="brand"><img src="/logo.png" alt=""/><span class="brand-name">Ramped AI</span></a>
      <nav class="nav" aria-label="Primary">
        <a class="desk" href="/about"${isAbout?' aria-current="page"':''}>About</a>
        <a class="desk" href="${isHome?'#pricing':'/#pricing'}">Pricing</a>
        <a class="desk" href="/comparison"${isCompare?' aria-current="page"':''}>Compare</a>
        <a class="desk" href="/resources"${isResources?' aria-current="page"':''}>Resources</a>
        <a class="btn btn-primary btn-sm nav-cta" href="/book">Book a call →</a>
      </nav>
    </div>
    <div class="ticker" aria-label="Key stats">
      <div class="ticker-track">
        <span class="ticker-item"><span class="dot"></span>Save 40+ hours per week</span>
        <span class="ticker-item"><span class="dot"></span>30-day go-live guarantee</span>
        <span class="ticker-item"><span class="dot"></span>3× faster lead response time</span>
        <span class="ticker-item"><span class="dot"></span>Avg. $12,000+ / mo saved vs. staffing</span>
        <span class="ticker-item"><span class="dot"></span>5× avg. ROI in year 1</span>
        <span class="ticker-item"><span class="dot"></span>24/7 AI coverage — no sick days</span>
        <span class="ticker-item"><span class="dot"></span>Save 40+ hours per week</span>
        <span class="ticker-item"><span class="dot"></span>30-day go-live guarantee</span>
        <span class="ticker-item"><span class="dot"></span>3× faster lead response time</span>
        <span class="ticker-item"><span class="dot"></span>Avg. $12,000+ / mo saved vs. staffing</span>
        <span class="ticker-item"><span class="dot"></span>5× avg. ROI in year 1</span>
        <span class="ticker-item"><span class="dot"></span>24/7 AI coverage — no sick days</span>
      </div>
    </div>
  </header>`;
  const footerHTML = `
  <footer class="foot">
    <div class="container">
      <div class="foot-inner">
        <div class="foot-left"><img src="/logo.png" alt=""/><div><div class="name">Ramped AI</div><div class="tag">AI implementation for operating businesses.</div></div></div>
        <nav class="foot-nav" aria-label="Footer">
          <a href="/#how-it-works">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/about">About</a>
          <a href="/comparison">Compare</a>
          <a href="/resources">Resources</a>
          <a href="/agent-library">Agent library</a>
          <a href="/book">Book a call</a>
          <a href="/free-roadmap">Free roadmap</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </div>
      <div class="foot-bottom">
        <span>© 2026 Ramped AI. All rights reserved.</span>
        <a href="mailto:jon@30dayramp.com">jon@30dayramp.com</a>
      </div>
    </div>
  </footer>`;
  // Final-CTA block (used by closing-section pages)
  window.RAMPED_FINAL_CTA = `
  <section class="section" style="padding-bottom:120px">
    <div class="container">
      <div class="cta-card">
        <span class="kicker" style="display:inline-block;margin-bottom:14px">30-DAY GUARANTEE · OR YOUR MONEY BACK</span>
        <h2>Ready to ramp <span class="accent">your AI department?</span></h2>
        <p>30-minute call. We'll map your highest-leverage automation, scope a deployment plan, and show you the exact ROI math — free, no commitment.</p>
        <div class="cta-row">
          <a class="btn btn-primary btn-large" href="/book">Book a discovery call →</a>
          <a class="btn btn-ghost btn-large" href="/free-roadmap">Get your free roadmap</a>
        </div>
        <div class="cta-trust"><span>Free · No commitment</span><span>30 minutes</span><span>Live in 30 days, or refund</span></div>
      </div>
    </div>
  </section>`;
  document.addEventListener("DOMContentLoaded",()=>{
    const hslot=document.getElementById("ramped-header");if(hslot)hslot.outerHTML=headerHTML;
    const fslot=document.getElementById("ramped-footer");if(fslot)fslot.outerHTML=footerHTML;
    const cslot=document.getElementById("ramped-final-cta");if(cslot)cslot.outerHTML=window.RAMPED_FINAL_CTA;
  });
})();
