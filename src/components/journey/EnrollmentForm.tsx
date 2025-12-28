import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Check, Clock, FileText, Send, Upload, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import AuditHistoryPopup from '@/components/shared/AuditHistoryPopup';
import { INDIAN_CITIES } from '@/lib/indianCities';

interface EnrollmentSubmission {
  id: string;
  user_id: string;
  full_name: string;
  address: string;
  city: string | null;
  email: string;
  phone: string;
  date_of_birth: string;
  notes: string | null;
  attachment_url: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
}

const WORKFLOW_STEPS = [
  { key: 'submitted', icon: FileText },
  { key: 'documents_sent_to_user', icon: Send },
  { key: 'documents_sent_to_office', icon: Send },
  { key: 'completed', icon: Check },
];

export default function EnrollmentForm() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [submission, setSubmission] = useState<EnrollmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [city, setCity] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchSubmission();
    }
  }, [user]);

  // Pre-fill from profile
  useEffect(() => {
    if (profile && !submission) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
    }
  }, [profile, submission]);

  const fetchSubmission = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('enrollment_submissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSubmission(data as EnrollmentSubmission);
        setFullName(data.full_name);
        setAddress(data.address);
        setCity(data.city || '');
        setEmail(data.email);
        setPhone(data.phone);
        setDateOfBirth(new Date(data.date_of_birth));
        setNotes(data.notes || '');
        setAttachmentUrl(data.attachment_url);
      }
    } catch (error) {
      console.error('Error fetching enrollment submission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('enrollment.fileTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/enrollment-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      setAttachmentUrl(urlData.publicUrl);
      setAttachmentName(file.name);
      toast.success(t('enrollment.fileUploaded'));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('enrollment.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dateOfBirth || !city) return;

    setSubmitting(true);
    try {
      const submissionData = {
        user_id: user.id,
        full_name: fullName,
        address,
        city,
        email,
        phone,
        date_of_birth: format(dateOfBirth, 'yyyy-MM-dd'),
        notes: notes || null,
        attachment_url: attachmentUrl,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };

      if (submission) {
        const { error } = await supabase
          .from('enrollment_submissions')
          .update(submissionData)
          .eq('id', submission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('enrollment_submissions')
          .insert(submissionData);
        if (error) throw error;
      }

      toast.success(t('enrollment.submitted'));
      fetchSubmission();
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(t('enrollment.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!submission) return;

    try {
      const { error } = await supabase
        .from('enrollment_submissions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', submission.id);

      if (error) throw error;
      
      toast.success(t('enrollment.statusUpdated'));
      fetchSubmission();
    } catch (error) {
      console.error('Status update error:', error);
      toast.error(t('enrollment.updateFailed'));
    }
  };

  const getStepIndex = (status: string) => {
    return WORKFLOW_STEPS.findIndex(step => step.key === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Show workflow status if already submitted
  if (submission) {
    const currentStepIndex = getStepIndex(submission.status);

    return (
      <div className="space-y-6">
        {/* Workflow Progress */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">{t('enrollment.workflowStatus')}</h4>
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                        isCompleted
                          ? 'bg-success border-success text-success-foreground'
                          : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                      )}
                    >
                      {isCompleted && index < currentStepIndex ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={cn(
                      'text-xs text-center max-w-[80px]',
                      isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                    )}>
                      {t(`enrollment.statuses.${step.key}`)}
                    </span>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        index < currentStepIndex ? 'bg-success' : 'bg-muted'
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Submission Details */}
        <Card className="bg-secondary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t('enrollment.fullName')}:</span>
                <p className="font-medium">{submission.full_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('enrollment.email')}:</span>
                <p className="font-medium">{submission.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('enrollment.phone')}:</span>
                <p className="font-medium">{submission.phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('enrollment.dateOfBirth')}:</span>
                <p className="font-medium">{format(new Date(submission.date_of_birth), 'PP')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('enrollment.city')}:</span>
                <p className="font-medium">{submission.city || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('enrollment.address')}:</span>
                <p className="font-medium">{submission.address}</p>
              </div>
              {submission.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">{t('enrollment.notes')}:</span>
                  <p className="font-medium">{submission.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User action button - only show when documents are sent to user */}
        {submission.status === 'documents_sent_to_user' && (
          <Button
            onClick={() => handleUpdateStatus('documents_sent_to_office')}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {t('enrollment.markDocumentsSent')}
          </Button>
        )}

        {submission.status === 'completed' && (
          <Badge variant="default" className="bg-success text-success-foreground w-full justify-center py-2">
            <Check className="h-4 w-4 mr-2" />
            {t('enrollment.enrollmentComplete')}
          </Badge>
        )}

        {/* Audit History Link */}
        <div className="pt-2">
          <AuditHistoryPopup tableName="enrollment_submissions" recordId={submission.id} />
        </div>
      </div>
    );
  }

  // Show form if not submitted
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">{t('enrollment.fullName')} *</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('enrollment.email')} *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('enrollment.phone')} *</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>{t('enrollment.dateOfBirth')} *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateOfBirth && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateOfBirth ? format(dateOfBirth, 'PP') : t('enrollment.selectDate')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateOfBirth}
                onSelect={setDateOfBirth}
                disabled={(date) => date > new Date()}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('enrollment.city')} *</Label>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger>
            <SelectValue placeholder={t('enrollment.selectCity')} />
          </SelectTrigger>
          <SelectContent className="bg-background border">
            {INDIAN_CITIES.map((cityName) => (
              <SelectItem key={cityName} value={cityName}>
                {cityName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">{t('enrollment.address')} *</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t('enrollment.notes')}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t('enrollment.notesPlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('enrollment.attachment')}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="flex-1"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          />
          {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {attachmentName && (
          <p className="text-sm text-muted-foreground">{attachmentName}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting || !dateOfBirth || !city}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('enrollment.submitting')}
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            {t('enrollment.submit')}
          </>
        )}
      </Button>
    </form>
  );
}