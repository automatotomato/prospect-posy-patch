import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, Loader2, Check, AlertCircle, Mail, Send, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Prospect, TeamMember } from '@/types/prospect';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CSVUploadDialogProps {
  teamMembers: TeamMember[];
  onImportProspects: (prospects: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>[]) => Promise<any>;
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  location: string;
  vehicle_count: string;
  notes: string;
}

const defaultMapping: ColumnMapping = {
  business_name: '',
  contact_name: '',
  phone: '',
  email: '',
  location: '',
  vehicle_count: '',
  notes: '',
};

export function CSVUploadDialog({ teamMembers, onImportProspects }: CSVUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'sending'>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(defaultMapping);
  const [isImporting, setIsImporting] = useState(false);
  const [sendEmails, setSendEmails] = useState(false);
  const [emailType, setEmailType] = useState('introduction');
  const [importedProspects, setImportedProspects] = useState<any[]>([]);
  const [emailProgress, setEmailProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  const resetForm = () => {
    setStep('upload');
    setCsvData([]);
    setHeaders([]);
    setMapping(defaultMapping);
    setSendEmails(false);
    setImportedProspects([]);
    setEmailProgress({ sent: 0, total: 0, failed: 0 });
  };

  const parseCSV = (text: string): { headers: string[]; rows: CSVRow[] } => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = parseRow(lines[i]);
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    }

    return { headers, rows };
  };

  const autoDetectMapping = (headers: string[]): ColumnMapping => {
    const newMapping = { ...defaultMapping };

    const businessPatterns = ['business', 'company', 'name', 'business_name', 'company_name', 'businessname'];
    const contactPatterns = ['contact', 'person', 'contact_name', 'contactname', 'owner'];
    const phonePatterns = ['phone', 'tel', 'telephone', 'mobile', 'cell'];
    const emailPatterns = ['email', 'e-mail', 'mail'];
    const locationPatterns = ['location', 'address', 'city', 'area', 'region'];
    const vehiclePatterns = ['vehicle', 'fleet', 'count', 'vehicles', 'vehicle_count'];
    const notesPatterns = ['notes', 'comments', 'description', 'details'];

    headers.forEach((header) => {
      const lower = header.toLowerCase();
      
      if (businessPatterns.some(p => lower.includes(p)) && !newMapping.business_name) {
        newMapping.business_name = header;
      } else if (contactPatterns.some(p => lower.includes(p)) && !newMapping.contact_name) {
        newMapping.contact_name = header;
      } else if (phonePatterns.some(p => lower.includes(p)) && !newMapping.phone) {
        newMapping.phone = header;
      } else if (emailPatterns.some(p => lower.includes(p)) && !newMapping.email) {
        newMapping.email = header;
      } else if (locationPatterns.some(p => lower.includes(p)) && !newMapping.location) {
        newMapping.location = header;
      } else if (vehiclePatterns.some(p => lower.includes(p)) && !newMapping.vehicle_count) {
        newMapping.vehicle_count = header;
      } else if (notesPatterns.some(p => lower.includes(p)) && !newMapping.notes) {
        newMapping.notes = header;
      }
    });

    return newMapping;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      
      setHeaders(headers);
      setCsvData(rows);
      setMapping(autoDetectMapping(headers));
      setStep('mapping');
      
      toast({
        title: "File loaded",
        description: `Found ${rows.length} rows with ${headers.length} columns.`,
      });
    } catch (error) {
      console.error('CSV parse error:', error);
      toast({
        title: "Parse error",
        description: "Could not parse CSV file. Check the format.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!mapping.business_name) {
      toast({
        title: "Missing mapping",
        description: "Business name column is required.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const agents = teamMembers.filter(m => m.role === 'agent');
      const assignedTo = agents[0]?.id || teamMembers[0]?.id;

      const prospects: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>[] = csvData
        .filter(row => row[mapping.business_name]?.trim())
        .map(row => ({
          businessName: row[mapping.business_name]?.trim() || '',
          contactName: mapping.contact_name ? row[mapping.contact_name]?.trim() || undefined : undefined,
          phone: mapping.phone ? row[mapping.phone]?.trim() || undefined : undefined,
          email: mapping.email ? row[mapping.email]?.trim() || undefined : undefined,
          location: mapping.location ? row[mapping.location]?.trim() || 'Unknown' : 'Unknown',
          vehicleCount: mapping.vehicle_count ? parseInt(row[mapping.vehicle_count]) || undefined : undefined,
          notes: mapping.notes ? row[mapping.notes]?.trim() || '' : '',
          status: 'new' as const,
          source: 'csv_import' as const,
          assignedTo,
          nextFollowUp: tomorrow,
          movedToQuoting: false,
        }));

      const result = await onImportProspects(prospects);
      
      // Store imported prospects with their IDs for email sending
      if (result && Array.isArray(result)) {
        setImportedProspects(result.map((p: any, i: number) => ({
          id: p.id,
          businessName: prospects[i].businessName,
          contactName: prospects[i].contactName,
          email: prospects[i].email,
          location: prospects[i].location,
          vehicleCount: prospects[i].vehicleCount,
          notes: prospects[i].notes,
        })));
      }

      toast({
        title: "Import successful",
        description: `Imported ${prospects.length} prospects.`,
      });

      if (sendEmails) {
        setStep('sending');
        await handleBatchSendEmails();
      } else {
        setOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "Could not import prospects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleBatchSendEmails = async () => {
    const prospectsWithEmail = importedProspects.filter(p => p.email && p.email.includes('@'));
    
    if (prospectsWithEmail.length === 0) {
      toast({
        title: "No emails to send",
        description: "None of the imported prospects have email addresses.",
        variant: "destructive",
      });
      setOpen(false);
      resetForm();
      return;
    }

    setIsSendingEmails(true);
    setEmailProgress({ sent: 0, total: prospectsWithEmail.length, failed: 0 });

    try {
      const { data, error } = await supabase.functions.invoke('batch-send-emails', {
        body: {
          prospects: prospectsWithEmail,
          emailType,
        }
      });

      if (error) throw error;

      if (data.success) {
        setEmailProgress({
          sent: data.summary.sent,
          total: data.summary.total,
          failed: data.summary.failed,
        });

        toast({
          title: "Emails sent!",
          description: `Sent ${data.summary.sent} of ${data.summary.total} emails.`,
        });

        // Close after a brief delay to show final progress
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 2000);
      }
    } catch (error) {
      console.error('Batch email error:', error);
      toast({
        title: "Email sending failed",
        description: "Could not send batch emails. Prospects were still imported.",
        variant: "destructive",
      });
      setOpen(false);
      resetForm();
    } finally {
      setIsSendingEmails(false);
    }
  };

  const previewData = csvData.slice(0, 5);
  const validRowCount = csvData.filter(row => row[mapping.business_name]?.trim()).length;
  const emailCount = mapping.email 
    ? csvData.filter(row => row[mapping.email]?.includes('@')).length 
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Import Leads from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with your previous leads to import them into the pipeline.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                "hover:border-primary/50 hover:bg-muted/50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Upload CSV file</p>
                  <p className="text-sm text-muted-foreground">
                    Click to browse or drag and drop
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                const csvContent = `business_name,contact_name,phone,email,location,vehicle_count,notes
Acme Trucking Co,John Smith,555-123-4567,john@acmetrucking.com,Las Vegas NV,15,Fleet renewal due Q2
Fast Delivery Inc,Jane Doe,555-987-6543,jane@fastdelivery.com,Henderson NV,8,Interested in cargo coverage
Mountain Logistics,Bob Johnson,555-456-7890,bob@mountainlogistics.com,Phoenix AZ,25,Current customer - upsell opportunity`;
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'prospects_template.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </Button>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium">Map your CSV columns</p>
              <p className="text-xs text-muted-foreground">
                Match your CSV columns to the required fields. Business name is required.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries({
                business_name: 'Business Name *',
                contact_name: 'Contact Name',
                phone: 'Phone',
                email: 'Email',
                location: 'Location',
                vehicle_count: 'Vehicle Count',
                notes: 'Notes',
              }).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Select
                    value={mapping[key as keyof ColumnMapping] || '__none__'}
                    onValueChange={(value) => setMapping(prev => ({ ...prev, [key]: value === '__none__' ? '' : value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- None --</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={() => setStep('preview')} disabled={!mapping.business_name}>
                Preview Import
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500" />
              <span>{validRowCount} valid rows ready to import</span>
              {emailCount > 0 && (
                <span className="text-muted-foreground">({emailCount} with emails)</span>
              )}
            </div>

            <ScrollArea className="h-[200px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Business</th>
                    <th className="text-left p-2 font-medium">Contact</th>
                    <th className="text-left p-2 font-medium">Email</th>
                    <th className="text-left p-2 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{row[mapping.business_name] || '-'}</td>
                      <td className="p-2">{mapping.contact_name ? row[mapping.contact_name] || '-' : '-'}</td>
                      <td className="p-2">{mapping.email ? row[mapping.email] || '-' : '-'}</td>
                      <td className="p-2">{mapping.phone ? row[mapping.phone] || '-' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            {csvData.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 5 of {csvData.length} rows
              </p>
            )}

            {/* Batch Email Option */}
            {emailCount > 0 && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sendEmails" 
                    checked={sendEmails}
                    onCheckedChange={(checked) => setSendEmails(checked === true)}
                  />
                  <label 
                    htmlFor="sendEmails" 
                    className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    Send introduction emails to {emailCount} prospects
                  </label>
                </div>
                
                {sendEmails && (
                  <div className="pl-6">
                    <Label className="text-xs">Email Type</Label>
                    <Select value={emailType} onValueChange={setEmailType}>
                      <SelectTrigger className="mt-1 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="introduction">Introduction</SelectItem>
                        <SelectItem value="quote">Quote Offer</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : sendEmails ? (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Import & Send Emails
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Import {validRowCount} Prospects
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'sending' && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <Mail className="w-12 h-12 mx-auto text-primary animate-pulse" />
              <p className="font-medium">Sending introduction emails...</p>
              <p className="text-sm text-muted-foreground">
                Please wait while we generate and send personalized emails.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  {emailProgress.sent} of {emailProgress.total} sent
                  {emailProgress.failed > 0 && (
                    <span className="text-destructive ml-2">
                      ({emailProgress.failed} failed)
                    </span>
                  )}
                </span>
              </div>
              <Progress 
                value={emailProgress.total > 0 ? (emailProgress.sent / emailProgress.total) * 100 : 0} 
              />
            </div>

            {!isSendingEmails && emailProgress.sent > 0 && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <Check className="w-5 h-5" />
                <span className="font-medium">Complete!</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
