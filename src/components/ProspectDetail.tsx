import { useState } from 'react';
import { Prospect, TeamMember, ProspectStatus } from '@/types/prospect';
import { StatusBadge } from './StatusBadge';
import { SourceBadge } from './SourceBadge';
import { EditProspectDialog } from './EditProspectDialog';
import { EmailComposer } from './EmailComposer';
import { LogCallDialog } from './LogCallDialog';
import { LogConversionDialog } from './LogConversionDialog';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';
import { ProspectEmailHistory } from './ProspectEmailHistory';
import { EmailTracker } from './EmailTracker';
import { ColdCallScript } from './ColdCallScript';
import { useCallLogs, useConversions } from '@/hooks/useCallLogs';
import { useSentEmails } from '@/hooks/useSentEmails';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, MapPin, Phone, Mail, Truck, Calendar, Clock, 
  CheckCircle2, Circle, ChevronRight, MessageSquare,
  PhoneCall, Send, Pencil, Trash2, BanIcon, Globe, Loader2, Trophy
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useWebSearch } from '@/hooks/useWebSearch';

interface ProspectDetailProps {
  prospect: Prospect;
  teamMembers: TeamMember[];
  onClose: () => void;
  onStatusChange: (status: ProspectStatus) => void;
  onToggleQuoting: () => void;
  onTaskComplete: (taskId: string) => void;
  onUpdate: (updates: Partial<Prospect>) => void;
  onDelete?: () => void;
}

const statusFlow: ProspectStatus[] = ['new', 'called', 'responded', 'qualified', 'quoted', 'closed'];

const taskTypeIcons = {
  call: PhoneCall,
  email: Send,
  text: MessageSquare,
  follow_up: Calendar,
};

