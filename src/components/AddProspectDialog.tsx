import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AddProspectDialogProps {
  teamMembers: TeamMember[];
  onAddProspect: (prospect: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>) => void;
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

// Auto-assignment rules
const getAutoAssignedAgent = (
  location: string,
  vehicleCount: number,
  teamMembers: TeamMember[]
): string => {
  const agents = teamMembers.filter(m => m.role === 'agent');
  
  // Rule 1: Large fleets (15+ vehicles) go to senior agent (first agent)
  if (vehicleCount >= 15 && agents.length > 0) {
    return agents[0].id;
  }
  
  // Rule 2: Location-based assignment
  const locationLower = location.toLowerCase();
  
  // Austin area -> first agent
  if (locationLower.includes('austin') || locationLower.includes('round rock') || locationLower.includes('cedar park')) {
    return agents[0]?.id || teamMembers[0]?.id;
  }
  
  // San Antonio area -> second agent
  if (locationLower.includes('san antonio') || locationLower.includes('new braunfels')) {
    return agents[1]?.id || agents[0]?.id || teamMembers[0]?.id;
  }
  
  // Rule 3: Round-robin for other locations (alternate between agents)
  const randomIndex = Math.floor(Math.random() * agents.length);
  return agents[randomIndex]?.id || teamMembers[0]?.id;
};

export function AddProspectDialog({ teamMembers, onAddProspect }: AddProspectDialogProps) {
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [vehicleCount, setVehicleCount] = useState('');
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<LeadSource>('field_photo');
  const [assignedTo, setAssignedTo] = useState('');
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true);

  // Calculate auto-assignment when location or vehicle count changes
  const suggestedAssignee = location || vehicleCount 
    ? getAutoAssignedAgent(location, parseInt(vehicleCount) || 0, teamMembers)
    : '';

  const effectiveAssignee = autoAssignEnabled ? suggestedAssignee : assignedTo;
  const assignedMember = teamMembers.find(m => m.id === effectiveAssignee);

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

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    onAddProspect({
      businessName: businessName.trim(),
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      location: location.trim(),
      vehicleCount: vehicleCount ? parseInt(vehicleCount) : undefined,
      vehicleTypes: selectedVehicleTypes.length > 0 ? selectedVehicleTypes : undefined,
      notes: notes.trim(),
      status: 'new',
      source,
      assignedTo: effectiveAssignee || teamMembers[0]?.id,
      nextFollowUp: tomorrow,
      movedToQuoting: false,
    });

    // Reset form
    setBusinessName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setLocation('');
    setVehicleCount('');
    setSelectedVehicleTypes([]);
    setNotes('');
    setSource('field_photo');
    setAssignedTo('');
    setAutoAssignEnabled(true);
    setOpen(false);
  };

  const isValid = businessName.trim() && location.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Add New Prospect</DialogTitle>
          <DialogDescription>
            Enter the prospect details. Assignment will be suggested automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g., Garcia Trucking LLC"
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g., Roberto Garcia"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
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
              <Label htmlFor="vehicleCount">Number of Vehicles</Label>
              <Input
                id="vehicleCount"
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
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant details about the prospect..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            <div>
              <Label htmlFor="source">Lead Source</Label>
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
          </div>

          {/* Assignment */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label>Assignment</Label>
              <button
                type="button"
                onClick={() => setAutoAssignEnabled(!autoAssignEnabled)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                  autoAssignEnabled 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Auto-assign
              </button>
            </div>

            {autoAssignEnabled ? (
              <div className="p-3 bg-muted/50 rounded-lg">
                {assignedMember ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{assignedMember.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {parseInt(vehicleCount) >= 15 
                          ? 'Large fleet (15+ vehicles)'
                          : location.toLowerCase().includes('austin') || location.toLowerCase().includes('round rock')
                          ? 'Austin area territory'
                          : location.toLowerCase().includes('san antonio')
                          ? 'San Antonio area territory'
                          : 'Auto-assigned'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Suggested
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enter location or vehicle count for auto-assignment
                  </p>
                )}
              </div>
            ) : (
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
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
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Add Prospect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
