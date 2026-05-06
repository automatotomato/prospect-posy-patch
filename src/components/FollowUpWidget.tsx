import { useUpcomingFollowUps, CallLogWithProspect } from '@/hooks/useCallLogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Calendar, AlertTriangle } from 'lucide-react';
import { format, isToday, isPast, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';

interface FollowUpWidgetProps {
  onProspectClick?: (id: string) => void;
}

export function FollowUpWidget({ onProspectClick }: FollowUpWidgetProps) {
  const { data: followUps = [], isLoading } = useUpcomingFollowUps();

  if (isLoading) return null;
  if (followUps.length === 0) return null;

  const overdue = followUps.filter(f => f.follow_up_date && isPast(new Date(f.follow_up_date)) && !isToday(new Date(f.follow_up_date!)));
  const today = followUps.filter(f => f.follow_up_date && isToday(new Date(f.follow_up_date!)));
  const upcoming = followUps.filter(f => f.follow_up_date && !isPast(new Date(f.follow_up_date!)) && !isToday(new Date(f.follow_up_date!)));

  const renderItem = (item: CallLogWithProspect, highlight?: 'overdue' | 'today') => (
    <div
      key={item.id}
      className={cn(
        "flex items-center justify-between gap-3 p-2.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
        highlight === 'overdue' && "bg-destructive/10 border border-destructive/20",
        highlight === 'today' && "bg-primary/10 border border-primary/20"
      )}
      onClick={() => item.prospects?.id && onProspectClick?.(item.prospects.id)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.prospects?.business_name || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">{item.outcome.replace(/_/g, ' ')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {highlight === 'overdue' && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
        <span className={cn(
          "text-xs font-medium",
          highlight === 'overdue' && "text-destructive",
          highlight === 'today' && "text-primary",
        )}>
          {item.follow_up_date && (
            isToday(new Date(item.follow_up_date)) ? 'Today' :
            isTomorrow(new Date(item.follow_up_date)) ? 'Tomorrow' :
            format(new Date(item.follow_up_date), 'MMM d')
          )}
        </span>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Scheduled Follow-Ups
          <Badge variant="secondary" className="ml-auto">{followUps.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[300px] overflow-y-auto">
        {overdue.length > 0 && (
          <>
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider px-1 pt-1">Overdue</p>
            {overdue.map(f => renderItem(f, 'overdue'))}
          </>
        )}
        {today.length > 0 && (
          <>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider px-1 pt-1">Today</p>
            {today.map(f => renderItem(f, 'today'))}
          </>
        )}
        {upcoming.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Upcoming</p>
            {upcoming.map(f => renderItem(f))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
