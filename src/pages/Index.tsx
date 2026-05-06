import { useState, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { MobileNav } from '@/components/MobileNav';
import { MobileProspectSheet } from '@/components/MobileProspectSheet';
import { QuickCaptureButton } from '@/components/QuickCaptureButton';
import { FollowUpWidget } from '@/components/FollowUpWidget';
import { FollowUpDashboard } from '@/components/FollowUpDashboard';
import { useAllCallLogs } from '@/hooks/useCallLogs';

import { DashboardStats } from '@/components/DashboardStats';
import { ProspectFilters } from '@/components/ProspectFilters';
import { ProspectTable } from '@/components/ProspectTable';
import { ProspectDetail } from '@/components/ProspectDetail';
import { EmptyState } from '@/components/EmptyState';
import { AddProspectDialog } from '@/components/AddProspectDialog';
import { PhotoLeadCapture } from '@/components/PhotoLeadCapture';
import { CSVUploadDialog } from '@/components/CSVUploadDialog';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { AgentActivityWidget } from '@/components/AgentActivityWidget';
import { SentEmailCard } from '@/components/outreach/SentEmailCard';
import { useProspects, useTeamMembers, useAddProspect, useAddProspects, useUpdateProspect, useToggleTask, useDeleteProspect } from '@/hooks/useProspects';
import {
  useOutreachQueue,
  useScheduledEmails,
  useAgentRuns,
  useRunAgent,
  useRegenerateEmail,
  useCancelScheduledEmail,
  useBulkCancelScheduledEmails,
  OutreachQueueItem,
  ScheduledEmailItem,
} from '@/hooks/useOutreachQueue';
import { useSentEmails, SentEmail, useSentEmailStats } from '@/hooks/useSentEmails';
import { Checkbox } from '@/components/ui/checkbox';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { Prospect, ProspectStatus } from '@/types/prospect';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, BarChart3, Camera, Sparkles, Mail, Send, Eye, MousePointerClick, Settings2, Users, Clock, X, Phone, RefreshCw, RotateCcw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState as useStateDrip, useEffect as useEffectDrip } from 'react';

