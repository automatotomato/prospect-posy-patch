import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown } from 'lucide-react';
import { Prospect, ProspectStatus, TeamMember } from '@/types/prospect';
import { KanbanCard } from '@/components/KanbanCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: ProspectStatus;
  prospects: Prospect[];
  teamMembers: TeamMember[];
  onProspectClick: (id: string) => void;
  onProspectUpdate?: (prospectId: string, updates: Partial<Prospect>) => void;
  isMobile?: boolean;
}

const statusConfig: Record<ProspectStatus, { label: string; color: string; bgColor: string; dot: string }> = {
  new: {
    label: 'New',
    color: 'text-status-new',
    bgColor: 'bg-[hsl(var(--status-new)/0.08)]',
    dot: 'bg-[hsl(var(--status-new))]',
  },
  called: {
    label: 'Called',
    color: 'text-status-contacted',
    bgColor: 'bg-[hsl(var(--status-contacted)/0.08)]',
    dot: 'bg-[hsl(var(--status-contacted))]',
  },
  contacted: {
    label: 'Contacted',
    color: 'text-status-contacted',
    bgColor: 'bg-[hsl(var(--status-contacted)/0.08)]',
    dot: 'bg-[hsl(var(--status-contacted))]',
  },
  responded: {
    label: 'Responded',
    color: 'text-status-responded',
    bgColor: 'bg-[hsl(var(--status-responded)/0.08)]',
    dot: 'bg-[hsl(var(--status-responded))]',
  },
  qualified: {
    label: 'Qualified',
    color: 'text-status-qualified',
    bgColor: 'bg-[hsl(var(--status-qualified)/0.08)]',
    dot: 'bg-[hsl(var(--status-qualified))]',
  },
  quoted: {
    label: 'Quoted',
    color: 'text-status-quoted',
    bgColor: 'bg-[hsl(var(--status-quoted)/0.08)]',
    dot: 'bg-[hsl(var(--status-quoted))]',
  },
  closed: {
    label: 'Closed Won',
    color: 'text-status-closed',
    bgColor: 'bg-[hsl(var(--status-closed)/0.08)]',
    dot: 'bg-[hsl(var(--status-closed))]',
  },
};

export function KanbanColumn({ status, prospects, teamMembers, onProspectClick, onProspectUpdate, isMobile }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = statusConfig[status];
  const prospectIds = prospects.map(p => p.id);
  const [collapsed, setCollapsed] = useState(false);

  if (isMobile) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
        {/* Mobile header — tappable to collapse */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 transition-colors",
            config.bgColor,
            "active:opacity-80"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn("w-2 h-2 rounded-full", config.dot)} />
            <span className={cn("font-display font-semibold text-sm tracking-tight", config.color)}>
              {config.label}
            </span>
            <span className={cn(
              "text-[11px] font-medium px-2 py-0.5 rounded-full bg-background/70 border border-border/40",
              config.color
            )}>
              {prospects.length}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </button>

        {/* Body */}
        {!collapsed && (
          <div
            ref={setNodeRef}
            className={cn(
              "p-2.5 space-y-2 transition-colors",
              isOver && "bg-primary/5"
            )}
          >
            <SortableContext items={prospectIds} strategy={verticalListSortingStrategy}>
              {prospects.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-xs text-muted-foreground italic">
                  No prospects
                </div>
              ) : (
                prospects.map((prospect) => (
                  <KanbanCard
                    key={prospect.id}
                    prospect={prospect}
                    teamMembers={teamMembers}
                    onClick={() => onProspectClick(prospect.id)}
                    onUpdate={onProspectUpdate ? (updates) => onProspectUpdate(prospect.id, updates) : undefined}
                  />
                ))
              )}
            </SortableContext>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div className="flex flex-col w-full min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 border-border/60",
        config.bgColor
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", config.dot)} />
          <span className={cn("font-display font-semibold text-sm", config.color)}>
            {config.label}
          </span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full bg-background/80",
            config.color
          )}>
            {prospects.length}
          </span>
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 rounded-b-lg border border-border/60 bg-muted/20 transition-colors min-h-[200px] overflow-y-auto",
          isOver && "bg-primary/5 border-primary/30"
        )}
      >
        <SortableContext items={prospectIds} strategy={verticalListSortingStrategy}>
          {prospects.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              Drop prospects here
            </div>
          ) : (
            prospects.map((prospect) => (
              <KanbanCard
                key={prospect.id}
                prospect={prospect}
                teamMembers={teamMembers}
                onClick={() => onProspectClick(prospect.id)}
                onUpdate={onProspectUpdate ? (updates) => onProspectUpdate(prospect.id, updates) : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
