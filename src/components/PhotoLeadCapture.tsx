import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { ExtractedLeadData, GeneratedEmail } from '@/types/extraction';
import { Prospect, TeamMember } from '@/types/prospect';
import { 
  Camera, Upload, Loader2, Sparkles, Mail, Copy, Check, Send,
  Building2, User, Phone, MapPin, Truck, FileText, Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PhotoLeadCaptureProps {
  teamMembers: TeamMember[];
  onAddProspect: (prospect: Omit<Prospect, 'id' | 'createdAt' | 'tasks'>) => void;
  variant?: 'default' | 'prominent';
}

export function PhotoLeadCapture({ teamMembers, onAddProspect, variant = 'default' }: PhotoLeadCaptureProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'email'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAutoSearching, setIsAutoSearching] = useState(false);
  const [showRetrySearch, setShowRetrySearch] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedLeadData | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [emailType, setEmailType] = useState('introduction');
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Editable fields
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [vehicleCount, setVehicleCount] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setStep('upload');
    setImagePreview(null);
    setExtractedData(null);
    setGeneratedEmail(null);
    setBusinessName('');
    setContactName('');
    setPhone('');
    setEmail('');
    setLocation('');
    setVehicleCount('');
    setNotes('');
    setCopied(false);
    setEmailSent(false);
    setShowRetrySearch(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      await extractFromImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const extractFromImage = async (imageBase64: string) => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-lead', {
        body: { imageBase64 }
      });

      if (error) throw error;

      if (data.success && data.data) {
        const extracted = data.data as ExtractedLeadData;
        setExtractedData(extracted);
        
        // Populate editable fields
        setBusinessName(extracted.businessName || '');
        setContactName(extracted.contactName || '');
        setPhone(extracted.phone || '');
        setEmail(extracted.email || '');
        setLocation(extracted.address || '');
        setVehicleCount(extracted.vehicleCount?.toString() || '');
        setNotes(extracted.notes || '');
        
        // Check if we're missing important info and auto-search
        const hasMissingInfo = !extracted.email || !extracted.phone || !extracted.address;
        
        if (hasMissingInfo && extracted.businessName) {
          toast({
            title: "Looking up business info...",
            description: "Searching the web for contact details.",
          });
          // Auto-search for missing info
          await autoSearchForMissingInfo(extracted);
        }
        
        setStep('review');
        toast({
          title: "Information extracted",
          description: "Review and edit the details below.",
        });
      }
    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        title: "Extraction failed",
        description: "Could not extract information from the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const autoSearchForMissingInfo = async (extracted: ExtractedLeadData) => {
    setIsAutoSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-business-info', {
        body: { 
          businessName: extracted.businessName,
          phone: extracted.phone || undefined,
          website: extracted.website || undefined,
          location: extracted.address || undefined
        }
      });

      if (error) {
        console.error('Auto-search error:', error);
        setShowRetrySearch(true);
        toast({
          title: "Web search failed",
          description: "Could not search for business info. Please fill in missing fields manually.",
          variant: "destructive",
        });
        return;
      }

      if (data.success && data.data) {
        const found = data.data;
        const updatedFields: string[] = [];
        const stillMissing: string[] = [];

        // Track what we needed and what we found
        const neededEmail = !extracted.email;
        const neededPhone = !extracted.phone;
        const neededAddress = !extracted.address;
        const neededContact = !extracted.contactName;

        // Only fill in fields that are still empty
        if (neededEmail) {
          if (found.email) {
            setEmail(found.email);
            updatedFields.push('email');
          } else {
            stillMissing.push('email');
          }
        }
        if (neededPhone) {
          if (found.phone) {
            setPhone(found.phone);
            updatedFields.push('phone');
          } else {
            stillMissing.push('phone');
          }
        }
        if (neededAddress) {
          if (found.address) {
            setLocation(found.address);
            updatedFields.push('address');
          } else {
            stillMissing.push('address');
          }
        }
        if (neededContact) {
          if (found.contactName) {
            setContactName(found.contactName);
            updatedFields.push('contact name');
          }
        }

        // Show retry if still missing important fields
        if (stillMissing.length > 0) {
          setShowRetrySearch(true);
        } else {
          setShowRetrySearch(false);
        }

        // Show appropriate toast based on results
        if (updatedFields.length > 0 && stillMissing.length > 0) {
          toast({
            title: "Partial info found",
            description: `Found: ${updatedFields.join(', ')}. Could not find: ${stillMissing.join(', ')}`,
          });
        } else if (updatedFields.length > 0) {
          toast({
            title: "Found contact info!",
            description: `Added: ${updatedFields.join(', ')}`,
          });
        } else if (stillMissing.length > 0) {
          toast({
            title: "No contact info found",
            description: `Could not find: ${stillMissing.join(', ')}. Please enter manually.`,
            variant: "destructive",
          });
        }
      } else {
        setShowRetrySearch(true);
        toast({
          title: "Search returned no results",
          description: "Please fill in missing contact details manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Auto-search failed:', error);
      setShowRetrySearch(true);
      toast({
        title: "Search error",
        description: "Something went wrong. Please enter details manually.",
        variant: "destructive",
      });
    } finally {
      setIsAutoSearching(false);
    }
  };

  const retrySearch = async () => {
    if (!businessName) return;
    
    setIsAutoSearching(true);
    setShowRetrySearch(false);
    
    // Build current state as extracted data for the search
    const currentData: ExtractedLeadData = {
      businessName,
      contactName: contactName || null,
      phone: phone || null,
      email: email || null,
      address: location || null,
      website: extractedData?.website || null,
      vehicleCount: vehicleCount ? parseInt(vehicleCount) : null,
      vehicleTypes: extractedData?.vehicleTypes || null,
      services: extractedData?.services || null,
      notes: notes || null,
    };
    
    await autoSearchForMissingInfo(currentData);
  };

  const searchForMissingInfo = async () => {
    if (!businessName) {
      toast({
        title: "Business name required",
        description: "Enter a business name to search for contact info.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-business-info', {
        body: { 
          businessName, 
          phone: phone || undefined,
          website: extractedData?.website || undefined,
          location: location || undefined
        }
      });

      if (error) throw error;

      if (data.success && data.data) {
        const found = data.data;
        const updatedFields: string[] = [];

        if (found.email && !email) {
          setEmail(found.email);
          updatedFields.push('email');
        }
        if (found.phone && !phone) {
          setPhone(found.phone);
          updatedFields.push('phone');
        }
        if (found.address && !location) {
          setLocation(found.address);
          updatedFields.push('address');
        }
        if (found.contactName && !contactName) {
          setContactName(found.contactName);
          updatedFields.push('contact name');
        }

        if (updatedFields.length > 0) {
          toast({
            title: "Info found!",
            description: `Added: ${updatedFields.join(', ')} (${found.confidence || 'medium'} confidence)`,
          });
        } else {
          toast({
            title: "No new info",
            description: "Could not find additional contact information.",
          });
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "Could not search for business info.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const generateEmail = async () => {
    setIsGeneratingEmail(true);
    try {
      const businessData = {
        businessName,
        contactName,
        phone,
        email,
        address: location,
        vehicleCount: vehicleCount ? parseInt(vehicleCount) : null,
        vehicleTypes: extractedData?.vehicleTypes,
        services: extractedData?.services,
        notes,
      };

      const { data, error } = await supabase.functions.invoke('generate-email', {
        body: { businessData, emailType }
      });

      if (error) throw error;

      if (data.success && data.data) {
        setGeneratedEmail(data.data as GeneratedEmail);
        setStep('email');
      }
    } catch (error) {
      console.error('Email generation error:', error);
      toast({
        title: "Email generation failed",
        description: "Could not generate email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const copyEmail = () => {
    if (!generatedEmail) return;
    const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "Email content copied.",
    });
  };

  const sendEmail = async () => {
    if (!generatedEmail || !email) {
      toast({
        title: "Missing email address",
        description: "Please add a recipient email address in the review step.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email,
          subject: generatedEmail.subject,
          body: generatedEmail.body,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        setEmailSent(true);
        toast({
          title: "Email sent!",
          description: `Successfully sent to ${email}`,
        });
      }
    } catch (error) {
      console.error('Send email error:', error);
      const message = error instanceof Error ? error.message : 'Could not send the email. Please try again.';
      toast({
        title: "Failed to send email",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const saveAsProspect = () => {
    if (!businessName) {
      toast({
        title: "Missing information",
        description: "Business name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!email) {
      toast({
        title: "Email required",
        description: "An email address is required to save this prospect. Use 'Retry Search' or enter manually.",
        variant: "destructive",
      });
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    // Simple auto-assignment
    const agents = teamMembers.filter(m => m.role === 'agent');
    const assignedTo = agents[0]?.id || teamMembers[0]?.id;

    onAddProspect({
      businessName,
      contactName: contactName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      location: location || 'Unknown',
      vehicleCount: vehicleCount ? parseInt(vehicleCount) : undefined,
      vehicleTypes: extractedData?.vehicleTypes || undefined,
      notes,
      status: 'new',
      source: 'field_photo',
      assignedTo,
      nextFollowUp: tomorrow,
      movedToQuoting: false,
    });

    toast({
      title: "Prospect saved",
      description: `${businessName} has been added to your pipeline.`,
    });

    setOpen(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {variant === 'prominent' ? (
          <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-md">
            <Camera className="w-5 h-5" />
            Scan Business Card
          </Button>
        ) : (
          <Button variant="outline" className="gap-2">
            <Camera className="w-5 h-5" />
            Scan Photo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* Auto-search loading overlay */}
        {isAutoSearching && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
            <p className="font-medium text-foreground">Searching the web...</p>
            <p className="text-sm text-muted-foreground">Finding contact information</p>
          </div>
        )}
        
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Lead Capture
          </DialogTitle>
          <DialogDescription>
            Upload a photo of a business card, commercial van, or flyer to extract contact information.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={step} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" disabled={step !== 'upload'}>
              1. Upload
            </TabsTrigger>
            <TabsTrigger value="review" disabled={!extractedData}>
              2. Review
            </TabsTrigger>
            <TabsTrigger value="email" disabled={!generatedEmail}>
              3. Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div 
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                "hover:border-primary/50 hover:bg-muted/50",
                isExtracting && "pointer-events-none opacity-60"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {isExtracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Analyzing image with AI...</p>
                </div>
              ) : imagePreview ? (
                <div className="space-y-3">
                  <img 
                    src={imagePreview} 
                    alt="Uploaded" 
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-sm text-muted-foreground">Click to upload a different image</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Upload a photo</p>
                    <p className="text-sm text-muted-foreground">
                      Business card, van, flyer, or any marketing material
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="review" className="mt-4 space-y-4">
            {imagePreview && (
              <div className="flex justify-center mb-4">
                <img 
                  src={imagePreview} 
                  alt="Source" 
                  className="max-h-32 rounded-lg object-contain border"
                />
              </div>
            )}

            {/* Web Search Button - Always visible */}
            {businessName && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 text-sm">
                  <Search className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-medium">
                    {(!email || !phone || !location) 
                      ? "Missing contact info? Search the web" 
                      : "Look up business info online"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={retrySearch}
                  disabled={isAutoSearching || isSearching}
                  className="gap-1.5"
                >
                  {isAutoSearching || isSearching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Search Web
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  Business Name *
                </Label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Company name"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <User className="w-5 h-5 text-muted-foreground" />
                  Contact Name
                </Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Person's name"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  Phone
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="mt-1.5"
                />
              </div>

              <div className="col-span-2">
                <Label className="flex items-center gap-2">
                  <Mail className={cn("w-5 h-5", !email ? "text-destructive" : "text-muted-foreground")} />
                  Email *
                  {!email && businessName && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 text-xs gap-1 text-destructive hover:text-destructive"
                      onClick={searchForMissingInfo}
                      disabled={isSearching}
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="w-3 h-3" />
                          Find Email
                        </>
                      )}
                    </Button>
                  )}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address (required)"
                  className={cn("mt-1.5", !email && "border-destructive/50 focus-visible:ring-destructive")}
                />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  Location
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-muted-foreground" />
                  Vehicle Count
                </Label>
                <Input
                  type="number"
                  value={vehicleCount}
                  onChange={(e) => setVehicleCount(e.target.value)}
                  placeholder="# of vehicles"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Email Type</Label>
                <Select value={emailType} onValueChange={setEmailType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="introduction">Introduction</SelectItem>
                    <SelectItem value="quote">Quote Offer</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  Notes
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details..."
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={saveAsProspect} variant="secondary" disabled={!businessName || !email}>
                Save Prospect
              </Button>
              <Button onClick={generateEmail} disabled={isGeneratingEmail}>
                {isGeneratingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="email" className="mt-4 space-y-4">
            {generatedEmail && (
              <>
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs text-muted-foreground">Sending to</Label>
                      <p className="font-medium text-sm">{email || 'No email address'}</p>
                    </div>
                    {emailSent && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <Check className="w-3 h-3" />
                        Sent
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <p className="font-medium">{generatedEmail.subject}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email Body</Label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                      {generatedEmail.body}
                    </div>
                  </div>
                </Card>

                <DialogFooter className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setStep('review')}>
                    Back
                  </Button>
                  <Button variant="secondary" onClick={copyEmail}>
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={sendEmail} 
                    disabled={isSendingEmail || emailSent || !email}
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : emailSent ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Sent!
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                  <Button onClick={() => {
                    saveAsProspect();
                  }}>
                    Save & Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
