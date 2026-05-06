import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Phone, PhoneCall, Mail, Sparkles } from 'lucide-react';
import { LeadScoreBadge } from '@/components/LeadScoreBadge';
import { LogCallDialog } from '@/components/LogCallDialog';
import { useNewCallTargets, usePreviousCallTargets } from '@/hooks/useDailyActivity';
import { useNavigate } from 'react-router-dom';

interface Target {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  lead_score: number;
  industry: string | null;
}

export function CallQueueWidget() {
  const { data: news, isLoading: l1 } = useNewCallTargets(25);
  const { data: prev, isLoading: l2 } = usePreviousCallTargets(25);
  const [logging, setLogging] = useState<Target | null>(null);

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="w-4 h-4 text-primary" />
            Call Queue
            <span className="text-xs font-normal text-muted-foreground ml-auto">Make 50 dials today</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="new">
            <TabsList className="grid grid-cols-2 w-full mb-3">
              <TabsTrigger value="new" className="text-xs gap-1.5">
                <Sparkles className="w-3 h-3" /> New ({news?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="previous" className="text-xs gap-1.5">
                <PhoneCall className="w-3 h-3" /> Re-engage ({prev?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-0">
              <List
                items={news as Target[] | undefined}
                loading={l1}
                emptyMsg="No new prospects with phone numbers. Run discovery to add more."
                onLog={setLogging}
              />
            </TabsContent>

            <TabsContent value="previous" className="mt-0">
              <List
                items={prev as Target[] | undefined}
                loading={l2}
                emptyMsg="Everyone contacted has been called recently. Nice."
                onLog={setLogging}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {logging && (
        <LogCallDialog
          open={!!logging}
          onOpenChange={(o) => !o && setLogging(null)}
          prospectId={logging.id}
          prospectName={logging.business_name}
        />
      )}
    </>
  );
}

function List({
  items, loading, emptyMsg, onLog,
}: {
  items?: Target[];
  loading: boolean;
  emptyMsg: string;
  onLog: (t: Target) => void;
}) {
  const navigate = useNavigate();
  if (loading) {
    return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyMsg}</p>;
  }
  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto">
      {items.map((p) => (
        <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <button
                className="font-medium text-sm truncate hover:underline text-left"
                onClick={() => navigate(`/?prospect=${p.id}`)}
              >
                {p.business_name}
              </button>
              <LeadScoreBadge score={p.lead_score} />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {p.contact_name || p.industry || '—'} · {p.phone}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {p.phone && (
              <Button size="sm" className="h-7 gap-1" asChild>
                <a href={`tel:${p.phone}`}><Phone className="w-3 h-3" />Call</a>
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7" onClick={() => onLog(p)}>
              Log
            </Button>
            {p.email && (
              <Button size="icon" variant="ghost" className="h-7 w-7 hidden sm:inline-flex" asChild>
                <a href={`mailto:${p.email}`}><Mail className="w-3.5 h-3.5" /></a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