function DripCountdown({ scheduledFor }: { scheduledFor: string }) {
  const [timeLeft, setTimeLeft] = useStateDrip('');
  useEffectDrip(() => {
    const update = () => {
      const diff = new Date(scheduledFor).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Sending...'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [scheduledFor]);
  return <span className="text-xs font-medium text-primary flex items-center gap-1"><Clock className="h-3 w-3" />Sends in {timeLeft}</span>;
}

import OutreachAnalytics from './OutreachAnalytics';
import OutreachSettings from './OutreachSettings';

const AI_SOURCES = ['website', 'cold_call'] as const;
const MANUAL_SOURCES = ['field_photo', 'email', 'referral', 'csv_import'] as const;

import { LeadSource } from '@/types/prospect';
import { ActivitySummary } from '@/components/ProspectTable';

const Index = () => {
  const { toast: uiToast } = useToast();
  const isMobile = useIsMobile();

  // Main tab
  const [activeTab, setActiveTab] = useState('leads');
  // Sub-tabs
  const [leadSubTab, setLeadSubTab] = useState('all-leads');
  const [emailSubTab, setEmailSubTab] = useState('drip');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [sentSubTab, setSentSubTab] = useState('all');

  // Prospect state
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [dateContactedFrom, setDateContactedFrom] = useState<Date | undefined>();
  const [dateContactedTo, setDateContactedTo] = useState<Date | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Email queue state
  const [selectedEmail, setSelectedEmail] = useState<OutreachQueueItem | null>(null);
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedSentEmail, setSelectedSentEmail] = useState<SentEmail | null>(null);

  // Quick capture state
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Database queries
  const { data: prospects = [], isLoading: prospectsLoading } = useProspects();
  const { data: teamMembers = [], isLoading: teamLoading } = useTeamMembers();
  const { data: queueItems } = useOutreachQueue();
  const { data: scheduledEmails } = useScheduledEmails();
  const { data: agentRuns = [] } = useAgentRuns();
  const { data: agentSettings } = useAgentSettings();
  const { data: sentEmails } = useSentEmails();
  const { data: emailStats } = useSentEmailStats();
  const { data: allCallLogs = [] } = useAllCallLogs();
  const runAgentMutation = useRunAgent();
  const isRunning = runAgentMutation.isPending;
  const pendingScheduled = scheduledEmails?.filter(e => e.status === 'pending') || [];
  const cancelledScheduled = scheduledEmails?.filter(e => e.status === 'cancelled') || [];
  const [syncingEmails, setSyncingEmails] = useState(false);
  const [syncResult, setSyncResult] = useState<{ updated: number; unchanged: number; failed: number; remaining: number; scanned: number } | null>(null);

  // Mutations - prospects
  const addProspectMutation = useAddProspect();
  const addProspectsMutation = useAddProspects();
  const updateProspectMutation = useUpdateProspect();
  const toggleTaskMutation = useToggleTask();
  const deleteProspectMutation = useDeleteProspect();

  // Mutations - emails
  const cancelEmail = useCancelScheduledEmail();
  const bulkCancel = useBulkCancelScheduledEmails();
  const regenerateEmail = useRegenerateEmail();

  const selectedProspect = prospects.find(p => p.id === selectedProspectId);

  // Separate prospects by source
  const aiProspects = useMemo(() =>
    prospects.filter(p => AI_SOURCES.includes(p.source as any)), [prospects]);
  const manualProspects = useMemo(() =>
    prospects.filter(p => MANUAL_SOURCES.includes(p.source as any)), [prospects]);

  // Prospects that have been called (have at least one call log)
  const calledProspectIds = useMemo(() => {
    const ids = new Set<string>();
    allCallLogs.forEach(log => ids.add(log.prospect_id));
    return ids;
  }, [allCallLogs]);

  const calledProspects = useMemo(() =>
    prospects.filter(p => calledProspectIds.has(p.id)), [prospects, calledProspectIds]);

  // Build call summary map for called tab
  const callSummaryMap = useMemo(() => {
    const map = new Map<string, { lastCallDate: string; lastOutcome: string; followUpDate: string | null; callCount: number }>();
    allCallLogs.forEach(log => {
      const existing = map.get(log.prospect_id);
      if (!existing) {
        map.set(log.prospect_id, {
          lastCallDate: log.called_at,
          lastOutcome: log.outcome,
          followUpDate: log.follow_up_date,
          callCount: 1,
        });
      } else {
        existing.callCount++;
        if (log.follow_up_date && (!existing.followUpDate || log.follow_up_date > existing.followUpDate)) {
          existing.followUpDate = log.follow_up_date;
        }
      }
    });
    return map;
  }, [allCallLogs]);

  // Build activity summary map for CRM columns
  const activityMap = useMemo(() => {
    const map = new Map<string, ActivitySummary>();
    const allEmails = sentEmails || [];

    for (const p of prospects) {
      const prospectEmails = allEmails.filter(e => e.prospect_id === p.id);
      const prospectCalls = allCallLogs.filter(c => c.prospect_id === p.id);

      // Determine email status
      let emailStatus: ActivitySummary['emailStatus'] = 'none';
      const hasReplied = prospectEmails.some(e => e.status === 'replied' || e.replied_at);
      const hasOpened = prospectEmails.some(e => e.open_count > 0);
      const hasSent = prospectEmails.length > 0;
      if (hasReplied) emailStatus = 'replied';
      else if (hasOpened) emailStatus = 'opened';
      else if (hasSent) emailStatus = 'sent';

      // Last activity
      let lastActivityDate: Date | null = null;
      let lastActivityType: ActivitySummary['lastActivityType'] = null;

      // Check latest email events
      for (const e of prospectEmails) {
        if (e.replied_at) {
          const d = new Date(e.replied_at);
          if (!lastActivityDate || d > lastActivityDate) { lastActivityDate = d; lastActivityType = 'reply'; }
        }
        if (e.opened_at) {
          const d = new Date(e.opened_at);
          if (!lastActivityDate || d > lastActivityDate) { lastActivityDate = d; lastActivityType = 'opened'; }
        }
        const sentDate = new Date(e.sent_at);
        if (!lastActivityDate || sentDate > lastActivityDate) { lastActivityDate = sentDate; lastActivityType = 'email_sent'; }
      }

      for (const c of prospectCalls) {
        const d = new Date(c.called_at);
        if (!lastActivityDate || d > lastActivityDate) { lastActivityDate = d; lastActivityType = 'call'; }
      }

      map.set(p.id, {
        lastActivityDate,
        lastActivityType,
        emailStatus,
        nextFollowUp: p.nextFollowUp || null,
      });
    }

    return map;
  }, [prospects, sentEmails, allCallLogs]);

  const currentProspects = leadSubTab === 'all-leads' ? prospects : calledProspects;

  // Extract unique industries from prospects
  const industries = useMemo(() => {
    const set = new Set<string>();
    prospects.forEach(p => { if (p.industry) set.add(p.industry); });
    return Array.from(set).sort();
  }, [prospects]);

  const filteredProspects = useMemo(() => {
    return currentProspects.filter(prospect => {
      const matchesSearch = search === '' ||
        prospect.businessName.toLowerCase().includes(search.toLowerCase()) ||
        prospect.contactName?.toLowerCase().includes(search.toLowerCase()) ||
        prospect.location.toLowerCase().includes(search.toLowerCase()) ||
        prospect.phone?.includes(search) ||
        prospect.email?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || prospect.status === statusFilter;
      const matchesAssignee = assigneeFilter === 'all' || prospect.assignedTo === assigneeFilter;
      const matchesIndustry = industryFilter === 'all' || prospect.industry === industryFilter;
      const matchesSource = sourceFilter === 'all' || prospect.source === sourceFilter;
      const matchesDateFrom = !dateContactedFrom || prospect.createdAt >= dateContactedFrom;
      const matchesDateTo = !dateContactedTo || prospect.createdAt <= new Date(dateContactedTo.getTime() + 86400000);
      return matchesSearch && matchesStatus && matchesAssignee && matchesIndustry && matchesSource && matchesDateFrom && matchesDateTo;
    });
  }, [currentProspects, search, statusFilter, assigneeFilter, industryFilter, sourceFilter, dateContactedFrom, dateContactedTo]);

  // Email queue items
  const sentQueueItems = queueItems?.filter(item => item.status === 'sent') || [];

  // Sent emails
  const allSentEmails = sentEmails || [];
  const openedEmails = allSentEmails.filter(e => e.open_count > 0);
  const clickedEmails = allSentEmails.filter(e => e.click_count > 0);
  const repliedEmails = allSentEmails.filter(e => e.status === 'replied' || e.replied_at);
  const noResponseEmails = allSentEmails.filter(e => e.open_count === 0);

  const getSentEmailsForTab = () => {
    switch (sentSubTab) {
      case 'opened': return openedEmails;
      case 'clicked': return clickedEmails;
      case 'hot-leads': return repliedEmails;
      case 'no-response': return noResponseEmails;
      default: return allSentEmails;
    }
  };

  // ---- Prospect Handlers ----
  const handleAddProspect = async (newProspect: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>) => {
    try {
      await addProspectMutation.mutateAsync(newProspect);
      uiToast({ title: "Prospect added", description: `${newProspect.businessName} added successfully` });
    } catch (error) {
      uiToast({ title: "Error", description: "Failed to add prospect", variant: "destructive" });
    }
  };

  const handleUpdateProspect = async (prospectId: string, updates: Partial<Prospect>) => {
    try {
      await updateProspectMutation.mutateAsync({ id: prospectId, updates });
    } catch (error) {
      uiToast({ title: "Error", description: "Failed to update prospect", variant: "destructive" });
    }
  };

  const handleStatusChange = (prospectId: string, newStatus: ProspectStatus) => {
    handleUpdateProspect(prospectId, { status: newStatus });
  };

  const handleBulkStatusChange = async (ids: string[], status: ProspectStatus) => {
    for (const id of ids) {
      await updateProspectMutation.mutateAsync({ id, updates: { status } });
    }
  };

  const handleToggleQuoting = (prospectId: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (prospect) handleUpdateProspect(prospectId, { movedToQuoting: !prospect.movedToQuoting });
  };

  const handleTaskComplete = async (prospectId: string, taskId: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    const task = prospect?.tasks.find(t => t.id === taskId);
    if (task) {
      try {
        await toggleTaskMutation.mutateAsync({ taskId, completed: !task.completed });
      } catch (error) {
        uiToast({ title: "Error", description: "Failed to update task", variant: "destructive" });
      }
    }
  };

  const handleDeleteProspect = async (prospectId: string) => {
    try {
      await deleteProspectMutation.mutateAsync(prospectId);
      setSelectedProspectId(null);
      uiToast({ title: "Prospect deleted" });
    } catch (error) {
      uiToast({ title: "Error", description: "Failed to delete prospect", variant: "destructive" });
    }
  };

  // ---- Email Queue Handlers ----
  const handleCancelEmail = async (id: string) => {
    try { await cancelEmail.mutateAsync(id); toast.success('Email cancelled'); } catch { toast.error('Failed to cancel'); }
  };
  const handleRegenerate = async (item: OutreachQueueItem) => {
    setRegeneratingId(item.id);
    try { await regenerateEmail.mutateAsync(item); toast.success('Email regenerated'); } catch { toast.error('Failed to regenerate'); }
    finally { setRegeneratingId(null); }
  };
  const handleEmailSelectAll = () => {
    setEmailSelectedIds(new Set(pendingScheduled.map(item => item.id)));
  };
  const handleEmailCancelAll = async () => {
    try { await bulkCancel.mutateAsync(Array.from(emailSelectedIds)); toast.success(`${emailSelectedIds.size} emails cancelled`); setEmailSelectedIds(new Set()); }
    catch { toast.error('Failed to cancel emails'); }
  };
  const handleEmailToggleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(emailSelectedIds);
    if (selected) newSelected.add(id); else newSelected.delete(id);
    setEmailSelectedIds(newSelected);
  };

  // Quick capture
  const handleQuickCapture = async (imageBase64: string) => {
    setCapturedImage(imageBase64);
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-lead', { body: { imageBase64 } });
      if (error) throw error;
      if (data.success && data.data) {
        const extracted = data.data;
        setExtractedData(extracted);
        setBusinessName(extracted.businessName || '');
        setContactName(extracted.contactName || '');
        setPhone(extracted.phone || '');
        setEmail(extracted.email || '');
        setLocation(extracted.address || '');
        setNotes(extracted.notes || '');
        setShowQuickAdd(true);
        uiToast({ title: "Info extracted!", description: "Review and save the prospect." });
      }
    } catch {
      uiToast({ title: "Extraction failed", description: "Try again or add manually.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickSave = () => {
    if (!businessName) {
      uiToast({ title: "Missing info", description: "Business name is required.", variant: "destructive" });
      return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const agents = teamMembers.filter(m => m.role === 'agent');
    const assignedTo = agents[0]?.id || teamMembers[0]?.id;
    handleAddProspect({
      businessName, contactName: contactName || undefined, phone: phone || undefined,
      email: email || undefined, location: location || 'Unknown',
      vehicleCount: extractedData?.vehicleCount || undefined,
      vehicleTypes: extractedData?.vehicleTypes || undefined,
      notes, status: 'new', source: 'field_photo', assignedTo,
      nextFollowUp: tomorrow, movedToQuoting: false,
    });
    setShowQuickAdd(false); setCapturedImage(null); setExtractedData(null);
    setBusinessName(''); setContactName(''); setPhone(''); setEmail(''); setLocation(''); setNotes('');
  };

  const isLoading = prospectsLoading || teamLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isBulkLoading = bulkCancel.isPending;
  const dripIntervalMinutes = agentSettings?.drip_settings?.interval_minutes || 5;
  const currentSentEmails = getSentEmailsForTab();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader pendingCount={pendingScheduled.length} />

      <main className={cn(
        "flex-1 overflow-auto pb-20 md:pb-0 transition-all duration-300",
        !isMobile && selectedProspect && activeTab === 'leads' && 'mr-[400px]'
      )}>
        <div className="p-4 md:p-6 space-y-4 md:space-y-5">

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds([]); setEmailSelectedIds(new Set()); }}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="leads" className="gap-2">
                <Users className="w-4 h-4" />
                <span>Leads</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{prospects.length.toLocaleString()}</Badge>
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-2">
                <Mail className="w-4 h-4" />
                <span>Emails</span>
                {pendingScheduled.length > 0 && (
                  <Badge className="ml-1 h-5 px-1.5 text-xs bg-primary text-primary-foreground">{pendingScheduled.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* =================== LEADS TAB =================== */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              {/* Header with actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-xl md:text-2xl">Leads</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {aiProspects.length.toLocaleString()} AI discovered • {manualProspects.length.toLocaleString()} uploaded
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CSVUploadDialog
                    teamMembers={teamMembers}
                    onImportProspects={async (prospects) => await addProspectsMutation.mutateAsync(prospects)}
                  />
                  <PhotoLeadCapture teamMembers={teamMembers} onAddProspect={handleAddProspect} variant="prominent" />
                  <AddProspectDialog teamMembers={teamMembers} onAddProspect={handleAddProspect} />
                </div>
              </div>

              {/* Source sub-tabs */}
              <Tabs value={leadSubTab} onValueChange={(v) => { setLeadSubTab(v); setSelectedIds([]); }}>
                <TabsList>
                  <TabsTrigger value="all-leads" className="gap-2">
                    <Users className="w-4 h-4" />
                    All Leads
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{prospects.length.toLocaleString()}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="called" className="gap-2">
                    <Phone className="w-4 h-4" />
                    Called
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{calledProspects.length.toLocaleString()}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Quick Stats Strip */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const contactedToday = prospects.filter(p => {
                  const activity = activityMap.get(p.id);
                  return activity?.lastActivityDate && activity.lastActivityDate >= today;
                }).length;
                const awaitingReply = prospects.filter(p => {
                  const activity = activityMap.get(p.id);
                  return activity?.emailStatus === 'sent' || activity?.emailStatus === 'opened';
                }).length;
                const hotLeads = prospects.filter(p => {
                  const activity = activityMap.get(p.id);
                  return activity?.emailStatus === 'replied';
                }).length;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="p-3 border-border/60">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Leads</p>
                          <p className="text-sm font-semibold">{prospects.length.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 border-border/60">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Contacted Today</p>
                          <p className="text-sm font-semibold">{contactedToday.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 border-border/60">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Awaiting Reply</p>
                          <p className="text-sm font-semibold">{awaitingReply.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔥</span>
                        <div>
                          <p className="text-xs text-muted-foreground">Hot Leads</p>
                          <p className="text-sm font-semibold">{hotLeads.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })()}

              {/* Filters */}
              <ProspectFilters
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                assigneeFilter={assigneeFilter}
                onAssigneeChange={setAssigneeFilter}
                teamMembers={teamMembers}
                industryFilter={industryFilter}
                onIndustryChange={setIndustryFilter}
                industries={industries}
                sourceFilter={sourceFilter}
                onSourceChange={setSourceFilter}
                dateContactedFrom={dateContactedFrom}
                onDateContactedFromChange={setDateContactedFrom}
                dateContactedTo={dateContactedTo}
                onDateContactedToChange={setDateContactedTo}
              />

              {/* Count */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {filteredProspects.length.toLocaleString()} of {currentProspects.length.toLocaleString()} prospects
                </span>
                {selectedIds.length > 0 && (
                  <span className="text-sm font-medium text-primary">{selectedIds.length} selected</span>
                )}
              </div>

              {/* Follow-Up Widget (shown on Called tab) */}
              {leadSubTab === 'called' && (
                <FollowUpWidget onProspectClick={setSelectedProspectId} />
              )}

              {/* Prospect Table */}
              {filteredProspects.length > 0 ? (
                <ProspectTable
                  prospects={filteredProspects}
                  teamMembers={teamMembers}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onProspectClick={setSelectedProspectId}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteProspect}
                  onAssign={(id, assignedTo) => {
                    updateProspectMutation.mutate({ id, updates: { assignedTo: assignedTo || '' } });
                  }}
                  showCallColumns={leadSubTab === 'called'}
                  callSummaryMap={callSummaryMap}
                  activityMap={activityMap}
                />
              ) : (
                <EmptyState
                  title="No leads found"
                  description="Try adjusting your filters or add new leads."
                />
              )}
            </div>
          )}

          {/* =================== EMAILS TAB =================== */}
          {activeTab === 'emails' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-xl md:text-2xl">Emails</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {pendingScheduled.length} in drip queue • {allSentEmails.length} sent
                  </p>
                </div>
              </div>

              <Tabs value={emailSubTab} onValueChange={(v) => { setEmailSubTab(v); setEmailSelectedIds(new Set()); }}>
                <TabsList>
                  <TabsTrigger value="drip" className="gap-2">
                    Drip Queue
                    {pendingScheduled.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-xs bg-primary text-primary-foreground">{pendingScheduled.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="sent-tracking">
                    Sent ({allSentEmails.length})
                  </TabsTrigger>
                  <TabsTrigger value="cancelled">
                    Cancelled ({cancelledScheduled.length})
                  </TabsTrigger>
                  <TabsTrigger value="follow-ups" className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Follow-Ups
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Drip queue content */}
              {emailSubTab === 'drip' && (
                <div className="space-y-3 pb-24">
                  {pendingScheduled.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>No emails in drip queue</p>
                      <p className="text-sm mt-1">New emails are auto-scheduled when the agent discovers businesses</p>
                    </div>
                  ) : (
                    pendingScheduled.map((item) => (
                      <Card key={item.id} className={cn(
                        "hover:shadow-md transition-shadow",
                        emailSelectedIds.has(item.id) && "border-primary ring-1 ring-primary"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={emailSelectedIds.has(item.id)}
                              onCheckedChange={(checked) => handleEmailToggleSelect(item.id, !!checked)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium truncate">{item.prospects?.business_name || 'Unknown Business'}</h3>
                                  <p className="text-sm text-muted-foreground truncate">{item.to_email}</p>
                                </div>
                                <DripCountdown scheduledFor={item.scheduled_for} />
                              </div>
                              <p className="text-sm font-medium truncate">{item.subject}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.body.substring(0, 150)}...</p>
                              <div className="flex items-center justify-end gap-2 mt-2">
                                <Button variant="ghost" size="sm" onClick={() => handleCancelEmail(item.id)} disabled={cancelEmail.isPending} className="text-destructive hover:text-destructive">
                                  <X className="h-4 w-4 mr-1" /> Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* Cancelled tab */}
              {emailSubTab === 'cancelled' && (
                <div className="space-y-3">
                  {cancelledScheduled.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground"><p>No cancelled emails</p></div>
                  ) : (
                    cancelledScheduled.map((item) => (
                      <Card key={item.id} className="opacity-60">
                        <CardContent className="p-4">
                          <h3 className="font-medium truncate">{item.prospects?.business_name || item.to_email}</h3>
                          <p className="text-sm truncate">{item.subject}</p>
                          <Badge variant="destructive" className="mt-1">Cancelled</Badge>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* Follow-Ups dashboard */}
              {emailSubTab === 'follow-ups' && (
                <FollowUpDashboard />
              )}

              {/* Sent emails tracking */}
              {emailSubTab === 'sent-tracking' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-end gap-3">
                    {syncResult && (
                      <span className="text-xs text-muted-foreground">
                        Last sync: {syncResult.updated} updated, {syncResult.unchanged} unchanged
                        {syncResult.failed > 0 && `, ${syncResult.failed} failed`}
                        {syncResult.remaining > 0 && ` • ${syncResult.remaining} remaining`}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setSyncingEmails(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('sync-email-stats', {
                            body: { forceAll: false, batchSize: 50, maxBatches: 20 },
                          });
                          if (error) throw error;
                          setSyncResult(data);
                          toast.success(`Synced: ${data?.updated || 0} updated, ${data?.remaining || 0} remaining`);
                        } catch {
                          toast.error('Failed to sync email stats');
                        } finally {
                          setSyncingEmails(false);
                        }
                      }}
                      disabled={syncingEmails}
                      className="gap-2"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", syncingEmails && "animate-spin")} />
                      {syncingEmails ? 'Syncing...' : syncResult?.remaining ? `Sync ${syncResult.remaining} Remaining` : 'Sync from Resend'}
                    </Button>
                  </div>
                  <Tabs value={sentSubTab} onValueChange={setSentSubTab}>
                    <TabsList>
                      <TabsTrigger value="all">All ({allSentEmails.length})</TabsTrigger>
                      <TabsTrigger value="opened" className="gap-1">
                        <Eye className="h-3 w-3" />
                        Opened ({openedEmails.length})
                      </TabsTrigger>
                      <TabsTrigger value="clicked" className="gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        Clicked ({clickedEmails.length})
                      </TabsTrigger>
                      <TabsTrigger value="hot-leads" className="gap-1">
                        🔥 Hot Leads ({repliedEmails.length})
                      </TabsTrigger>
                      <TabsTrigger value="no-response">No Response ({noResponseEmails.length})</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {currentSentEmails.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No emails in this category</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {currentSentEmails.map((sentEmail) => (
                        <SentEmailCard
                          key={sentEmail.id}
                          email={sentEmail}
                          onClick={() => setSelectedSentEmail(sentEmail)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================== ANALYTICS TAB =================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Follow-Up Widget */}
              <FollowUpWidget onProspectClick={(id) => { setActiveTab('leads'); setSelectedProspectId(id); }} />

              {/* Lead Stats */}
              <DashboardStats prospects={prospects} />

              {/* Agent Activity */}
              <AgentActivityWidget
                agentRuns={agentRuns}
                pendingEmailCount={pendingScheduled.length}
                isRunning={isRunning}
              />

              {/* Email Analytics */}
              <OutreachAnalytics />
            </div>
          )}

          {/* =================== SETTINGS TAB =================== */}
          {activeTab === 'settings' && (
            <OutreachSettings />
          )}
        </div>
      </main>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} pendingCount={pendingScheduled.length} />

      {/* Prospect Bulk Actions */}
      {activeTab === 'leads' && (
        <BulkActionsBar
          selectedIds={selectedIds}
          prospects={filteredProspects}
          onClearSelection={() => setSelectedIds([])}
          onSelectAll={() => setSelectedIds(filteredProspects.map(p => p.id))}
          onStatusChange={handleBulkStatusChange}
          totalCount={filteredProspects.length}
        />
      )}

      {/* Email Bulk Actions */}
      {activeTab === 'emails' && emailSubTab === 'drip' && emailSelectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-background border border-border rounded-lg shadow-lg px-4 py-3">
            <span className="text-sm font-medium">{emailSelectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setEmailSelectedIds(new Set())} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={handleEmailSelectAll} disabled={emailSelectedIds.size === pendingScheduled.length}>
              Select All ({pendingScheduled.length})
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="outline" size="sm" onClick={handleEmailCancelAll} disabled={isBulkLoading} className="text-destructive hover:text-destructive">
              {isBulkLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
              Cancel Selected
            </Button>
          </div>
        </div>
      )}

      <QuickCaptureButton onCapture={handleQuickCapture} isProcessing={isProcessing} />

      {/* Mobile Detail Sheet */}
      {isMobile && selectedProspect && activeTab === 'leads' && (
        <MobileProspectSheet
          prospect={selectedProspect} teamMembers={teamMembers}
          onClose={() => setSelectedProspectId(null)}
          onStatusChange={(status) => handleStatusChange(selectedProspect.id, status)}
          onToggleQuoting={() => handleToggleQuoting(selectedProspect.id)}
          onTaskComplete={(taskId) => handleTaskComplete(selectedProspect.id, taskId)}
          onUpdate={(updates) => handleUpdateProspect(selectedProspect.id, updates)}
          onDelete={() => handleDeleteProspect(selectedProspect.id)}
        />
      )}

      {/* Desktop Detail Panel */}
      {!isMobile && selectedProspect && activeTab === 'leads' && (
        <aside className="fixed right-0 top-0 bottom-0 w-[400px] border-l border-border bg-card overflow-hidden z-10">
          <ProspectDetail
            prospect={selectedProspect} teamMembers={teamMembers}
            onClose={() => setSelectedProspectId(null)}
            onStatusChange={(status) => handleStatusChange(selectedProspect.id, status)}
            onToggleQuoting={() => handleToggleQuoting(selectedProspect.id)}
            onTaskComplete={(taskId) => handleTaskComplete(selectedProspect.id, taskId)}
            onUpdate={(updates) => handleUpdateProspect(selectedProspect.id, updates)}
            onDelete={() => handleDeleteProspect(selectedProspect.id)}
          />
        </aside>
      )}

      {/* Email Preview Dialog */}
      {selectedEmail && (
        <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">To</Label>
                <p className="font-medium mt-1">{selectedEmail.to_email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Subject</Label>
                <p className="font-medium mt-1">{selectedEmail.subject}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Body</Label>
                <div className="mt-2 p-4 bg-muted/50 rounded-lg whitespace-pre-wrap text-sm">
                  {selectedEmail.body}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Sent Email Detail Dialog */}
      <Dialog open={!!selectedSentEmail} onOpenChange={(open) => !open && setSelectedSentEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedSentEmail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={selectedSentEmail.open_count > 0 ? 'default' : 'secondary'}>
                  {selectedSentEmail.open_count > 0 ? 'Opened' : 'Not Opened'}
                </Badge>
                {selectedSentEmail.click_count > 0 && (
                  <Badge variant="default">Clicked</Badge>
                )}
                {(selectedSentEmail.status === 'replied' || selectedSentEmail.replied_at) && (
                  <Badge variant="default" className="bg-orange-600 hover:bg-orange-700">🔥 Replied</Badge>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To:</span>
                  <span>{selectedSentEmail.to_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business:</span>
                  <span>{selectedSentEmail.prospects?.business_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent:</span>
                  <span>{format(new Date(selectedSentEmail.sent_at), 'PPp')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opens:</span>
                  <span>{selectedSentEmail.open_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clicks:</span>
                  <span>{selectedSentEmail.click_count}</span>
                </div>
              </div>

              {/* Their Reply */}
              {selectedSentEmail.reply_text && (
                <div className="border border-orange-200 dark:border-orange-800/40 rounded-lg p-4 bg-orange-50/50 dark:bg-orange-950/20">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    💬 Their Reply
                  </h4>
                  <p className="text-sm whitespace-pre-wrap text-foreground">
                    {selectedSentEmail.reply_text}
                  </p>
                  {selectedSentEmail.replied_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Replied {format(new Date(selectedSentEmail.replied_at), 'PPp')}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-4">
                <h4 className="font-medium mb-2">{selectedSentEmail.subject}</h4>
                <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {selectedSentEmail.body}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-lg mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Review Captured Info
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Business Name *</Label>
              <Input value={businessName} onChange={e => setBusinessName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Name</Label>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input value={location} onChange={e => setLocation(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleQuickSave} className="w-full">Save Prospect</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
