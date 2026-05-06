import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAddCallLog } from '@/hooks/useCallLogs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoAssign } from '@/hooks/useAutoAssign';

const OUTCOMES = [
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'spoke_with_contact', label: 'Spoke with Contact' },
  { value: 'spoke_with_gatekeeper', label: 'Spoke with Gatekeeper' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'demo_scheduled', label: 'Demo Scheduled' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback_requested', label: 'Callback Requested' },
];

interface LogCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName: string;
}

export function LogCallDialog({ open, onOpenChange, prospectId, prospectName }: LogCallDialogProps) {
  const [outcome, setOutcome] = useState('no_answer');
  const [contactReached, setContactReached] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const { mutate: addCallLog, isPending } = useAddCallLog();
  const { toast } = useToast();
  const { user } = useAuth();
  const autoAssign = useAutoAssign();

  const handleSubmit = () => {
    addCallLog(
      {
        prospect_id: prospectId,
        called_at: new Date().toISOString(),
        outcome,
        notes: notes || null,
        contact_reached: contactReached || null,
        follow_up_date: followUpDate?.toISOString() || null,
        duration_seconds: null,
        created_by: user?.id || null,
      },
      {
        onSuccess: () => {
          toast({ title: 'Call logged', description: `Call to ${prospectName} recorded.` });
          // Auto-assign the prospect to the caller if it was unassigned
          autoAssign(prospectId);
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to log call.', variant: 'destructive' });
        },
      }
    );
  };

  const resetForm = () => {
    setOutcome('no_answer');
    setContactReached('');
    setNotes('');
    setFollowUpDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Log Call — {prospectName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Call Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Who did you speak with?</Label>
            <Input
              placeholder="e.g., John the owner"
              value={contactReached}
              onChange={(e) => setContactReached(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Call Notes</Label>
            <Textarea
              placeholder="What was discussed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Schedule Follow-up</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !followUpDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? format(followUpDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={followUpDate} onSelect={setFollowUpDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : 'Log Call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
