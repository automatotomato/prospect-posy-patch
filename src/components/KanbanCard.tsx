import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Prospect, TeamMember } from '@/types/prospect';
import { SourceBadge } from '@/components/SourceBadge';
import { LeadScoreBadge } from '@/components/LeadScoreBadge';
import { EmailTracker } from '@/components/EmailTracker';
import { SendSmsDialog } from '@/components/SendSmsDialog';
import { Phone, Mail, MapPin, Truck, Calendar, GripVertical, Globe, Loader2, PhoneCall, Trophy, MessageSquare } from 'lucide-react';
import { useCallLogsCount, useLatestConversion } from '@/hooks/useCallLogs';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useWebSearch } from '@/hooks/useWebSearch';
import { useAutoAssign } from '@/hooks/useAutoAssign';

interface KanbanCardProps {
  prospect: Prospect;
  teamMembers: TeamMember[];
  onClick: () => void;
  onScheduleFollowUp?: (prospectId: string) => void;
  onUpdate?: (updates: Partial<Prospect>) => void;
}

export function KanbanCard({ prospect, teamMembers, onClick, onScheduleFollowUp, onUpdate }: KanbanCardProps) {
  const { toast } = useToast();
  const { isSearching, searchAndUpdate } = useWebSearch({ onUpdate });
  const autoAssign = useAutoAssign();
  const [smsOpen, setSmsOpen] = useState(false);
  const { data: callCount = 0 } = useCallLogsCount(prospect.id);
  const { data: latestConversion } = useLatestConversion(prospect.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignedMember = teamMembers.find(m => m.id === prospect.assignedTo);
  
  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (prospect.phone) {
      window.open(`tel:${prospect.phone}`, '_self');
      toast({
        title: "Calling...",
        description: `Dialing ${prospect.phone}`,
      });
      autoAssign(prospect.id, prospect.assignedTo);
    } else {
      toast({
        title: "No phone number",
        description: "Add a phone number to call this prospect.",
        variant: "destructive",
      });
    }
  };

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (prospect.email) {
      window.open(`mailto:${prospect.email}?subject=AI Employees for ${prospect.businessName}&bcc=alex@automateplanet.com`, '_blank');
      toast({
        title: "Opening email client",
        description: `Composing email to ${prospect.email}`,
      });
      autoAssign(prospect.id, prospect.assignedTo);
    } else {
      toast({
        title: "No email address",
        description: "Add an email address to contact this prospect.",
        variant: "destructive",
      });
    }
  };

  const handleText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prospect.phone) {
      toast({
        title: "No phone number",
        description: "Add a phone number to text this prospect.",
        variant: "destructive",
      });
      return;
    }
    setSmsOpen(true);
    autoAssign(prospect.id, prospect.assignedTo);
  };

  const handleSchedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onScheduleFollowUp) {
      onScheduleFollowUp(prospect.id);
    }
    toast({
      title: "Schedule follow-up",
      description: "Open prospect details to schedule a follow-up.",
    });
    onClick();
  };
  const handleWebSearch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await searchAndUpdate(prospect);
    autoAssign(prospect.id, prospect.assignedTo);
  };

  const getFollowUpBadge = () => {
    if (!prospect.nextFollowUp) return null;
    const date = prospect.nextFollowUp;
    
    if (isPast(date) && !isToday(date)) {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Overdue
        </Badge>
      );
    }
    if (isToday(date)) {
      return (
        <Badge className="text-[10px] px-1.5 py-0 bg-[hsl(var(--status-contacted))] text-white">
          Today
        </Badge>
      );
    }
    if (isTomorrow(date)) {
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Tomorrow
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 cursor-pointer hover:shadow-md transition-all border-border/60 bg-card group",
        isDragging && "opacity-50 shadow-lg rotate-2 scale-105"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium text-sm truncate">{prospect.businessName}</h4>
              {prospect.contactName && (
                <p className="text-xs text-muted-foreground truncate">{prospect.contactName}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <LeadScoreBadge score={prospect.leadScore} breakdown={prospect.scoreBreakdown} />
              <SourceBadge source={prospect.source} />
            </div>
          </div>

          {/* Quick info */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {prospect.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {prospect.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {prospect.location}
            </span>
            {prospect.vehicleCount && (
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {prospect.vehicleCount}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleCall}
              title="Call prospect"
            >
              <Phone className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleText}
              title="Text prospect from your phone"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleEmail}
              title="Send email"
            >
              <Mail className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleSchedule}
              title="Schedule follow-up"
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleWebSearch}
              disabled={isSearching}
              title="Search web for contact info"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-primary" />
              )}
            </Button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {callCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <PhoneCall className="w-3 h-3 mr-0.5" />
                  {callCount}
                </Badge>
              )}
              <EmailTracker prospectId={prospect.id} variant="compact" />
              {latestConversion && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  <Trophy className="w-3 h-3 mr-0.5" />
                  {latestConversion.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              )}
              {getFollowUpBadge()}
              {prospect.movedToQuoting && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[hsl(var(--status-quoted))] text-[hsl(var(--status-quoted))]">
                  Quoting
                </Badge>
              )}
            </div>
            {assignedMember && (
              <span className="text-[10px] text-muted-foreground truncate">
                {assignedMember.name.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
    {smsOpen && (
      <SendSmsDialog prospect={prospect} open={smsOpen} onOpenChange={setSmsOpen} />
    )}
    </>
  );
}
