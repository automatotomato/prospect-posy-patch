import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { STAGES } from "@/hooks/useSalesLeads";
import { useSales, STAGE_META, KanbanLeadCard, StatusFilter, OriginTypeFilter } from "./_shared";

export default function Pipeline() {
  const {
    filteredLeads: leads, setOpenLead, statusFilter, setStatusFilter,
    originFilter, setOriginFilter, typeFilter, setTypeFilter,
  } = useSales();
  const [mobileStage, setMobileStage] = useState<string | null>("new");

  return (
    <>
      <div className="pb-2 space-y-2">
        <OriginTypeFilter origin={originFilter} setOrigin={setOriginFilter} type={typeFilter} setType={setTypeFilter} />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Desktop kanban */}
      <div className="hidden md:flex gap-4 overflow-x-auto scrollbar-thin pb-4 -mx-2 px-2">
        {STAGES.map((s) => {
          const items = leads.filter((l) => l.stage === s.id);
          const meta = STAGE_META[s.id];
          return (
            <div key={s.id} className="min-w-[260px] w-[260px] shrink-0 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`stage-dot ${meta?.dot}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded">
                  {items.length.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.map((l) => <KanbanLeadCard key={l.id} lead={l} onClick={() => setOpenLead(l)} />)}
                {items.length === 0 && (
                  <div className="h-24 flex items-center justify-center border border-dashed border-border rounded-xl text-[10px] text-muted-foreground">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile collapsible */}
      <div className="md:hidden space-y-2">
        {STAGES.map((s) => {
          const items = leads.filter((l) => l.stage === s.id);
          const meta = STAGE_META[s.id];
          const isOpen = mobileStage === s.id;
          return (
            <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setMobileStage(isOpen ? null : s.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`stage-dot ${meta?.dot}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    {items.length.toString().padStart(2, "0")}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </div>
              </button>
              {isOpen && (
                <div className="p-3 pt-0 space-y-2 border-t border-border">
                  {items.length === 0 ? (
                    <div className="h-16 flex items-center justify-center text-[11px] text-muted-foreground">No leads in this stage</div>
                  ) : items.map((l) => <KanbanLeadCard key={l.id} lead={l} onClick={() => setOpenLead(l)} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
