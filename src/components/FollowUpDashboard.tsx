import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Clock, CheckCheck, XCircle, RotateCcw, Zap } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface FollowUp {
  id: string;
  status: string;
  subject: string | null;
  body: string | null;
  scheduled_for: string;
  sent_at: string | null;
  ai_generated: boolean | null;
  created_at: string;
  prospect_id: string | null;
  follow_up_rules: {
    name: string;
    follow_up_number: number | null;
  } | null;
  prospects: {
    business_name: string;
    email: string | null;
  } | null;
}

function useFollowUps() {
  return useQuery({
    queryKey: ['scheduled-follow-ups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_follow_ups')
        .select('*, follow_up_rules(name, follow_up_number), prospects(business_name, email)')
        .order('scheduled_for', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as FollowUp[];
    },
  });
}

export function FollowUpDashboard() {
  const { data: followUps = [], isLoading } = useFollowUps();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<{
    eligible: number;
    first_send_at: string | null;
    last_send_at: string | null;
    drip_minutes: number;
    skipped: { replied: number; dnc_or_closed: number; has_pending: number; exhausted: number };
  } | null>(null);

  const counts = useMemo(() => ({
    pending: followUps.filter(f => f.status === 'pending').length,
    sent: followUps.filter(f => f.status === 'sent').length,
    cancelled: followUps.filter(f => f.status === 'cancelled').length,
  }), [followUps]);

  const openBackfill = async () => {
    setBackfillOpen(true);
    setPreview(null);
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-follow-ups', {
        body: { dry_run: true },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to preview backfill');
      setBackfillOpen(false);
    } finally {
      setPreviewing(false);
    }
  };

  const runBackfill = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-follow-ups', {
        body: {},
      });
      if (error) throw error;
      const enrolled = data?.enrolled ?? 0;
      toast.success(`Enrolled ${enrolled.toLocaleString()} prospects into the follow-up sequence.`);
      queryClient.invalidateQueries({ queryKey: ['scheduled-follow-ups'] });
      setBackfillOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Backfill failed');
    } finally {
      setRunning(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return followUps;
    return followUps.filter(f => f.status === filter);
  }, [followUps, filter]);

  // Group by prospect
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; email: string | null; items: FollowUp[] }>();
    filtered.forEach(f => {
      const key = f.prospect_id || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          name: f.prospects?.business_name || 'Unknown',
          email: f.prospects?.email || null,
          items: [],
        });
      }
      map.get(key)!.items.push(f);
    });
    // Sort groups by most recent scheduled_for
    return Array.from(map.entries()).sort((a, b) => {
      const aDate = new Date(a[1].items[0]?.scheduled_for || 0).getTime();
      const bDate = new Date(b[1].items[0]?.scheduled_for || 0).getTime();
      return bDate - aDate;
    });
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3 w-3" />;
      case 'sent': return <CheckCheck className="h-3 w-3" />;
      case 'cancelled': return <XCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'sent':
        return <Badge className="bg-green-500/20 text-green-500 gap-1"><CheckCheck className="h-3 w-3" />Sent</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with backfill button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Follow-Up Pipeline</h3>
          <p className="text-sm text-muted-foreground">Painpoint-driven sequence, paced by drip</p>
        </div>
        <AlertDialog open={backfillOpen} onOpenChange={setBackfillOpen}>
          <AlertDialogTrigger asChild>
            <Button onClick={openBackfill} className="gap-2">
              <Zap className="h-4 w-4" />
              Resume follow-ups for everyone
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resume follow-ups for every contacted prospect</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-2">
                  {previewing && (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calculating eligible prospects…
                    </div>
                  )}
                  {preview && (
                    <>
                      <p>
                        This will enroll <strong className="text-foreground">{preview.eligible.toLocaleString()}</strong>{' '}
                        prospects into their next due follow-up step, spaced{' '}
                        <strong className="text-foreground">{preview.drip_minutes} minutes</strong> apart.
                      </p>
                      {preview.first_send_at && preview.last_send_at && (
                        <p className="text-sm">
                          First send: <strong className="text-foreground">{format(new Date(preview.first_send_at), 'MMM d, h:mm a')}</strong><br />
                          Last send: <strong className="text-foreground">{format(new Date(preview.last_send_at), 'MMM d, h:mm a')}</strong>
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                        <p>Skipped (already replied): {preview.skipped.replied.toLocaleString()}</p>
                        <p>Skipped (DNC / closed / responded): {preview.skipped.dnc_or_closed.toLocaleString()}</p>
                        <p>Skipped (already has pending follow-up): {preview.skipped.has_pending.toLocaleString()}</p>
                        <p>Skipped (sequence exhausted): {preview.skipped.exhausted.toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        Sends are paced by the existing drip + Resend rate limit (35s between sends).
                      </p>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); runBackfill(); }}
                disabled={running || previewing || !preview || preview.eligible === 0}
              >
                {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enrolling…</> : `Enroll ${preview?.eligible.toLocaleString() || 0}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('pending')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.pending.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('sent')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCheck className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.sent.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('cancelled')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.cancelled.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({followUps.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({counts.sent})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({counts.cancelled})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Grouped by prospect */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No follow-ups found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([prospectId, group]) => (
            <Card key={prospectId}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{group.name}</h4>
                    {group.email && (
                      <p className="text-sm text-muted-foreground">{group.email}</p>
                    )}
                  </div>
                  <Badge variant="outline">{group.items.length} follow-ups</Badge>
                </div>
                <div className="space-y-2">
                  {group.items
                    .sort((a, b) => {
                      const aNum = a.follow_up_rules?.follow_up_number || 0;
                      const bNum = b.follow_up_rules?.follow_up_number || 0;
                      return aNum - bNum;
                    })
                    .map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getStatusBadge(item.status)}
                        <span className="text-muted-foreground whitespace-nowrap">
                          #{item.follow_up_rules?.follow_up_number || '?'}
                        </span>
                        <span className="truncate font-medium">
                          {item.follow_up_rules?.name || item.subject || 'Follow-up'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {item.status === 'sent' && item.sent_at
                          ? `Sent ${formatDistanceToNow(new Date(item.sent_at), { addSuffix: true })}`
                          : item.status === 'pending'
                          ? format(new Date(item.scheduled_for), 'MMM d, h:mm a')
                          : formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
