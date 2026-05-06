import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Prospect, LeadSource, TeamMember } from '@/types/prospect';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EditProspectDialogProps {
  prospect: Prospect;
  teamMembers: TeamMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Prospect>) => void;
}

const vehicleTypeOptions = [
  'Box Trucks',
  'Flatbeds',
  'Service Vans',
  'Pickup Trucks',
  'Delivery Vans',
  'Cargo Vans',
  'Tow Trucks',
  'Trailers',
  'Semi Trucks',
  'Refrigerated Trucks',
];

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'field_photo', label: 'Field Photo' },
  { value: 'email', label: 'Email' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'cold_call', label: 'Cold Call' },
];

export function EditProspectDialog({ 
  prospect, 
  teamMembers, 
  open, 
  onOpenChange, 
  onSave 
}: EditProspectDialogProps) {
  const [businessName, setBusinessName] = useState(prospect.businessName);
  const [contactName, setContactName] = useState(prospect.contactName || '');
  const [phone, setPhone] = useState(prospect.phone || '');
  const [email, setEmail] = useState(prospect.email || '');
  const [location, setLocation] = useState(prospect.location);
  const [vehicleCount, setVehicleCount] = useState(prospect.vehicleCount?.toString() || '');
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>(prospect.vehicleTypes || []);
  const [notes, setNotes] = useState(prospect.notes);
  const [source, setSource] = useState<LeadSource>(prospect.source);
  const [assignedTo, setAssignedTo] = useState(prospect.assignedTo);
  const [nextFollowUp, setNextFollowUp] = useState<Date | undefined>(prospect.nextFollowUp);

  // Reset form when prospect changes
  useEffect(() => {
    setBusinessName(prospect.businessName);
    setContactName(prospect.contactName || '');
    setPhone(prospect.phone || '');
    setEmail(prospect.email || '');
    setLocation(prospect.location);
    setVehicleCount(prospect.vehicleCount?.toString() || '');
    setSelectedVehicleTypes(prospect.vehicleTypes || []);
    setNotes(prospect.notes);
    setSource(prospect.source);
    setAssignedTo(prospect.assignedTo);
    setNextFollowUp(prospect.nextFollowUp);
  }, [prospect]);

  const handleVehicleTypeToggle = (type: string) => {
    setSelectedVehicleTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessName.trim() || !location.trim()) return;

    onSave({
      businessName: businessName.trim(),
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      location: location.trim(),
      vehicleCount: vehicleCount ? parseInt(vehicleCount) : undefined,
      vehicleTypes: selectedVehicleTypes.length > 0 ? selectedVehicleTypes : undefined,
      notes: notes.trim(),
      source,
      assignedTo,
      nextFollowUp,
    });

    onOpenChange(false);
  };

  const isValid = businessName.trim() && location.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Prospect</DialogTitle>
          <DialogDescription>
            Update the prospect details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-businessName">Business Name *</Label>
              <Input
                id="edit-businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Garcia Trucking LLC"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-contactName">Contact Name</Label>
                <Input
                  id="edit-contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g., Roberto Garcia"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-location">Location *</Label>
                <Input
                  id="edit-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Austin, TX"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <Label htmlFor="edit-vehicleCount">Number of Vehicles</Label>
              <Input
                id="edit-vehicleCount"
                type="number"
                min="0"
                value={vehicleCount}
                onChange={(e) => setVehicleCount(e.target.value)}
                placeholder="e.g., 8"
                className="mt-1.5 w-32"
              />
            </div>

            <div>
              <Label>Vehicle Types</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {vehicleTypeOptions.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleVehicleTypeToggle(type)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      selectedVehicleTypes.includes(type)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes & Source */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant details about the prospect..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-source">Lead Source</Label>
                <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Next Follow-up</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1.5 justify-start text-left font-normal",
                        !nextFollowUp && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextFollowUp ? format(nextFollowUp, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextFollowUp}
                      onSelect={setNextFollowUp}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
