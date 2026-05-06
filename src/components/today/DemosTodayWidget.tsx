import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Phone, PhoneCall } from 'lucide-react';
import { useTodayDemos } from '@/hooks/useTodayData';
import { format } from 'date-fns';

export function DemosTodayWidget() {
  const { data: demos, isLoading } = useTodayDemos();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="w-4 h-4 text-primary" />
          Demos / Calls Today
          {demos && <span className="text-xs text-muted-foreground ml-auto">{demos.length}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {isLoading ? (
          [...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : demos && demos.length > 0 ? (
          demos.map((d: any) => (
            <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {d.prospects?.business_name || 'Unknown'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {d.scheduled_for && format(new Date(d.scheduled_for), 'h:mm a')} · {d.type?.replace(/_/g, ' ')}
                </p>
              </div>
              {d.prospects?.phone && (
                <Button size="sm" variant="outline" className="h-7" asChild>
                  <a href={`tel:${d.prospects.phone}`}><Phone className="w-3 h-3 mr-1" />Call</a>
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No demos or calls scheduled today.</p>
        )}
      </CardContent>
    </Card>
  );
}
