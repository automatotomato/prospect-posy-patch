import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Zap, Mail, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { signInWithOtp, verifyOtp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setIsLoading(true);
    try {
      // Check allow-list through a public backend function because pre-login users
      // cannot read the protected allow-list table directly.
      const normalized = email.trim().toLowerCase();
      const { data, error: allowError } = await supabase.functions.invoke('check-allowed-user', {
        body: { email: normalized },
      });
      if (allowError || !data?.allowed) {
        setError('This email is not authorized. Ask an admin to invite you.');
        setIsLoading(false);
        return;
      }

      const { error } = await signInWithOtp(normalized);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setStep('code');
        toast({ title: 'Code sent!', description: 'Check your email for an 8-digit code.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 8) {
      setError('Please enter the full 8-digit code');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const { error } = await verifyOtp(email.trim().toLowerCase(), otp);
      if (error) {
        toast({ title: 'Verification Failed', description: 'Invalid or expired code. Please try again.', variant: 'destructive' });
        setOtp('');
      } else {
        toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Automate Planet</h1>
          <p className="text-muted-foreground text-sm mt-1">AI Employees for Growing Businesses</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-display">
              {step === 'email' ? 'Welcome Back' : 'Enter Code'}
            </CardTitle>
            <CardDescription>
              {step === 'email'
                ? 'Enter your email to receive a login code'
                : `We sent an 8-digit code to ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Sending code...</>
                  ) : (
                    <>Send Code<ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div className="flex flex-col items-center gap-2">
                  <Label>Verification Code</Label>
                  <InputOTP maxLength={8} value={otp} onChange={setOtp} disabled={isLoading}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isLoading || otp.length !== 8}>
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</>
                  ) : (
                    <>Verify & Sign In<ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                  className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground w-full"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
