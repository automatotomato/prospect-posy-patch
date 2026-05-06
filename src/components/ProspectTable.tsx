import { Prospect, TeamMember, ProspectStatus } from '@/types/prospect';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from './StatusBadge';
import { SourceBadge } from './SourceBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mail, MoreHorizontal, ArrowRight, Trash2, Phone, MapPin, Calendar, Eye, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

export interface ActivitySummary {
  lastActivityDate: Date | null;
  lastActivityType: 'email_sent' | 'call' | 'reply' | 'opened' | null;
  emailStatus: 'none' | 'sent' | 'opened' | 'replied';
  nextFollowUp: Date | null;
}

interface CallSummary {
  lastCallDate: string;
  lastOutcome: string;
  followUpDate: string | null;
  callCount: number;
}

interface ProspectTableProps {
  prospects: Prospect[];
  teamMembers: TeamMember[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onProspectClick: (id: string) => void;
  onStatusChange: (id: string, status: ProspectStatus) => void;
  onDelete: (id: string) => void;
  onAssign?: (id: string, assignedTo: string | null) => void;
  showCallColumns?: boolean;
  callSummaryMap?: Map<string, CallSummary>;
  activityMap?: Map<string, ActivitySummary>;
}

const INITIALS_MAP: Record<string, string> = {};
// Will be populated from teamMembers prop dynamically

const statusLabels: Record<ProspectStatus, string> = {
  new: 'New',
  called: 'Called',
  contacted: 'Contacted',
  responded: 'Responded',
  qualified: 'Qualified',
  quoted: 'Quoted',
  closed: 'Closed',
};

const emailStatusConfig = {
  none: { label: '—', className: 'text-muted-foreground/50' },
  sent: { label: 'Sent', className: 'text-muted-foreground' },
  opened: { label: 'Opened', className: 'text-status-contacted' },
  replied: { label: 'Replied', className: 'text-primary font-medium' },
};

const activityTypeLabels = {
  email_sent: 'Email sent',
  call: 'Called',
  reply: 'Reply received',
  opened: 'Email opened',
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}

export function ProspectTable({
  prospects,
  teamMembers,
  selectedIds,
  onSelectionChange,
  onProspectClick,
  onStatusChange,
  onDelete,
  onAssign,
  showCallColumns = false,
  callSummaryMap,
  activityMap,
}: ProspectTableProps) {
  const allSelected = prospects.length > 0 && selectedIds.length === prospects.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < prospects.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(prospects.map(p => p.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (prospects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No prospects found</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className={cn(
        "gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:grid",
        showCallColumns
          ? "grid-cols-[40px_1fr_60px_120px_100px_100px_120px_44px]"
          : "grid-cols-[40px_1fr_60px_100px_110px_100px_110px_44px]"
      )}>
        <div className="flex items-center">
          <Checkbox
            checked={allSelected}
            // @ts-ignore
            indeterminate={someSelected}
            onCheckedChange={toggleAll}
          />
        </div>
        <div>Business</div>
        <div>Owner</div>
        <div>Status</div>
        {showCallColumns ? (
          <>
            <div>Last Call</div>
            <div>Outcome</div>
            <div>Follow-Up</div>
          </>
        ) : (
          <>
            <div>Last Activity</div>
            <div>Email Status</div>
            <div>Next Step</div>
          </>
        )}
        <div></div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {prospects.map((prospect) => {
          const isChecked = selectedIds.includes(prospect.id);
          const callSummary = callSummaryMap?.get(prospect.id);
          const activity = activityMap?.get(prospect.id);
          const followUpDate = showCallColumns
            ? (callSummary?.followUpDate ? new Date(callSummary.followUpDate) : null)
            : (activity?.nextFollowUp || null);
          const isOverdue = followUpDate && followUpDate < new Date() && !isToday(followUpDate);
          const isFollowUpToday = followUpDate && isToday(followUpDate);
          const assignedMember = teamMembers.find(m => m.id === prospect.assignedTo);
          const assignedInitials = assignedMember ? getInitials(assignedMember.name) : null;

          const cycleAssignment = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!onAssign) return;
            // Cycle: unassigned -> first member -> second member -> unassigned
            const currentIdx = assignedMember ? teamMembers.findIndex(m => m.id === assignedMember.id) : -1;
            const nextIdx = currentIdx + 1;
            if (nextIdx >= teamMembers.length) {
              onAssign(prospect.id, null);
            } else {
              onAssign(prospect.id, teamMembers[nextIdx].id);
            }
          };

          return (
            <div
              key={prospect.id}
              className={cn(
                "grid grid-cols-1 gap-2 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer items-center",
                showCallColumns
                  ? "md:grid-cols-[40px_1fr_60px_120px_100px_100px_120px_44px]"
                  : "md:grid-cols-[40px_1fr_60px_100px_110px_100px_110px_44px]",
                isChecked && "bg-primary/5"
              )}
              onClick={() => onProspectClick(prospect.id)}
            >
              {/* Checkbox */}
              <div className="hidden md:flex items-center" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleOne(prospect.id)}
                />
              </div>

              {/* Business */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {/* Mobile checkbox */}
                  <div className="md:hidden" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(prospect.id)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{prospect.businessName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {prospect.email && <span className="truncate">{prospect.email}</span>}
                      {prospect.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{prospect.phone}</span>}
                    </div>
                  </div>
                  {/* Mobile status */}
                  <div className="md:hidden">
                    <StatusBadge status={prospect.status} />
                  </div>
                </div>
                {/* Mobile details */}
                <div className="md:hidden mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{prospect.location}</span>
                  <SourceBadge source={prospect.source} />
                  {assignedInitials && (
                    <button
                      onClick={cycleAssignment}
                      className="text-[10px] font-bold w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center"
                    >
                      {assignedInitials}
                    </button>
                  )}
                  {activity?.lastActivityDate && (
                    <span className="flex items-center gap-1">
                      {activity.lastActivityType === 'call' ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      {formatDistanceToNow(activity.lastActivityDate, { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>

              {/* Owner - desktop */}
              <div className="hidden md:flex items-center" onClick={e => e.stopPropagation()}>
                <button
                  onClick={cycleAssignment}
                  className={cn(
                    "text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    assignedInitials
                      ? "bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground/50 hover:bg-muted-foreground/10 hover:text-muted-foreground"
                  )}
                  title={assignedMember ? `Assigned to ${assignedMember.name}` : 'Unassigned — click to assign'}
                >
                  {assignedInitials || '—'}
                </button>
              </div>

              {/* Status - desktop */}
              <div className="hidden md:block">
                <StatusBadge status={prospect.status} />
              </div>

              {showCallColumns ? (
                <>
                  {/* Last Call */}
                  <div className="hidden md:block">
                    <p className="text-sm text-muted-foreground">
                      {callSummary ? format(new Date(callSummary.lastCallDate), 'MMM d') : '—'}
                    </p>
                    {callSummary && <p className="text-xs text-muted-foreground">{callSummary.callCount} call{callSummary.callCount !== 1 ? 's' : ''}</p>}
                  </div>
                  {/* Outcome */}
                  <div className="hidden md:block">
                    {callSummary ? (
                      <Badge variant="secondary" className="text-xs">{callSummary.lastOutcome.replace(/_/g, ' ')}</Badge>
                    ) : <span className="text-xs text-muted-foreground/50">—</span>}
                  </div>
                  {/* Follow-Up */}
                  <div className="hidden md:block">
                    {followUpDate ? (
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded",
                        isOverdue && "bg-destructive/10 text-destructive",
                        isFollowUpToday && "bg-primary/10 text-primary",
                        !isOverdue && !isFollowUpToday && "text-muted-foreground"
                      )}>
                        {isFollowUpToday ? 'Today' : format(followUpDate, 'MMM d')}
                      </span>
                    ) : <span className="text-xs text-muted-foreground/50">—</span>}
                  </div>
                </>
              ) : (
                <>
                  {/* Last Activity */}
                  <div className="hidden md:block">
                    {activity?.lastActivityDate ? (
                      <div title={activity.lastActivityType ? activityTypeLabels[activity.lastActivityType] : ''}>
                        <p className="text-sm text-foreground">
                          {formatDistanceToNow(activity.lastActivityDate, { addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {activity.lastActivityType ? activityTypeLabels[activity.lastActivityType] : ''}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">No activity</span>
                    )}
                  </div>
                  {/* Email Status */}
                  <div className="hidden md:flex items-center gap-1.5">
                    {activity ? (
                      <span className={cn("text-xs flex items-center gap-1", emailStatusConfig[activity.emailStatus].className)}>
                        {activity.emailStatus === 'replied' ? (
                          <MessageSquare className="w-3 h-3" />
                        ) : activity.emailStatus === 'opened' ? (
                          <Eye className="w-3 h-3" />
                        ) : activity.emailStatus === 'sent' ? (
                          <Mail className="w-3 h-3" />
                        ) : null}
                        {emailStatusConfig[activity.emailStatus].label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </div>
                  {/* Next Step */}
                  <div className="hidden md:block">
                    {followUpDate ? (
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded",
                        isOverdue && "bg-destructive/10 text-destructive",
                        isFollowUpToday && "bg-primary/10 text-primary",
                        !isOverdue && !isFollowUpToday && "text-muted-foreground"
                      )}>
                        {isFollowUpToday ? 'Today' : format(followUpDate, 'MMM d')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">No follow-up</span>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="hidden md:flex justify-end" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(statusLabels).map(([status, label]) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => onStatusChange(prospect.id, status as ProspectStatus)}
                      >
                        <ArrowRight className="w-3 h-3 mr-2" />
                        Move to {label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(prospect.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
