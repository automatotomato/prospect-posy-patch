import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProspectStatus, TeamMember, LeadSource } from '@/types/prospect';
import { Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProspectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: ProspectStatus | 'all';
  onStatusChange: (value: ProspectStatus | 'all') => void;
  assigneeFilter: string;
  onAssigneeChange: (value: string) => void;
  teamMembers: TeamMember[];
  industryFilter?: string;
  onIndustryChange?: (value: string) => void;
  industries?: string[];
  sourceFilter?: LeadSource | 'all';
  onSourceChange?: (value: LeadSource | 'all') => void;
  dateContactedFrom?: Date;
  onDateContactedFromChange?: (date: Date | undefined) => void;
  dateContactedTo?: Date;
  onDateContactedToChange?: (date: Date | undefined) => void;
}

const statusOptions: { value: ProspectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'closed', label: 'Closed' },
];

const sourceOptions: { value: LeadSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'field_photo', label: 'Field Photo' },
  { value: 'email', label: 'Email' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'csv_import', label: 'CSV Import' },
];

function formatIndustryLabel(industry: string): string {
  return industry
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ProspectFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  assigneeFilter,
  onAssigneeChange,
  teamMembers,
  industryFilter = 'all',
  onIndustryChange,
  industries = [],
  sourceFilter = 'all',
  onSourceChange,
  dateContactedFrom,
  onDateContactedFromChange,
  dateContactedTo,
  onDateContactedToChange,
}: ProspectFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search businesses, contacts, locations..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as ProspectStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onSourceChange && (
          <Select value={sourceFilter} onValueChange={(v) => onSourceChange(v as LeadSource | 'all')}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Assigned to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {teamMembers.map(member => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {onIndustryChange && industries.length > 0 && (
          <Select value={industryFilter} onValueChange={onIndustryChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map(ind => (
                <SelectItem key={ind} value={ind}>
                  {formatIndustryLabel(ind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {onDateContactedFromChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn(
                "w-full sm:w-[160px] justify-start text-left font-normal",
                !dateContactedFrom && "text-muted-foreground"
              )}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateContactedFrom ? format(dateContactedFrom, 'MMM d, yyyy') : 'From date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateContactedFrom}
                onSelect={onDateContactedFromChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}

        {onDateContactedToChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn(
                "w-full sm:w-[160px] justify-start text-left font-normal",
                !dateContactedTo && "text-muted-foreground"
              )}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateContactedTo ? format(dateContactedTo, 'MMM d, yyyy') : 'To date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateContactedTo}
                onSelect={onDateContactedToChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}

        {(dateContactedFrom || dateContactedTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onDateContactedFromChange?.(undefined);
              onDateContactedToChange?.(undefined);
            }}
            className="h-10 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Clear dates
          </Button>
        )}
      </div>
    </div>
  );
}
