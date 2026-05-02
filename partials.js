/* Shared masthead + footer renderer for Ramped AI site */
(function(){
  const path = location.pathname.split("/").pop() || "index.html";
  const isHome = path==="index.html"||path==="";
  const headerHTML = `
  <header class="mast" role="banner">
    <div class="mast-bar">
      <a href="index.html" class="brand"><img src="logo.png" alt=""/><span class="brand-name">Ramped AI</span></a>
      <nav class="nav" aria-label="Primary">
        <a class="desk" href="about.html"${path==="about.html"?' aria-current="page"':''}>About</a>
        <a class="desk" href="${isHome?'#pricing':'index.html#pricing'}">Pricing</a>
        <a class="desk" href="comparison.html"${path==="comparison.html"?' aria-current="page"':''}>Compare</a>
        <a class="desk" href="resources.html"${path==="resources.html"?' aria-current="page"':''}>Resources</a>
        <a class="btn btn-primary btn-sm nav-cta" href="book.html">Book a call →</a>
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
        <div class="foot-left"><img src="logo.png" alt=""/><div><div class="name">Ramped AI</div><div class="tag">AI implementation for operating businesses.</div></div></div>
        <nav class="foot-nav" aria-label="Footer">
          <a href="index.html#how-it-works">How it works</a>
          <a href="index.html#pricing">Pricing</a>
          <a href="about.html">About</a>
          <a href="comparison.html">Compare</a>
          <a href="resources.html">Resources</a>
          <a href="agent-library.html">Agent library</a>
          <a href="book.html">Book a call</a>
          <a href="free-roadmap.html">Free roadmap</a>
          <a href="privacy.html">Privacy</a>
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
          <a class="btn btn-primary btn-large" href="book.html">Book a discovery call →</a>
          <a class="btn btn-ghost btn-large" href="free-roadmap.html">Get your free roadmap</a>
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
