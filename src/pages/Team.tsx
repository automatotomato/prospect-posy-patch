import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Loader2, Trash2, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type AllowedUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'sales_rep';
  invited_at: string;
  accepted_at: string | null;
};

export default function Team() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'sales_rep'>('sales_rep');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['allowed_users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('*')
        .order('invited_at', { ascending: false });
      if (error) throw error;
      return data as AllowedUser[];
    },
  });

  const { data: leadCounts = {} } = useQuery({
    queryKey: ['lead_counts_by_email'],
    queryFn: async () => {
      const { data: tm } = await supabase.from('team_members').select('id, email');
      const { data: pr } = await supabase.from('prospects').select('assigned_to');
      const counts: Record<string, number> = {};
      (pr || []).forEach((p: any) => {
        if (!p.assigned_to) return;
        const m = (tm || []).find((t: any) => t.id === p.assigned_to);
        if (m?.email) counts[m.email.toLowerCase()] = (counts[m.email.toLowerCase()] || 0) + 1;
      });
      return counts;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: { name, email, role },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Invite sent',
        description: data?.emailSent
          ? `${email} has been invited and emailed.`
          : `${email} has been added. Email delivery may have failed — they can still sign in directly.`,
      });
      setName(''); setEmail(''); setRole('sales_rep'); setOpen(false);
      qc.invalidateQueries({ queryKey: ['allowed_users'] });
    },
    onError: (e: any) => {
      toast({ title: 'Invite failed', description: e.message, variant: 'destructive' });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('allowed_users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Member removed' });
      qc.invalidateQueries({ queryKey: ['allowed_users'] });
    },
    onError: (e: any) => toast({ title: 'Remove failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Team</h1>
            <p className="text-muted-foreground text-sm">Invite sales reps and manage access.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><UserPlus className="w-4 h-4" />Invite member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite team member</DialogTitle>
                <DialogDescription>
                  They'll receive an email with a sign-in link. They use their email to log in with a one-time code.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="i-name">Full name</Label>
                  <Input id="i-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="i-email">Email</Label>
                  <Input id="i-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales_rep">Sales Rep — sees only their assigned leads</SelectItem>
                      <SelectItem value="admin">Admin — full access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => invite.mutate()}
                  disabled={!name || !email || invite.isPending}
                  className="gap-2"
                >
                  {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading…</div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No members yet — invite your first sales rep.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{m.email}</TableCell>
                      <TableCell>
                        <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                          {m.role === 'admin' ? 'Admin' : 'Sales Rep'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.accepted_at ? (
                          <Badge variant="outline" className="text-green-600 border-green-600/40">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600/40">Invited</Badge>
                        )}
                      </TableCell>
                      <TableCell>{leadCounts[m.email.toLowerCase()] ?? 0}</TableCell>
                      <TableCell>
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => {
                            if (confirm(`Remove ${m.email}? They'll lose access immediately.`)) remove.mutate(m.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
