import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, Phone, Mail, ArrowRight } from 'lucide-react';
import { LeadScoreBadge } from '@/components/LeadScoreBadge';
import { useFollowUpsDue } from '@/hooks/useTodayData';
import { useNavigate } from 'react-router-dom';
import { isPast, isToday, format } from 'date-fns';

export function FollowUpsDueWidget() {
  const { data: items, isLoading } = useFollowUpsDue();
  const navigate = useNavigate();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4 text-amber-500" />
          Follow-ups Due
          {items && <span className="text-xs text-muted-foreground ml-auto">{items.length}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : items && items.length > 0 ? (
          items.map((p: any) => {
            const due = p.next_follow_up ? new Date(p.next_follow_up) : null;
            const overdue = due && isPast(due) && !isToday(due);
            return (
              <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-medium text-sm truncate">{p.business_name}</h4>
                    <LeadScoreBadge score={p.lead_score} />
                    {overdue && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Overdue</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {due && (isToday(due) ? `Today ${format(due, 'h:mm a')}` : format(due, 'MMM d, h:mm a'))}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {p.phone && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                      <a href={`tel:${p.phone}`}><Phone className="w-3.5 h-3.5" /></a>
                    </Button>
                  )}
                  {p.email && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                      <a href={`mailto:${p.email}`}><Mail className="w-3.5 h-3.5" /></a>
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/?prospect=${p.id}`)}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No follow-ups due. Nice work.</p>
        )}
      </CardContent>
    </Card>
  );
}