export function ProspectDetail({ 
  prospect, 
  teamMembers, 
  onClose,
  onStatusChange,
  onToggleQuoting,
  onTaskComplete,
  onUpdate,
  onDelete
}: ProspectDetailProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [doNotContactDialogOpen, setDoNotContactDialogOpen] = useState(false);
  const [doNotContactReason, setDoNotContactReason] = useState('');
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [logConversionOpen, setLogConversionOpen] = useState(false);
  const { isSearching, searchAndUpdate } = useWebSearch({ onUpdate });
  const { data: callLogs = [], isLoading: callLogsLoading } = useCallLogs(prospect.id);
  const { data: conversions = [] } = useConversions(prospect.id);
  const { data: allSentEmails = [] } = useSentEmails();
  const prospectSentEmails = allSentEmails.filter(e => e.prospect_id === prospect.id);
  
  const assignedMember = teamMembers.find(m => m.id === prospect.assignedTo);
  const currentStatusIndex = statusFlow.indexOf(prospect.status);

  const handleDoNotContact = () => {
    onUpdate({ 
      doNotContact: true, 
      doNotContactReason: doNotContactReason || 'Unsubscribe request' 
    });
    setDoNotContactDialogOpen(false);
    setDoNotContactReason('');
  };

  const handleRemoveDoNotContact = () => {
    onUpdate({ doNotContact: false, doNotContactReason: undefined });
  };

  return (
    <>
      <div className="h-full flex flex-col bg-card animate-slide-in">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-lg truncate">{prospect.businessName}</h2>
              {prospect.doNotContact && (
                <Badge variant="destructive" className="shrink-0 text-[10px]">
                  <BanIcon className="w-3 h-3 mr-1" />
                  Do Not Contact
                </Badge>
              )}
            </div>
            {prospect.contactName && (
              <p className="text-sm text-muted-foreground truncate">{prospect.contactName}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setEditDialogOpen(true)} title="Edit">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setDeleteDialogOpen(true)} 
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="Close">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Do Not Contact Warning */}
          {prospect.doNotContact && (
            <Card className="p-3 bg-destructive/10 border-destructive/20">
              <div className="flex items-start gap-3">
                <BanIcon className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Do Not Contact</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {prospect.doNotContactReason || 'This prospect has requested not to be contacted.'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 h-7 text-xs"
                    onClick={handleRemoveDoNotContact}
                  >
                    Remove restriction
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Status Flow */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Status</h3>
            <div className="flex items-center gap-1">
              {statusFlow.map((status, index) => (
                <button
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className={cn(
                    "flex-1 py-2 px-1 text-xs font-medium rounded-md transition-all capitalize",
                    index <= currentStatusIndex 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">Contact Info</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => searchAndUpdate(prospect)}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    Search Web
                  </>
                )}
              </Button>
            </div>
            <Card className="p-3 space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{prospect.location}</span>
              </div>
              {prospect.phone ? (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${prospect.phone}`} className="text-primary hover:underline">
                    {prospect.phone}
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span className="italic">No phone</span>
                </div>
              )}
              {prospect.email ? (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${prospect.email}`} className="text-primary hover:underline">
                    {prospect.email}
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="italic">No email</span>
                </div>
              )}
              {/* Social Media & Website Links */}
              {prospect.website && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">Website</a>
                </div>
              )}
              {prospect.facebookUrl && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={prospect.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">Facebook</a>
                </div>
              )}
              {prospect.instagramUrl && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={prospect.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">Instagram</a>
                </div>
              )}
              {prospect.linkedinUrl && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">LinkedIn</a>
                </div>
              )}
              {prospect.yelpUrl && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={prospect.yelpUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">Yelp</a>
                </div>
              )}
            </Card>
          </div>

          {/* Fleet Info */}
          {prospect.vehicleCount && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Fleet Info</h3>
              <Card className="p-3">
                <div className="flex items-center gap-3 text-sm">
                  <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{prospect.vehicleCount} vehicles</span>
                </div>
                {prospect.vehicleTypes && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prospect.vehicleTypes.map(type => (
                      <span key={type} className="text-xs bg-muted px-2 py-1 rounded">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Conversions */}
          {conversions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Conversions</h3>
              <div className="flex flex-wrap gap-1.5">
                {conversions.map((c) => (
                  <Badge key={c.id} variant="default" className="text-[10px]">
                    <Trophy className="w-3 h-3 mr-1" />
                    {c.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {c.scheduled_for && ` — ${format(new Date(c.scheduled_for), 'MMM d')}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Cold Call Script */}
          <ColdCallScript
            businessName={prospect.businessName}
            contactName={prospect.contactName}
            industry={prospect.industry}
            location={prospect.location}
            phone={prospect.phone}
            notes={prospect.notes}
            website={prospect.website}
          />

          {/* Email tracker */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Email Tracking</h3>
            <EmailTracker prospectId={prospect.id} variant="full" />
          </div>

          {/* Activity Timeline (unified calls + emails) */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Activity Timeline ({callLogs.length + prospectSentEmails.length})
            </h3>
            <UnifiedActivityTimeline
              callLogs={callLogs}
              sentEmails={prospectSentEmails}
              isLoading={callLogsLoading}
            />
          </div>

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Notes</h3>
            <Card className="p-3">
              <p className="text-sm leading-relaxed">{prospect.notes || 'No notes added.'}</p>
            </Card>
          </div>

          {/* Tasks */}
          {prospect.tasks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Tasks</h3>
              <div className="space-y-2">
                {prospect.tasks.map(task => {
                  const Icon = taskTypeIcons[task.type];
                  const isOverdue = !task.completed && task.dueDate < new Date();
                  return (
                    <Card 
                      key={task.id}
                      className={cn(
                        "p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors",
                        task.completed && "opacity-60"
                      )}
                      onClick={() => onTaskComplete(task.id)}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-status-closed shrink-0 mt-0.5" />
                      ) : (
                        <Circle className={cn(
                          "w-4 h-4 shrink-0 mt-0.5",
                          isOverdue ? "text-destructive" : "text-muted-foreground"
                        )} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={cn(
                            "text-sm",
                            task.completed && "line-through"
                          )}>{task.description}</span>
                        </div>
                        <p className={cn(
                          "text-xs mt-1",
                          isOverdue ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {format(task.dueDate, 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Source</span>
              <SourceBadge source={prospect.source} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Assigned to</span>
              <div className="flex items-center gap-2">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-[9px] bg-secondary">
                    {assignedMember?.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <span>{assignedMember?.name}</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Added</span>
              <span>{format(prospect.createdAt, 'MMM d, yyyy')}</span>
            </div>
            {prospect.nextFollowUp && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next follow-up</span>
                  <span className={cn(
                    prospect.nextFollowUp < new Date() && "text-destructive font-medium"
                  )}>
                    {format(prospect.nextFollowUp, 'MMM d, h:mm a')}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-4 border-t border-border bg-card space-y-2">
          {/* Click-to-Call + Log Call */}
          {!prospect.doNotContact && (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="default"
                onClick={() => {
                  if (prospect.phone) {
                    window.open(`tel:${prospect.phone}`, '_self');
                  }
                  setLogCallOpen(true);
                }}
              >
                <Phone className="w-4 h-4 mr-2" />
                {prospect.phone ? 'Call & Log' : 'Log Call'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setLogConversionOpen(true)}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Log Meeting
              </Button>
            </div>
          )}
          {!prospect.doNotContact && (
            <Button 
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setDoNotContactDialogOpen(true)}
            >
              <BanIcon className="w-4 h-4 mr-2" />
              Mark as Do Not Contact
            </Button>
          )}
          {prospect.email && !prospect.doNotContact && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => setEmailComposerOpen(true)}
            >
              <Mail className="w-4 h-4 mr-2" />
              Compose Email
            </Button>
          )}
          <Button 
            variant={prospect.movedToQuoting ? "secondary" : "default"}
            className="w-full"
            onClick={onToggleQuoting}
          >
            {prospect.movedToQuoting ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                In Quoting System
              </>
            ) : (
              <>
                Move to Quoting
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      <EditProspectDialog
        prospect={prospect}
        teamMembers={teamMembers}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={onUpdate}
      />

      <EmailComposer
        open={emailComposerOpen}
        onOpenChange={setEmailComposerOpen}
        prospectId={prospect.id}
        prospectEmail={prospect.email}
        prospectName={prospect.contactName}
        businessData={{
          businessName: prospect.businessName,
          contactName: prospect.contactName,
          location: prospect.location,
          vehicleCount: prospect.vehicleCount,
          vehicleTypes: prospect.vehicleTypes,
          notes: prospect.notes,
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prospect</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {prospect.businessName}? This action cannot be undone.
              All tasks and email history associated with this prospect will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.();
                onClose();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Do Not Contact Dialog */}
      <Dialog open={doNotContactDialogOpen} onOpenChange={setDoNotContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BanIcon className="w-5 h-5 text-destructive" />
              Mark as Do Not Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will flag the prospect and prevent sending emails. You can remove this restriction later.
            </p>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g., Requested to unsubscribe, Wrong contact, etc."
                value={doNotContactReason}
                onChange={(e) => setDoNotContactReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDoNotContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDoNotContact}>
              <BanIcon className="w-4 h-4 mr-2" />
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LogCallDialog
        open={logCallOpen}
        onOpenChange={setLogCallOpen}
        prospectId={prospect.id}
        prospectName={prospect.businessName}
      />

      <LogConversionDialog
        open={logConversionOpen}
        onOpenChange={setLogConversionOpen}
        prospectId={prospect.id}
        prospectName={prospect.businessName}
      />
    </>
  );
}
