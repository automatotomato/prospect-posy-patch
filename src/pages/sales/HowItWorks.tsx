import { Check, Clock, Search, Send, Settings as SettingsIcon, Sparkles } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    { title: "1. Discover Leads", icon: <Search className="w-5 h-5" />, body: "Use the AI Discovery engine to find operations-heavy businesses in your target city — manufacturing, warehouses, logistics, 3PLs, distribution centers, and freight brokers. The system pulls business names, websites, emails, and phone numbers so you don't have to hunt manually." },
    { title: "2. Generate Personalized Outreach", icon: <Sparkles className="w-5 h-5" />, body: "For each lead, click 'Generate' to draft a personalized cold email. The AI writes from Z & C Consultants' perspective — referencing the prospect's city, industry, and common pain points like spreadsheet reporting, manual data pulls, and lack of real-time dashboards." },
    { title: "3. Copy & Send", icon: <Send className="w-5 h-5" />, body: "Copy the drafted email and paste it into your email client (or send directly if connected). When you mark a lead as 'Contacted,' the follow-up sequence begins automatically." },
    { title: "4. Automated Follow-Up Sequence", icon: <Clock className="w-5 h-5" />, body: "A 6-step email sequence runs on autopilot. Each message hits a different pain point — from spreadsheet headaches to inventory visibility to automation ROI. The timing is spaced (Day 0, 4, 8, 12, 16, 20) so you stay persistent without being pushy." },
    { title: "5. Track Replies & Engagement", icon: <Check className="w-5 h-5" />, body: "When a prospect replies, their status automatically moves to 'Replied' and follow-ups pause. You can see reply intent (hot lead vs. not interested) and pick up the conversation from there. If they book a call, move them to 'Won'." },
    { title: "6. Customize in Settings", icon: <SettingsIcon className="w-5 h-5" />, body: "Head to Settings > Messaging to fine-tune every follow-up email, change the delay between touches, add new steps, or reset to defaults. You can also adjust your target vertical and city there." },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold mb-2">How the Follow-Up System Works</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Z & C Consultants uses an AI-powered outreach engine to discover, contact, and nurture leads on autopilot. Here's the full flow from discovery to close.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary">{s.icon}<span className="text-sm font-semibold">{s.title}</span></div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">What We Sell</div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Power BI dashboards & reporting</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Data pipeline automation</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Process automation for ops-heavy shops</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>WMS / ERP integration (NetSuite, SAP, Fishbowl, Cin7)</li>
          </ul>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Target Verticals</div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Manufacturing</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Warehouse & Distribution</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Logistics & 3PL</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Freight Brokerage</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Wholesale Suppliers</li>
          </ul>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Follow-Up Rules</div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Stops if prospect replies</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Stops if marked Do-Not-Contact</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Stops if marked Won or Lost</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Each angle is different — no repeats</li>
            <li className="flex items-start gap-2"><span className="text-primary mt-0.5">●</span>Editable in Settings anytime</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
