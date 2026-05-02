/* Reusable presentational pieces for the chat demo. */

const INTEGRATION_META = {
  hubspot:    { label: "HubSpot",    abbr: "H",  bg: "#ff7a59" },
  clearbit:   { label: "Clearbit",   abbr: "C",  bg: "#3b82f6" },
  calendar:   { label: "Calendar",   abbr: "📅", bg: "#22c55e" },
  slack:      { label: "Slack",      abbr: "#",  bg: "#a855f7" },
  netsuite:   { label: "NetSuite",   abbr: "N",  bg: "#f59e0b" },
  quickbooks: { label: "QuickBooks", abbr: "Q",  bg: "#10b981" },
  gong:       { label: "Gong",       abbr: "G",  bg: "#ef4444" }
};

function IntegrationPill({ id, live }) {
  const meta = INTEGRATION_META[id];
  if (!meta) return null;
  return (
    <span className={"integration-pill" + (live ? " live" : "")}>
      <span className="ipdot"></span>
      <span className="ico" style={{ background: meta.bg }}>{meta.abbr}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function MsgRow({ who, name, time, tag, children }) {
  const isBot = who === "bot";
  return (
    <div className={"msg " + who}>
      <div className="av">
        {isBot ? <img src={window.__resources.logo} alt="Ramped Bot" /> : "U"}
      </div>
      <div className="body">
        <div className="head">
          <span className={"name" + (isBot ? " bot" : "")}>{name}</span>
          {tag && <span className="tag">{tag}</span>}
          <span className="time">{time}</span>
        </div>
        <div className="text">{children}</div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg bot">
      <div className="av"><img src={window.__resources.logo} alt="Ramped Bot" /></div>
      <div className="body">
        <div className="head">
          <span className="name bot">Ramped Bot</span>
          <span className="tag">AI</span>
          <span className="time">typing…</span>
        </div>
        <div className="text">
          <div className="typing"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
  );
}

function ProcessCard({ steps, currentStep, progress }) {
  return (
    <div className="process-card">
      {steps.map((s, i) => {
        let cls = "process-step";
        if (i < currentStep) cls += " done";
        else if (i === currentStep) cls += " active";
        return (
          <div key={i} className={cls}>
            <span className="ind"></span>
            <span>{s.label}</span>
            {i < currentStep && <span className="meta">✓ {(s.ms/1000).toFixed(1)}s</span>}
          </div>
        );
      })}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: progress + "%" }}></div>
      </div>
    </div>
  );
}

function IntegrationsRow({ ids, liveSet }) {
  return (
    <div className="integrations">
      {ids.map(id => (
        <IntegrationPill key={id} id={id} live={liveSet.has(id)} />
      ))}
    </div>
  );
}

function SuccessCard({ data, html }) {
  return (
    <div className="success-card">
      <div className="head-row">
        <div className="check-circle"></div>
        <div className="title">{data.successTitle}</div>
      </div>
      <div className="success-metrics">
        {data.successMetrics.map((m, i) => (
          <div className="success-metric" key={i}>
            <div className="l">{m.l}</div>
            <div className={"v " + (m.color || "")}>{m.v}</div>
          </div>
        ))}
      </div>
      {data.aha && (
        <div className="aha">
          <span className="spark">✦</span>
          <span><strong style={{color: "var(--orange-2)"}}>Agent learned from your data —</strong> {data.aha}</span>
        </div>
      )}
      {html && (
        <div style={{marginTop: 12, fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.55}}
             dangerouslySetInnerHTML={{__html: html}}>
        </div>
      )}
    </div>
  );
}

function fireConfetti(host) {
  if (!host) return;
  const colors = ["#3b82f6", "#fb923c", "#34d399", "#60a5fa", "#fdba74", "#a78bfa"];
  const layer = document.createElement("div");
  layer.className = "confetti";
  host.appendChild(layer);
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty("--d", (1.6 + Math.random() * 1.6) + "s");
    piece.style.animationDelay = (Math.random() * 0.4) + "s";
    piece.style.transform = `rotate(${Math.random()*360}deg)`;
    layer.appendChild(piece);
  }
  setTimeout(() => layer.remove(), 4500);
}

Object.assign(window, {
  IntegrationPill, MsgRow, TypingBubble, ProcessCard,
  IntegrationsRow, SuccessCard, fireConfetti, INTEGRATION_META
});
