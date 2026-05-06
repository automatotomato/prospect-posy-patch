import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Phone, Mail, ArrowRight } from 'lucide-react';
import { LeadScoreBadge } from '@/components/LeadScoreBadge';
import { useHotLeads } from '@/hooks/useTodayData';
import { useNavigate } from 'react-router-dom';

export function HotLeadsWidget() {
  const { data: leads, isLoading } = useHotLeads(10);
  const navigate = useNavigate();

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="w-4 h-4 text-destructive" />
          Hot Leads
          {leads && <span className="text-xs text-muted-foreground ml-auto">Top {leads.length}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : leads && leads.length > 0 ? (
          leads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-medium text-sm truncate">{lead.business_name}</h4>
                  <LeadScoreBadge score={lead.lead_score} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {lead.contact_name || lead.industry || lead.email || '—'}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {lead.phone && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                    <a href={`tel:${lead.phone}`}><Phone className="w-3.5 h-3.5" /></a>
                  </Button>
                )}
                {lead.email && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                    <a href={`mailto:${lead.email}`}><Mail className="w-3.5 h-3.5" /></a>
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/?prospect=${lead.id}`)}>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hot leads yet. Score updates every 15 min.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
