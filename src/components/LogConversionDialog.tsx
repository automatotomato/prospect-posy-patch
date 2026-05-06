import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAddConversion } from '@/hooks/useCallLogs';
import { useToast } from '@/hooks/use-toast';

const CONVERSION_TYPES = [
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'demo_scheduled', label: 'Demo Scheduled' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'deal_closed', label: 'Deal Closed' },
  { value: 'deal_lost', label: 'Deal Lost' },
];

interface LogConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName: string;
}

export function LogConversionDialog({ open, onOpenChange, prospectId, prospectName }: LogConversionDialogProps) {
  const [type, setType] = useState('meeting_booked');
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>();
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const { mutate: addConversion, isPending } = useAddConversion();
  const { toast } = useToast();

  const handleSubmit = () => {
    addConversion(
      {
        prospect_id: prospectId,
        type,
        scheduled_for: scheduledFor?.toISOString() || null,
        value: value ? parseFloat(value) : null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast({ title: 'Conversion logged', description: `${CONVERSION_TYPES.find(t => t.value === type)?.label} recorded for ${prospectName}.` });
          resetForm();
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to log conversion.', variant: 'destructive' });
        },
      }
    );
  };

  const resetForm = () => {
    setType('meeting_booked');
    setScheduledFor(undefined);
    setValue('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Log Conversion — {prospectName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Conversion Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Scheduled For</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !scheduledFor && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledFor ? format(scheduledFor, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={scheduledFor} onSelect={setScheduledFor} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Deal Value ($)</Label>
            <Input type="number" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Additional details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : 'Log Conversion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
