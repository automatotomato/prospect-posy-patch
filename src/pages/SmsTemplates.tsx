import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, MessageSquare, Phone, Save } from 'lucide-react';
import {
  useSmsTemplates, useUpsertSmsTemplate, useDeleteSmsTemplate,
  useTwilioFromNumber, useSetTwilioFromNumber, renderSmsTemplate, SmsTemplate,
} from '@/hooks/useSms';
import { useToast } from '@/hooks/use-toast';

const VARIABLES = ['firstName', 'businessName', 'city'];
const SAMPLE = { firstName: 'Sarah', businessName: 'Acme Towing', city: 'Las Vegas' };

export default function SmsTemplates() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useSmsTemplates();
  const upsert = useUpsertSmsTemplate();
  const del = useDeleteSmsTemplate();
  const { data: fromNumber = '' } = useTwilioFromNumber();
  const setFromNumber = useSetTwilioFromNumber();

  const [editing, setEditing] = useState<Partial<SmsTemplate> | null>(null);
  const [fromInput, setFromInput] = useState('');

  const openNew = () => setEditing({ name: '', body: '', category: '', is_default: false });
  const openEdit = (t: SmsTemplate) => setEditing(t);

  const handleSave = async () => {
    if (!editing?.name || !editing?.body) {
      toast({ title: 'Name and message required', variant: 'destructive' });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        name: editing.name,
        body: editing.body,
        category: editing.category || null,
        is_default: !!editing.is_default,
      });
      toast({ title: editing.id ? 'Template updated' : 'Template created' });
      setEditing(null);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await del.mutateAsync(id);
    toast({ title: 'Template deleted' });
  };

  const insertVar = (v: string) => {
    if (!editing) return;
    setEditing({ ...editing, body: (editing.body || '') + `{{${v}}}` });
  };

  const handleSaveFrom = async () => {
    const trimmed = fromInput.trim();
    if (!/^\+\d{10,15}$/.test(trimmed)) {
      toast({ title: 'Use E.164 format', description: 'Example: +17025551234', variant: 'destructive' });
      return;
    }
    try {
      await setFromNumber.mutateAsync(trimmed);
      toast({ title: 'From number saved' });
      setFromInput('');
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              SMS Templates
            </h1>
            <p className="text-sm text-muted-foreground">Reusable text scripts for outbound SMS via Twilio.</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </div>

        {/* Twilio From number config */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Phone className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-sm">Twilio "From" Phone Number</h2>
              <p className="text-xs text-muted-foreground mb-3">
                The Twilio number outbound texts are sent from. Must be E.164 format (e.g., +17025551234).
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder={fromNumber || '+17025551234'}
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="max-w-xs"
                />
                <Button onClick={handleSaveFrom} size="sm" className="gap-1.5">
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
                {fromNumber && (
                  <Badge variant="secondary" className="ml-2">
                    Current: {fromNumber}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Templates list */}
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading templates...</p>
          ) : templates.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No templates yet. Create your first one.</p>
            </Card>
          ) : (
            templates.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{t.name}</h3>
                      {t.is_default && <Badge variant="default" className="text-[10px]">Default</Badge>}
                      {t.category && <Badge variant="outline" className="text-[10px]">{t.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.body}</p>
                    <p className="text-[11px] text-muted-foreground mt-2 italic">
                      Preview: {renderSmsTemplate(t.body, SAMPLE)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit template' : 'New template'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Quick intro"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input
                  value={editing.category || ''}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="intro, follow_up, etc."
                />
              </div>
              <div>
                <Label className="text-xs">Message body</Label>
                <Textarea
                  value={editing.body || ''}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  rows={5}
                  className="font-mono text-sm"
                  placeholder="Hey {{firstName}}, ..."
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {VARIABLES.map((v) => (
                    <Button key={v} size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => insertVar(v)}>
                      {`{{${v}}}`}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 italic">
                  Preview: {renderSmsTemplate(editing.body || '', SAMPLE)}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-xs">Default template</Label>
                  <p className="text-[11px] text-muted-foreground">Pre-selects when sending a text.</p>
                </div>
                <Switch
                  checked={!!editing.is_default}
                  onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
