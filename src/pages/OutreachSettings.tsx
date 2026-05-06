import { useState, useEffect } from 'react';
import { Save, Loader2, Plus, X, MapPin, Clock, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AgentControlPanel } from '@/components/AgentControlPanel';
import { useRunAgent, useAgentRuns } from '@/hooks/useOutreachQueue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  useAgentSettings, 
  useUpdateScheduleSettings, 
  useUpdateDiscoverySettings,
  useUpdateBusinessTypes,
  useUpdateDripSettings,
  ScheduleSettings,
  DiscoverySettings,
  DripSettings
} from '@/hooks/useAgentSettings';
import { toast } from 'sonner';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'UTC', label: 'UTC' },
];

// Business types organized by industry category
const BUSINESS_TYPE_OPTIONS = [
  // Home Services
  { value: 'plumber', label: 'Plumbers', category: 'Home Services' },
  { value: 'hvac_contractor', label: 'HVAC Contractors', category: 'Home Services' },
  { value: 'electrician', label: 'Electricians', category: 'Home Services' },
  { value: 'general_contractor', label: 'General Contractors', category: 'Home Services' },
  { value: 'roofing_contractor', label: 'Roofing Contractors', category: 'Home Services' },
  { value: 'landscaper', label: 'Landscapers', category: 'Home Services' },
  { value: 'painter', label: 'Painters', category: 'Home Services' },
  { value: 'cleaning_service', label: 'Cleaning Services', category: 'Home Services' },
  { value: 'carpet_cleaner', label: 'Carpet Cleaners', category: 'Home Services' },
  { value: 'pest_control', label: 'Pest Control', category: 'Home Services' },
  { value: 'pool_service', label: 'Pool Services', category: 'Home Services' },
  { value: 'garage_door_repair', label: 'Garage Door Repair', category: 'Home Services' },
  { value: 'appliance_repair', label: 'Appliance Repair', category: 'Home Services' },
  { value: 'flooring_contractor', label: 'Flooring Contractors', category: 'Home Services' },
  { value: 'window_installer', label: 'Window Installers', category: 'Home Services' },
  { value: 'fence_contractor', label: 'Fence Contractors', category: 'Home Services' },
  { value: 'solar_installer', label: 'Solar Installers', category: 'Home Services' },
  { value: 'home_inspector', label: 'Home Inspectors', category: 'Home Services' },
  { value: 'handyman', label: 'Handyman Services', category: 'Home Services' },
  { value: 'tree_service', label: 'Tree Services', category: 'Home Services' },
  
  // Medical & Dental
  { value: 'dental_office', label: 'Dental Offices', category: 'Medical & Dental' },
  { value: 'medical_clinic', label: 'Medical Clinics', category: 'Medical & Dental' },
  { value: 'chiropractor', label: 'Chiropractors', category: 'Medical & Dental' },
  { value: 'physical_therapy', label: 'Physical Therapy', category: 'Medical & Dental' },
  { value: 'veterinarian', label: 'Veterinarians', category: 'Medical & Dental' },
  { value: 'optometrist', label: 'Optometrists', category: 'Medical & Dental' },
  { value: 'orthodontist', label: 'Orthodontists', category: 'Medical & Dental' },
  { value: 'dermatologist', label: 'Dermatologists', category: 'Medical & Dental' },
  { value: 'urgent_care', label: 'Urgent Care Centers', category: 'Medical & Dental' },
  { value: 'mental_health', label: 'Mental Health Clinics', category: 'Medical & Dental' },
  
  // Beauty & Wellness
  { value: 'hair_salon', label: 'Hair Salons', category: 'Beauty & Wellness' },
  { value: 'barber_shop', label: 'Barber Shops', category: 'Beauty & Wellness' },
  { value: 'med_spa', label: 'Med Spas', category: 'Beauty & Wellness' },
  { value: 'day_spa', label: 'Day Spas', category: 'Beauty & Wellness' },
  { value: 'nail_salon', label: 'Nail Salons', category: 'Beauty & Wellness' },
  { value: 'massage_therapy', label: 'Massage Therapy', category: 'Beauty & Wellness' },
  { value: 'tattoo_parlor', label: 'Tattoo Parlors', category: 'Beauty & Wellness' },
  { value: 'fitness_studio', label: 'Fitness Studios', category: 'Beauty & Wellness' },
  { value: 'yoga_studio', label: 'Yoga Studios', category: 'Beauty & Wellness' },
  { value: 'personal_trainer', label: 'Personal Trainers', category: 'Beauty & Wellness' },
  
  // Automotive
  { value: 'auto_repair', label: 'Auto Repair Shops', category: 'Automotive' },
  { value: 'towing_service', label: 'Towing Services', category: 'Automotive' },
  { value: 'auto_body_shop', label: 'Auto Body Shops', category: 'Automotive' },
  { value: 'tire_shop', label: 'Tire Shops', category: 'Automotive' },
  { value: 'car_dealership', label: 'Car Dealerships', category: 'Automotive' },
  { value: 'auto_detailing', label: 'Auto Detailing', category: 'Automotive' },
  { value: 'oil_change', label: 'Oil Change Services', category: 'Automotive' },
  { value: 'transmission_repair', label: 'Transmission Repair', category: 'Automotive' },
  { value: 'car_wash', label: 'Car Washes', category: 'Automotive' },
  { value: 'motorcycle_repair', label: 'Motorcycle Repair', category: 'Automotive' },
  
  // Professional Services
  { value: 'law_firm', label: 'Law Firms', category: 'Professional Services' },
  { value: 'accounting_firm', label: 'Accounting Firms', category: 'Professional Services' },
  { value: 'insurance_agency', label: 'Insurance Agencies', category: 'Professional Services' },
  { value: 'real_estate_agent', label: 'Real Estate Agents', category: 'Professional Services' },
  { value: 'property_management', label: 'Property Management', category: 'Professional Services' },
  { value: 'mortgage_broker', label: 'Mortgage Brokers', category: 'Professional Services' },
  { value: 'financial_advisor', label: 'Financial Advisors', category: 'Professional Services' },
  { value: 'tax_preparer', label: 'Tax Preparers', category: 'Professional Services' },
  { value: 'notary', label: 'Notary Services', category: 'Professional Services' },
  { value: 'marketing_agency', label: 'Marketing Agencies', category: 'Professional Services' },
  
  // Food & Hospitality
  { value: 'restaurant', label: 'Restaurants', category: 'Food & Hospitality' },
  { value: 'catering', label: 'Catering Services', category: 'Food & Hospitality' },
  { value: 'bakery', label: 'Bakeries', category: 'Food & Hospitality' },
  { value: 'food_truck', label: 'Food Trucks', category: 'Food & Hospitality' },
  { value: 'event_venue', label: 'Event Venues', category: 'Food & Hospitality' },
  { value: 'hotel', label: 'Hotels', category: 'Food & Hospitality' },
  { value: 'bed_and_breakfast', label: 'Bed & Breakfasts', category: 'Food & Hospitality' },
  
  // Other Services
  { value: 'locksmith', label: 'Locksmiths', category: 'Other Services' },
  { value: 'moving_company', label: 'Moving Companies', category: 'Other Services' },
  { value: 'storage_facility', label: 'Storage Facilities', category: 'Other Services' },
  { value: 'photography', label: 'Photography Studios', category: 'Other Services' },
  { value: 'wedding_planner', label: 'Wedding Planners', category: 'Other Services' },
  { value: 'pet_grooming', label: 'Pet Grooming', category: 'Other Services' },
  { value: 'dog_trainer', label: 'Dog Trainers', category: 'Other Services' },
  { value: 'daycare', label: 'Daycare Centers', category: 'Other Services' },
  { value: 'tutoring', label: 'Tutoring Services', category: 'Other Services' },
  { value: 'music_lessons', label: 'Music Lessons', category: 'Other Services' },
  { value: 'driving_school', label: 'Driving Schools', category: 'Other Services' },
  { value: 'funeral_home', label: 'Funeral Homes', category: 'Other Services' },
];

