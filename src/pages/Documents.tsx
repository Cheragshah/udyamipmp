import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, FileText, CheckCircle2, Clock, ExternalLink, Send, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatLocalizedNumber } from '@/lib/formatters';
import AuditHistoryPopup from '@/components/shared/AuditHistoryPopup';

const DOCUMENT_KEYS = ['iec', 'gst', 'rcmc', 'udyam_aadhar', 'shop_act', 'pan_card'];

interface Document {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string | null;
  status: string;
  review_notes: string | null;
  submission_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export default function Documents() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const locale = i18n.language;

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, document_type, document_name, file_url, status, review_notes, submission_notes, submitted_at, reviewed_at')
        .eq('user_id', user?.id);

      if (data) {
        setDocuments(data);
        // Initialize notes from existing submission_notes
        const notesMap: Record<string, string> = {};
        data.forEach(doc => {
          if (doc.submission_notes) {
            notesMap[doc.document_type] = doc.submission_notes;
          }
        });
        setDocumentNotes(prev => ({ ...prev, ...notesMap }));
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocument = (docType: string) => {
    return documents.find((d) => d.document_type === docType);
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground">{t('documentsPage.approved')}</Badge>;
      case 'submitted':
        return <Badge className="bg-warning text-warning-foreground">{t('journey.underReview')}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{t('documentsPage.readyToSubmit')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('common.rejected')}</Badge>;
      default:
        return <Badge variant="outline">{t('common.notStarted')}</Badge>;
    }
  };

  const handleFileUpload = async (docType: string, file: File) => {
    if (!user) return;

    setUploading(docType);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${docType}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const existingDoc = getDocument(docType);

      if (existingDoc) {
        // Update existing document - set to pending (ready to submit)
        await supabase
          .from('documents')
          .update({
            file_url: urlData.publicUrl,
            document_name: file.name,
            status: 'pending',
          })
          .eq('id', existingDoc.id);
      } else {
        // Create new document record with pending status
        await supabase.from('documents').insert({
          user_id: user.id,
          document_type: docType,
          document_name: file.name,
          file_url: urlData.publicUrl,
          status: 'pending',
        });
      }

      toast.success(`${t(`documentTypes.${docType}`)} ${t('documentsPage.uploadSuccess')}`);
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = (docType: string) => {
    fileInputRefs.current[docType]?.click();
  };

  const handleSubmitForReview = async (docId: string, docType: string) => {
    const notes = documentNotes[docType] || '';
    
    if (!notes.trim()) {
      toast.error(t('documentsPage.enterDetailsFirst'));
      return;
    }
    
    setSubmitting(docType);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submission_notes: notes.trim(),
        })
        .eq('id', docId);

      if (error) throw error;

      toast.success(t('documentsPage.submittedForReview'));
      fetchDocuments();
    } catch (error) {
      console.error('Error submitting document:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(null);
    }
  };

  const handleSaveNotes = async (docId: string, docType: string) => {
    const notes = documentNotes[docType] || '';
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          submission_notes: notes.trim(),
        })
        .eq('id', docId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleNotesChange = (docType: string, value: string) => {
    setDocumentNotes(prev => ({ ...prev, [docType]: value }));
  };

  const approvedCount = documents.filter((d) => d.status === 'approved').length;
  const submittedCount = documents.filter((d) => d.status === 'submitted').length;
  const progressPercent = (approvedCount / DOCUMENT_KEYS.length) * 100;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('documentsPage.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('documentsPage.subtitle')}
        </p>
      </div>

      {/* Progress Summary */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{formatLocalizedNumber(approvedCount, locale)}/{formatLocalizedNumber(DOCUMENT_KEYS.length, locale)}</p>
              <p className="text-sm text-muted-foreground">{t('documentsPage.documentsApproved')}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{formatLocalizedNumber(approvedCount, locale)} {t('documentsPage.approved')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <span>{formatLocalizedNumber(submittedCount, locale)} {t('documentsPage.pending')}</span>
              </div>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {DOCUMENT_KEYS.map((docKey) => {
          const doc = getDocument(docKey);
          const isUploading = uploading === docKey;

          return (
            <Card
              key={docKey}
              className={`border-border/50 transition-all ${
                doc?.status === 'approved' ? 'bg-success/5 border-success/30' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{t(`documentTypes.${docKey}`)}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(`documentTypes.${docKey}_desc`)}
                    </p>
                  </div>
                  {getStatusBadge(doc?.status)}
                </div>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={(el) => (fileInputRefs.current[docKey] = el)}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(docKey, file);
                  }}
                />

                <div className="space-y-3">
                  {/* Show file info if uploaded */}
                  {doc?.file_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate flex-1">{doc.document_name}</span>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}

                  {/* Review notes from coach */}
                  {doc?.review_notes && (
                    <p className="text-sm text-muted-foreground bg-secondary/50 p-2 rounded">
                      {doc.review_notes}
                    </p>
                  )}

                  {/* Show submitted notes for submitted/approved documents */}
                  {(doc?.status === 'submitted' || doc?.status === 'approved') && doc?.submission_notes && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">{t('documentsPage.submittedDetails')}</p>
                      <p className="text-sm">{doc.submission_notes}</p>
                    </div>
                  )}

                  {/* Upload button - show when no file or for pending/rejected to replace */}
                  {(!doc?.file_url || doc?.status === 'pending' || doc?.status === 'rejected') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleFileSelect(docKey)}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploading 
                        ? t('documentsPage.uploading') 
                        : doc?.file_url 
                          ? t('documentsPage.replaceDocument') 
                          : t('documentsPage.uploadDocument')
                      }
                    </Button>
                  )}

                  {/* Notes input - show for pending/rejected OR when no doc exists yet */}
                  {(!doc || doc?.status === 'pending' || doc?.status === 'rejected') && (
                    <Textarea
                      placeholder={t('documentsPage.enterDocumentDetails')}
                      value={documentNotes[docKey] || ''}
                      onChange={(e) => handleNotesChange(docKey, e.target.value)}
                      onBlur={() => doc && handleSaveNotes(doc.id, docKey)}
                      className="min-h-[80px] text-sm"
                    />
                  )}

                  {/* Submit button - only show when file is uploaded AND status is pending/rejected */}
                  {doc?.file_url && (doc?.status === 'pending' || doc?.status === 'rejected') && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleSubmitForReview(doc.id, docKey)}
                      disabled={submitting === docKey || !documentNotes[docKey]?.trim()}
                    >
                      {submitting === docKey ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {t('documentsPage.submitForReview')}
                    </Button>
                  )}

                  {/* Audit History Link */}
                  {doc && (
                    <div className="mt-2">
                      <AuditHistoryPopup tableName="documents" recordId={doc.id} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
