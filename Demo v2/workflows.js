/* Workflow scripts for the Ramped AI bot demo.
   Each workflow has steps that the chat plays back in sequence. */

const WORKFLOWS = {
  lead: {
    id: "lead",
    title: "Handle inbound lead",
    subtitle: "HubSpot → Slack → Calendar",
    icon: "🎯",
    iconBg: "linear-gradient(135deg, #3b82f6, #60a5fa)",
    userPrompt: "New inbound lead just came in from the website demo form — Sara Chen, Director of Ops at Northwind Logistics. Run the inbound playbook.",
    intro: "On it. Pulling Sara's profile and Northwind's signal data now — give me a moment to enrich.",
    steps: [
      { label: "Enriching lead from Clearbit + LinkedIn", ms: 950, integrations: ["clearbit"] },
      { label: "Scoring fit against ICP model", ms: 800 },
      { label: "Looking up Northwind in HubSpot", ms: 700, integrations: ["hubspot"] },
      { label: "Drafting personalized outreach", ms: 1100 },
      { label: "Booking discovery slot in Calendar", ms: 800, integrations: ["calendar"] },
      { label: "Posting handoff to #sales-pod", ms: 600, integrations: ["slack"] }
    ],
    integrations: ["hubspot", "clearbit", "calendar", "slack"],
    successTitle: "Lead routed and meeting booked.",
    successMetrics: [
      { l: "Time to first touch", v: "47s", color: "accent" },
      { l: "Pipeline added", v: "$12,400", color: "green" },
      { l: "Fit score", v: "94 / 100" }
    ],
    aha: "Agent learned from your last 12 closed-won deals — Sara fits the profile of a 32-day cycle, so I queued a tighter follow-up cadence.",
    detail: "Sent a Loom recap to Sara, looped in <strong>@marcus</strong> as AE, and dropped the Northwind brief into the deal record. Next touch fires in 26 hours if no reply."
  },

  inventory: {
    id: "inventory",
    title: "Automate inventory",
    subtitle: "NetSuite reorder + SKU forecast",
    icon: "📦",
    iconBg: "linear-gradient(135deg, #fb923c, #fdba74)",
    userPrompt: "Run the weekly inventory pass. Flag anything tracking below safety stock and trigger reorders where the math works.",
    intro: "Pulling SKU velocity from NetSuite and cross-checking against the demand model. Running the reorder logic now.",
    steps: [
      { label: "Fetching 14,200 active SKUs from NetSuite", ms: 900, integrations: ["netsuite"] },
      { label: "Running 30-day demand forecast", ms: 1100 },
      { label: "Flagging SKUs below safety stock", ms: 700 },
      { label: "Validating supplier lead times", ms: 800 },
      { label: "Generating purchase orders", ms: 950, integrations: ["netsuite"] },
      { label: "Notifying ops in #inventory-alerts", ms: 600, integrations: ["slack"] }
    ],
    integrations: ["netsuite", "slack"],
    successTitle: "62 SKUs reordered, 3 flagged for review.",
    successMetrics: [
      { l: "POs generated", v: "62", color: "accent" },
      { l: "Stockouts prevented", v: "$84,200", color: "green" },
      { l: "Hours saved", v: "11h" }
    ],
    aha: "Three SKUs hit a seasonality spike I haven't seen before — paused those for a human review instead of auto-firing.",
    detail: "POs sit in <code>Pending Approval</code> in NetSuite. The 3 flagged items are in <strong>#inventory-alerts</strong> with my reasoning attached."
  },

  finance: {
    id: "finance",
    title: "Process finance report",
    subtitle: "QuickBooks → variance memo",
    icon: "📊",
    iconBg: "linear-gradient(135deg, #a78bfa, #60a5fa)",
    userPrompt: "Close Q3 — pull the actuals from QuickBooks, compare to plan, and draft the variance memo for Friday's board prep.",
    intro: "Closing Q3 now. Reconciling actuals, building the variance walk, and drafting the memo with footnotes.",
    steps: [
      { label: "Reconciling 1,847 transactions in QuickBooks", ms: 1100, integrations: ["quickbooks"] },
      { label: "Mapping to plan categories", ms: 850 },
      { label: "Computing line-item variances", ms: 700 },
      { label: "Drafting executive variance memo", ms: 1100 },
      { label: "Generating board-ready charts", ms: 800 },
      { label: "Sharing draft with #finance-leads", ms: 500, integrations: ["slack"] }
    ],
    integrations: ["quickbooks", "slack"],
    successTitle: "Q3 close packet ready for review.",
    successMetrics: [
      { l: "Variance vs plan", v: "+4.2%", color: "green" },
      { l: "Memo turnaround", v: "9 min", color: "accent" },
      { l: "Manual hours saved", v: "14h" }
    ],
    aha: "Spotted a recurring duplicate from one vendor across June and July — I held those out and flagged for AP review before they hit the memo.",
    detail: "Memo and charts are in <strong>#finance-leads</strong>. Two notes added for the CFO: <strong>OpEx</strong> ran hot on cloud spend, and <strong>headcount</strong> came in under by $86k."
  },

  sales: {
    id: "sales",
    title: "Qualify sales call",
    subtitle: "Gong recap + MEDDIC scoring",
    icon: "📞",
    iconBg: "linear-gradient(135deg, #34d399, #60a5fa)",
    userPrompt: "Discovery call with Acme Robotics just wrapped — process the recording, score the deal, and update the pipeline.",
    intro: "Got the recording. Pulling the transcript, scoring against MEDDIC, and updating HubSpot. Should take under a minute.",
    steps: [
      { label: "Transcribing 38-min call from Gong", ms: 1100, integrations: ["gong"] },
      { label: "Extracting champion + decision criteria", ms: 900 },
      { label: "Scoring against MEDDIC framework", ms: 750 },
      { label: "Updating deal record in HubSpot", ms: 700, integrations: ["hubspot"] },
      { label: "Drafting follow-up email + summary", ms: 950 },
      { label: "Posting recap to #deal-room", ms: 500, integrations: ["slack"] }
    ],
    integrations: ["gong", "hubspot", "slack"],
    successTitle: "Acme Robotics qualified — moved to Stage 3.",
    successMetrics: [
      { l: "MEDDIC score", v: "78%", color: "accent" },
      { l: "Deal size", v: "$148k", color: "green" },
      { l: "Close confidence", v: "High" }
    ],
    aha: "Their CTO mentioned a 6-week procurement freeze — I flagged the timeline and pre-built a phased rollout option for your follow-up.",
    detail: "Updated <strong>Acme Robotics — Pilot</strong> in HubSpot. Follow-up email is in your drafts. Two flags: budget signed-off, but legal review may add 2 weeks."
  }
};

window.WORKFLOWS = WORKFLOWS;
