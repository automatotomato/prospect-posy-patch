import { Prospect, TeamMember, ProspectStatus } from '@/types/prospect';
import { ProspectDetail } from './ProspectDetail';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface MobileProspectSheetProps {
  prospect: Prospect | null;
  teamMembers: TeamMember[];
  onClose: () => void;
  onStatusChange: (status: ProspectStatus) => void;
  onToggleQuoting: () => void;
  onTaskComplete: (taskId: string) => void;
  onUpdate: (updates: Partial<Prospect>) => void;
  onDelete?: () => void;
}

export function MobileProspectSheet({
  prospect,
  teamMembers,
  onClose,
  onStatusChange,
  onToggleQuoting,
  onTaskComplete,
  onUpdate,
  onDelete,
}: MobileProspectSheetProps) {
  if (!prospect) return null;

  return (
    <Sheet open={!!prospect} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-2xl">
        <div className="h-full overflow-hidden">
          <ProspectDetail
            prospect={prospect}
            teamMembers={teamMembers}
            onClose={onClose}
            onStatusChange={onStatusChange}
            onToggleQuoting={onToggleQuoting}
            onTaskComplete={onTaskComplete}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}