// Group options by category for organized display
const BUSINESS_TYPE_CATEGORIES = BUSINESS_TYPE_OPTIONS.reduce((acc, type) => {
  const category = type.category || 'Other';
  if (!acc[category]) acc[category] = [];
  acc[category].push(type);
  return acc;
}, {} as Record<string, typeof BUSINESS_TYPE_OPTIONS>);

export default function OutreachSettings() {
  const { data: settings, isLoading } = useAgentSettings();
  const updateSchedule = useUpdateScheduleSettings();
  const updateDiscovery = useUpdateDiscoverySettings();
  const updateBusinessTypes = useUpdateBusinessTypes();
  const updateDripSettings = useUpdateDripSettings();
  const runAgentMutation = useRunAgent();
  const { data: agentRuns = [] } = useAgentRuns();
  const latestRun = agentRuns[0];
  const isAgentActive = runAgentMutation.isPending || latestRun?.status === 'running';

  const [schedule, setSchedule] = useState<ScheduleSettings>({
    enabled: true,
    hour: 9,
    minute: 0,
    timezone: 'America/Los_Angeles',
  });

  const [discovery, setDiscovery] = useState<DiscoverySettings>({
    location: 'Las Vegas, NV',
    locations: ['Las Vegas, NV'],
    targetCount: 50,
  });

  const [newLocation, setNewLocation] = useState('');

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [customTypeInput, setCustomTypeInput] = useState('');

  const [dripSettings, setDripSettings] = useState<DripSettings>({
    enabled: true,
    interval_minutes: 5,
    max_per_hour: 12,
  });

  const [recrawling, setRecrawling] = useState(false);
  const [recrawlLimit, setRecrawlLimit] = useState(50);
  const [recrawlProgress, setRecrawlProgress] = useState<{
    processed: number;
    updated: number;
    noChange: number;
    noEmailFound: number;
    errors: number;
  } | null>(null);

  type SenderStatus = {
    ok: boolean;
    verified: boolean;
    status: string;
    domain: string;
    senderEmail: string;
    message: string;
    checkedAt?: string;
  };
  const [senderStatus, setSenderStatus] = useState<SenderStatus | null>(null);
  const [checkingSender, setCheckingSender] = useState(false);

  const checkSenderDomain = async (force = false) => {
    setCheckingSender(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-sender-domain', {
        body: force ? { force: true } : undefined,
      });
      if (error) throw error;
      setSenderStatus(data as SenderStatus);
      if (force) {
        if (data?.ok) toast.success(data.message);
        else toast.error(data?.message || 'Sender domain not verified');
      }
    } catch (e) {
      console.error('Sender domain check failed:', e);
      toast.error(`Could not check sender domain: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCheckingSender(false);
    }
  };

  useEffect(() => {
    checkSenderDomain(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecrawlAll = async () => {
    setRecrawling(true);
    setRecrawlProgress({ processed: 0, updated: 0, noChange: 0, noEmailFound: 0, errors: 0 });
    try {
      const totals = { processed: 0, updated: 0, noChange: 0, noEmailFound: 0, errors: 0 };

      while (totals.processed < recrawlLimit) {
        const nextLimit = Math.min(3, recrawlLimit - totals.processed);
        const { data, error } = await supabase.functions.invoke('recrawl-prospect-websites', {
          body: { limit: nextLimit },
        });
        if (error) throw error;

        const s = data?.summary || {};
        const processed = Number(s.processed || 0);
        totals.processed += processed;
        totals.updated += Number(s.updated || 0);
        totals.noChange += Number(s.noChange || 0);
        totals.noEmailFound += Number(s.noEmailFound || 0);
        totals.errors += Number(s.errors || 0);
        setRecrawlProgress({ ...totals });

        if (processed === 0) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      toast.success(
        `Recrawl complete: ${totals.updated} updated, ${totals.noChange} unchanged, ${totals.noEmailFound} no email, ${totals.errors} errors`,
        { duration: 8000 }
      );
    } catch (e) {
      console.error('Recrawl failed:', e);
      toast.error(`Recrawl failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setRecrawling(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setSchedule(settings.schedule);
      // Handle legacy single location by converting to locations array
      const discoveryWithLocations = {
        ...settings.discovery,
        locations: settings.discovery.locations || 
          (settings.discovery.location ? [settings.discovery.location] : ['Las Vegas, NV']),
      };
      setDiscovery(discoveryWithLocations);
      setSelectedTypes(settings.business_types);
      if (settings.drip_settings) {
        setDripSettings(settings.drip_settings);
      }
    }
  }, [settings]);

  const addLocation = () => {
    if (newLocation.trim() && !discovery.locations.includes(newLocation.trim())) {
      setDiscovery({
        ...discovery,
        locations: [...discovery.locations, newLocation.trim()],
      });
      setNewLocation('');
    }
  };

  const removeLocation = (location: string) => {
    if (discovery.locations.length > 1) {
      setDiscovery({
        ...discovery,
        locations: discovery.locations.filter(l => l !== location),
      });
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await updateSchedule.mutateAsync(schedule);
      toast.success('Schedule settings saved');
    } catch (error) {
      toast.error('Failed to save schedule settings');
    }
  };

  const handleSaveDiscovery = async () => {
    try {
      await updateDiscovery.mutateAsync(discovery);
      toast.success('Discovery settings saved');
    } catch (error) {
      toast.error('Failed to save discovery settings');
    }
  };

  const handleSaveBusinessTypes = async () => {
    try {
      await updateBusinessTypes.mutateAsync(selectedTypes);
      toast.success('Business types saved');
    } catch (error) {
      toast.error('Failed to save business types');
    }
  };

  const toggleBusinessType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Agent Settings</h1>
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isAgentActive ? 'animate-ping bg-green-400' : ''}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isAgentActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </span>
            <Badge variant="outline" className="text-xs">
              {isAgentActive ? 'Active' : 'Idle'}
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground">Configure your outreach automation</p>
      </div>

      {/* Run Agent */}
      <AgentControlPanel
        isRunning={runAgentMutation.isPending}
        onRunAgent={() => runAgentMutation.mutate()}
      />

      {/* Schedule Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Configure when the agent runs automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Daily Automation</Label>
              <p className="text-sm text-muted-foreground">
                Automatically discover businesses and generate emails
              </p>
            </div>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(enabled) => setSchedule({ ...schedule, enabled })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Hour</Label>
              <Select
                value={schedule.hour.toString()}
                onValueChange={(value) => setSchedule({ ...schedule, hour: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Minute</Label>
              <Select
                value={schedule.minute.toString()}
                onValueChange={(value) => setSchedule({ ...schedule, minute: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 15, 30, 45].map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      :{m.toString().padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={schedule.timezone}
                onValueChange={(timezone) => setSchedule({ ...schedule, timezone })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSaveSchedule} disabled={updateSchedule.isPending}>
            {updateSchedule.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Schedule
          </Button>
        </CardContent>
      </Card>

      {/* Discovery Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Discovery</CardTitle>
          <CardDescription>Configure business discovery parameters. The agent rotates through locations daily.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Target Locations (rotates daily)</Label>
            
            {/* Current locations */}
            <div className="flex flex-wrap gap-2">
              {discovery.locations.map((location, index) => (
                <Badge 
                  key={location} 
                  variant="secondary" 
                  className="flex items-center gap-1 px-3 py-1.5"
                >
                  <MapPin className="h-3 w-3" />
                  <span>{location}</span>
                  {index === 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">(next)</span>
                  )}
                  {discovery.locations.length > 1 && (
                    <button
                      onClick={() => removeLocation(location)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>

            {/* Add new location */}
            <div className="flex gap-2">
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Add a city, e.g., Phoenix, AZ"
                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addLocation}
                disabled={!newLocation.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Each day the agent picks the next location in the list. After the last location, it starts over.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Target Businesses per Run</Label>
              <span className="text-sm font-medium">{discovery.targetCount}</span>
            </div>
            <Slider
              value={[discovery.targetCount]}
              onValueChange={([value]) => setDiscovery({ ...discovery, targetCount: value })}
              min={10}
              max={100}
              step={10}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of businesses to discover per run
            </p>
          </div>

          <Button onClick={handleSaveDiscovery} disabled={updateDiscovery.isPending}>
            {updateDiscovery.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Discovery Settings
          </Button>
        </CardContent>
      </Card>

      {/* Sender Domain Status */}
      <Card>
        <CardHeader>
          <CardTitle>Sender Domain</CardTitle>
          <CardDescription>
            Outbound emails are sent from <strong>marketing@automateplanet.com</strong>. The domain must be verified in Resend before any send works.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {senderStatus ? (
            <div
              className={`flex items-start gap-3 rounded-md border p-4 ${
                senderStatus.ok
                  ? 'border-green-500/30 bg-green-500/10 text-green-900 dark:text-green-200'
                  : 'border-destructive/40 bg-destructive/10 text-destructive'
              }`}
            >
              {senderStatus.ok ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {senderStatus.ok ? 'Verified' : 'Not verified'}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    status: {senderStatus.status}
                  </Badge>
                </div>
                <p className="text-sm">{senderStatus.message}</p>
                {senderStatus.checkedAt && (
                  <p className="text-xs opacity-70">
                    Last checked: {new Date(senderStatus.checkedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {checkingSender ? 'Checking sender domain…' : 'Sender domain status unknown.'}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => checkSenderDomain(true)}
            disabled={checkingSender}
          >
            {checkingSender ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-check sender domain
          </Button>
        </CardContent>
      </Card>

      {/* Lead Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Maintenance</CardTitle>
          <CardDescription>
            Re-scrape prospect websites with Firecrawl + OpenAI to refresh decision-maker emails and reduce bounces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prospects per batch</Label>
              <span className="text-sm font-medium">{recrawlLimit}</span>
            </div>
            <Slider
              value={[recrawlLimit]}
              onValueChange={([value]) => setRecrawlLimit(value)}
              min={10}
              max={200}
              step={10}
              disabled={recrawling}
            />
            <p className="text-sm text-muted-foreground">
              Processes unchecked prospect websites in timeout-safe chunks. Skips DNC and unsubscribed leads.
            </p>
          </div>

          {recrawlProgress && (
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <div><span className="font-medium">{recrawlProgress.processed}</span> processed</div>
              <div><span className="font-medium">{recrawlProgress.updated}</span> updated</div>
              <div><span className="font-medium">{recrawlProgress.noChange}</span> unchanged</div>
              <div><span className="font-medium">{recrawlProgress.noEmailFound}</span> no email</div>
              <div><span className="font-medium">{recrawlProgress.errors}</span> errors</div>
            </div>
          )}

          <Button onClick={handleRecrawlAll} disabled={recrawling}>
            {recrawling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {recrawling ? 'Recrawling…' : 'Recrawl All Lead Websites'}
          </Button>
        </CardContent>
      </Card>

      {/* Business Types */}
      <Card>
        <CardHeader>
          <CardTitle>Business Types</CardTitle>
          <CardDescription>
            Select which types of businesses to target ({selectedTypes.length} selected)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTypes(BUSINESS_TYPE_OPTIONS.map(t => t.value))}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTypes([])}
            >
              Clear All
            </Button>
            {Object.keys(BUSINESS_TYPE_CATEGORIES).map((category) => (
              <Button
                key={category}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const categoryTypes = BUSINESS_TYPE_CATEGORIES[category].map(t => t.value);
                  const allSelected = categoryTypes.every(t => selectedTypes.includes(t));
                  if (allSelected) {
                    setSelectedTypes(prev => prev.filter(t => !categoryTypes.includes(t)));
                  } else {
                    setSelectedTypes(prev => [...new Set([...prev, ...categoryTypes])]);
                  }
                }}
              >
                {BUSINESS_TYPE_CATEGORIES[category].every(t => selectedTypes.includes(t.value)) ? '−' : '+'} {category}
              </Button>
            ))}
          </div>

          <div className="space-y-6">
            {Object.entries(BUSINESS_TYPE_CATEGORIES).map(([category, types]) => (
              <div key={category} className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
                  {category} ({types.filter(t => selectedTypes.includes(t.value)).length}/{types.length})
                </h4>
                <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {types.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={type.value}
                        checked={selectedTypes.includes(type.value)}
                        onCheckedChange={() => toggleBusinessType(type.value)}
                      />
                      <Label htmlFor={type.value} className="cursor-pointer text-sm">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Custom Types */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
              Custom Types
            </h4>
            
            {(() => {
              const presetValues = new Set(BUSINESS_TYPE_OPTIONS.map(t => t.value));
              const customTypes = selectedTypes.filter(t => !presetValues.has(t));
              if (customTypes.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-2">
                  {customTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                      <span>{type}</span>
                      <button
                        onClick={() => setSelectedTypes(prev => prev.filter(t => t !== type))}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              );
            })()}

            <div className="flex gap-2">
              <Input
                value={customTypeInput}
                onChange={(e) => setCustomTypeInput(e.target.value)}
                placeholder="Type a business type, e.g. Golf Courses"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const formatted = customTypeInput.trim().toLowerCase().replace(/\s+/g, '_');
                    if (formatted && !selectedTypes.includes(formatted)) {
                      setSelectedTypes(prev => [...prev, formatted]);
                      setCustomTypeInput('');
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const formatted = customTypeInput.trim().toLowerCase().replace(/\s+/g, '_');
                  if (formatted && !selectedTypes.includes(formatted)) {
                    setSelectedTypes(prev => [...prev, formatted]);
                    setCustomTypeInput('');
                  }
                }}
                disabled={!customTypeInput.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              These custom types will be included in discovery alongside the selected preset types above.
            </p>
          </div>

          <Button onClick={handleSaveBusinessTypes} disabled={updateBusinessTypes.isPending}>
            {updateBusinessTypes.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Business Types
          </Button>
        </CardContent>
      </Card>

      {/* Drip Send Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Drip Send Settings</CardTitle>
              <CardDescription>Configure email sending to avoid spam filters</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Drip Sending</Label>
              <p className="text-sm text-muted-foreground">
                Space out email sends instead of sending all at once
              </p>
            </div>
            <Switch
              checked={dripSettings.enabled}
              onCheckedChange={(enabled) => setDripSettings({ ...dripSettings, enabled })}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Minutes Between Emails</Label>
              <span className="text-sm font-medium">{dripSettings.interval_minutes} min</span>
            </div>
            <Slider
              value={[dripSettings.interval_minutes]}
              onValueChange={([value]) => setDripSettings({ ...dripSettings, interval_minutes: value })}
              min={1}
              max={30}
              step={1}
            />
            <p className="text-sm text-muted-foreground">
              At {dripSettings.interval_minutes} min intervals, 50 emails would take ~{Math.ceil((50 * dripSettings.interval_minutes) / 60)} hours
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Max Emails Per Hour</Label>
              <span className="text-sm font-medium">{dripSettings.max_per_hour}</span>
            </div>
            <Slider
              value={[dripSettings.max_per_hour]}
              onValueChange={([value]) => setDripSettings({ ...dripSettings, max_per_hour: value })}
              min={1}
              max={60}
              step={1}
            />
          </div>

          <Button 
            onClick={async () => {
              try {
                await updateDripSettings.mutateAsync(dripSettings);
                toast.success('Drip settings saved');
              } catch (error) {
                toast.error('Failed to save drip settings');
              }
            }} 
            disabled={updateDripSettings.isPending}
          >
            {updateDripSettings.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Drip Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
