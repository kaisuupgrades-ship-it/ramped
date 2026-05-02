/* Chat demo — runs the workflow scripts. */

const { useState, useEffect, useRef, useCallback } = React;

function nowStamp(offsetSec = 0) {
  const d = new Date(Date.now() + offsetSec * 1000);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function ChatDemo() {
  const [items, setItems] = useState(() => initialMessages());
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const streamRef = useRef(null);
  const shellRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (streamRef.current) {
        streamRef.current.scrollTop = streamRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(scrollToBottom, [items, scrollToBottom]);

  const wait = (ms) => new Promise(r => setTimeout(r, ms / (window.__rampedSpeed || 1)));

  async function runWorkflow(wfId) {
    if (running) return;
    const wf = window.WORKFLOWS[wfId];
    if (!wf) return;
    setRunning(true);

    // 1. user message
    const userMsg = {
      kind: "msg", who: "user", name: "You", time: nowStamp(),
      content: wf.userPrompt
    };
    setItems(arr => [...arr, userMsg]);
    await wait(450);

    // 2. typing indicator
    const typingId = "typing-" + Date.now();
    setItems(arr => [...arr, { kind: "typing", id: typingId }]);
    await wait(900);

    // 3. bot intro
    setItems(arr => arr.filter(x => x.id !== typingId));
    setItems(arr => [...arr, {
      kind: "msg", who: "bot", name: "Ramped Bot", tag: "AI", time: nowStamp(),
      content: wf.intro
    }]);
    await wait(400);

    // 4. process card — animated through steps
    const totalMs = wf.steps.reduce((s, x) => s + x.ms, 0);
    const integrationsId = "ints-" + Date.now();
    const processId = "proc-" + Date.now();
    setItems(arr => [...arr, {
      kind: "process",
      id: processId,
      steps: wf.steps,
      currentStep: 0,
      progress: 0
    }, {
      kind: "integrations",
      id: integrationsId,
      ids: wf.integrations,
      live: new Set()
    }]);

    let elapsed = 0;
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      const stepMs = step.ms / (window.__rampedSpeed || 1);
      // mark active
      setItems(arr => arr.map(x =>
        x.id === processId ? { ...x, currentStep: i } : x
      ));
      // light up integrations associated with this step
      if (step.integrations && step.integrations.length) {
        setItems(arr => arr.map(x => {
          if (x.id !== integrationsId) return x;
          const next = new Set(x.live);
          step.integrations.forEach(id => next.add(id));
          return { ...x, live: next };
        }));
      }
      // animate progress smoothly while step runs
      const startElapsed = elapsed;
      const stepStart = performance.now();
      await new Promise(resolve => {
        const tick = () => {
          const t = performance.now() - stepStart;
          const pct = Math.min(100, ((startElapsed + Math.min(t, stepMs)) / (totalMs / (window.__rampedSpeed || 1))) * 100);
          setItems(arr => arr.map(x =>
            x.id === processId ? { ...x, progress: pct } : x
          ));
          if (t >= stepMs) resolve();
          else requestAnimationFrame(tick);
        };
        tick();
      });
      elapsed += stepMs;
      // mark step done
      setItems(arr => arr.map(x =>
        x.id === processId ? { ...x, currentStep: i + 1 } : x
      ));
      scrollToBottom();
    }

    await wait(350);

    // 5. success card + confetti
    setItems(arr => [...arr, {
      kind: "success", data: wf, html: wf.detail
    }]);
    if (shellRef.current && window.__rampedConfetti !== false) window.fireConfetti(shellRef.current);
    await wait(400);

    // 6. branch buttons
    setItems(arr => [...arr, { kind: "branches", wfId }]);

    setCompleted(n => n + 1);
    setRunning(false);
  }

  function handleBranch(action, wfId) {
    if (running) return;
    if (action === "another") {
      // scroll to the workflow picker by re-adding it
      setItems(arr => [...arr.filter(x => x.kind !== "branches"), {
        kind: "msg", who: "user", name: "You", time: nowStamp(),
        content: "Run another playbook."
      }, { kind: "picker" }]);
    } else if (action === "refine") {
      const wf = window.WORKFLOWS[wfId];
      setItems(arr => [...arr.filter(x => x.kind !== "branches"), {
        kind: "msg", who: "user", name: "You", time: nowStamp(),
        content: "Adjust the output — tighter tone and add a specific next step."
      }]);
      setRunning(true);
      setTimeout(() => {
        setItems(arr => [...arr, {
          kind: "typing", id: "tp-" + Date.now()
        }]);
        setTimeout(() => {
          setItems(arr => arr.filter(x => x.kind !== "typing").concat([{
            kind: "msg", who: "bot", name: "Ramped Bot", tag: "AI", time: nowStamp(),
            content: <span>Got it — re-drafted with a tighter tone and added <code>schedule a 15-min sync</code> as the explicit next step. Updated record in place. <strong style={{color:"var(--orange-2)"}}>I'll remember that preference</strong> for future {wf.title.toLowerCase()} runs.</span>
          }, { kind: "branches", wfId }]));
          setRunning(false);
        }, 1100);
      }, 400);
    } else if (action === "book") {
      window.dispatchEvent(new CustomEvent("ramped:book"));
    }
  }

  return (
    <div className="demo-shell" ref={shellRef}>
      <div className="demo-toolbar">
        <div className="window-dots"><span></span><span></span><span></span></div>
        <div className="url">workspace.ramped.ai / agents / ramped-bot</div>
        <div style={{width: 60}}></div>
      </div>

      <aside className="sidebar">
        <div className="sidebar-team">
          <div className="badge">N</div>
          <div>
            <div className="name">Northwind</div>
            <div className="meta">12 agents online</div>
          </div>
        </div>
        <div className="sidebar-group">
          <div className="sidebar-label">Channels</div>
          <div className="channel"><span className="hash">#</span> general</div>
          <div className="channel"><span className="hash">#</span> sales-pod</div>
          <div className="channel"><span className="hash">#</span> deal-room</div>
          <div className="channel"><span className="hash">#</span> finance-leads</div>
          <div className="channel"><span className="hash">#</span> inventory-alerts</div>
        </div>
        <div className="sidebar-group">
          <div className="sidebar-label">AI Agents</div>
          <div className="channel active">
            <span className="agent-dot"></span> Ramped Bot
            <span className="pill">LIVE</span>
          </div>
          <div className="channel"><span className="agent-dot" style={{background:"#fb923c", boxShadow:"0 0 0 3px rgba(251,146,60,0.2)"}}></span> Ops Agent</div>
          <div className="channel"><span className="agent-dot" style={{background:"#a78bfa", boxShadow:"0 0 0 3px rgba(167,139,250,0.2)"}}></span> Finance Agent</div>
        </div>
        <div style={{marginTop:"auto", padding:"10px", borderRadius:10, background:"var(--bg-2)", border:"1px solid var(--line)"}}>
          <div style={{fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:600}}>Day</div>
          <div style={{fontSize:24, fontWeight:700, letterSpacing:"-0.02em", marginTop:4}}>30 / 30</div>
          <div style={{fontSize:12, color:"var(--green)", marginTop:2}}>● Deployment complete</div>
        </div>
      </aside>

      <section className="chat">
        <header className="chat-header">
          <div className="avatar"><img src={window.__resources.logo} alt="Ramped Bot" /></div>
          <div>
            <div className="title">Ramped Bot</div>
            <div className="subtitle">Your AI department · trained on Northwind data</div>
          </div>
          <div className="actions">
            <span className="chip">● Live in production</span>
          </div>
        </header>

        <div className="chat-stream" ref={streamRef}>
          {items.map((it, i) => renderItem(it, i, runWorkflow, handleBranch, running))}
        </div>

        <div className="composer">
          <div className="composer-input">
            <span style={{color:"var(--text-3)"}}>＋</span>
            <input placeholder={running ? "Agent is working…" : "Ask Ramped Bot anything, or pick a playbook above…"} disabled />
            <button className="btn btn-primary btn-sm" disabled style={{opacity:0.6}}>Send</button>
          </div>
          <div className="composer-hint">
            <span>Connected to <strong style={{color:"var(--text-1)"}}>HubSpot</strong>, <strong style={{color:"var(--text-1)"}}>NetSuite</strong>, <strong style={{color:"var(--text-1)"}}>QuickBooks</strong>, <strong style={{color:"var(--text-1)"}}>Gong</strong>, <strong style={{color:"var(--text-1)"}}>Slack</strong></span>
            <span><span className="kbd">⌘</span> <span className="kbd">K</span> commands</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function initialMessages() {
  return [
    {
      kind: "msg", who: "bot", name: "Ramped Bot", tag: "AI", time: "9:14 AM",
      content: <span>Morning — I've been live for <strong>30 days</strong>. I've trained on your Northwind data, mapped your tools, and I'm ready to run real work. <strong>Pick a playbook</strong> and I'll execute it end-to-end.</span>
    },
    { kind: "picker" }
  ];
}

function renderItem(it, key, runWorkflow, handleBranch, running) {
  switch (it.kind) {
    case "msg":
      return (
        <MsgRow key={key} who={it.who} name={it.name} tag={it.tag} time={it.time}>
          {it.content}
        </MsgRow>
      );
    case "typing":
      return <TypingBubble key={key} />;
    case "process":
      return (
        <div key={key} className="msg bot" style={{paddingLeft: 48, gridTemplateColumns: "1fr"}}>
          <div className="body" style={{gridColumn: "1 / -1"}}>
            <ProcessCard steps={it.steps} currentStep={it.currentStep} progress={it.progress} />
          </div>
        </div>
      );
    case "integrations":
      return (
        <div key={key} style={{paddingLeft: 48}}>
          <IntegrationsRow ids={it.ids} liveSet={it.live} />
        </div>
      );
    case "success":
      return (
        <div key={key} className="msg bot">
          <div className="av">R</div>
          <div className="body">
            <SuccessCard data={it.data} html={it.html} />
          </div>
        </div>
      );
    case "branches":
      return (
        <div key={key} className="branch-wrap">
          <div className="branch-row">
            <button className="branch-btn primary" onClick={() => handleBranch("book")}>📅 Book a discovery call</button>
            <button className="branch-btn" onClick={() => handleBranch("another", it.wfId)} disabled={running}>↻ Run another playbook</button>
            <button className="branch-btn" onClick={() => handleBranch("refine", it.wfId)} disabled={running}>✎ Refine output</button>
          </div>
        </div>
      );
    case "picker":
      return (
        <div key={key} style={{paddingLeft: 48}}>
          <div className="workflow-grid">
            {Object.values(window.WORKFLOWS).map(wf => (
              <button key={wf.id} className="workflow-btn" disabled={running} onClick={() => runWorkflow(wf.id)}>
                <span className="icon" style={{background: wf.iconBg}}>{wf.icon}</span>
                <span className="label-wrap">
                  <span className="l">{wf.title}</span>
                  <span className="s">{wf.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

window.ChatDemo = ChatDemo;
