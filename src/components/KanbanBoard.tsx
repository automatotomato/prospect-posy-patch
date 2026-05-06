import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Prospect, ProspectStatus, TeamMember } from '@/types/prospect';
import { KanbanColumn } from '@/components/KanbanColumn';
import { KanbanCard } from '@/components/KanbanCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

interface KanbanBoardProps {
  prospects: Prospect[];
  teamMembers: TeamMember[];
  onStatusChange: (prospectId: string, newStatus: ProspectStatus) => void;
  onProspectClick: (id: string) => void;
  onProspectUpdate?: (prospectId: string, updates: Partial<Prospect>) => void;
}

const STATUSES: ProspectStatus[] = ['new', 'called', 'responded', 'qualified', 'quoted', 'closed'];

export function KanbanBoard({ prospects, teamMembers, onStatusChange, onProspectClick, onProspectUpdate }: KanbanBoardProps) {
  const [activeProspect, setActiveProspect] = useState<Prospect | null>(null);
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getProspectsByStatus = (status: ProspectStatus) => {
    return prospects.filter(p => p.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const prospect = prospects.find(p => p.id === event.active.id);
    if (prospect) {
      setActiveProspect(prospect);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProspect(null);

    const { active, over } = event;
    if (!over) return;

    const prospectId = active.id as string;
    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return;

    // Check if dropped on a column
    const targetStatus = over.id as ProspectStatus;
    if (STATUSES.includes(targetStatus) && targetStatus !== prospect.status) {
      onStatusChange(prospectId, targetStatus);
      return;
    }

    // Check if dropped on another card - use that card's status
    const targetProspect = prospects.find(p => p.id === over.id);
    if (targetProspect && targetProspect.status !== prospect.status) {
      onStatusChange(prospectId, targetProspect.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {isMobile ? (
        // Mobile: Vertical stacked layout
        <div className="flex flex-col gap-4 p-1">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              prospects={getProspectsByStatus(status)}
              teamMembers={teamMembers}
              onProspectClick={onProspectClick}
              onProspectUpdate={onProspectUpdate}
              isMobile={true}
            />
          ))}
        </div>
      ) : (
        // Desktop: Horizontal scroll layout
        <ScrollArea className="w-full pb-4">
          <div className="flex gap-4 p-1 min-w-max">
            {STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                prospects={getProspectsByStatus(status)}
                teamMembers={teamMembers}
                onProspectClick={onProspectClick}
                onProspectUpdate={onProspectUpdate}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <DragOverlay>
        {activeProspect && (
          <div className="w-[280px]">
            <KanbanCard
              prospect={activeProspect}
              teamMembers={teamMembers}
              onClick={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
