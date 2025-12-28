import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock, Send, Eye, FileText, Upload, Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatLocalizedNumber } from '@/lib/formatters';
import AuditHistoryPopup from '@/components/shared/AuditHistoryPopup';
interface Task {
  id: string;
  title: string;
  description: string | null;
  guidelines: string | null;
  task_order: number;
  stage_id: string | null;
}

interface TaskSubmission {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  submission_notes: string | null;
  attachment_url: string | null;
  verification_notes: string | null;
  submitted_at: string | null;
  verified_at: string | null;
}

export default function Tasks() {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const locale = i18n.language;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)
        .order('task_order');

      const { data: submissionsData } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('user_id', user?.id);

      if (tasksData) setTasks(tasksData);
      if (submissionsData) setSubmissions(submissionsData as TaskSubmission[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubmission = (taskId: string) => {
    return submissions.find((s) => s.task_id === taskId);
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-success text-success-foreground">Verified</Badge>;
      case 'submitted':
        return <Badge className="bg-warning text-warning-foreground">Under Review</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Needs Revision</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setAttachmentFile(file);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadAttachment = async (taskId: string): Promise<string | null> => {
    if (!attachmentFile || !user) return null;

    setUploadingFile(true);
    try {
      const fileExt = attachmentFile.name.split('.').pop();
      const fileName = `${user.id}/${taskId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, attachmentFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload attachment');
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTask || !user) return;

    // Validate mandatory submission notes
    if (!submissionNotes.trim()) {
      setNotesError(t('tasks.submissionRequired'));
      return;
    }
    setNotesError('');

    setSubmitting(true);
    try {
      // Upload attachment if present
      let attachmentUrl: string | null = null;
      if (attachmentFile) {
        attachmentUrl = await uploadAttachment(selectedTask.id);
      }

      const existing = getSubmission(selectedTask.id);

      if (existing) {
        const updateData: Record<string, unknown> = {
          submission_notes: submissionNotes,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        };
        if (attachmentUrl) {
          updateData.attachment_url = attachmentUrl;
        }

        await supabase
          .from('task_submissions')
          .update(updateData)
          .eq('id', existing.id);
      } else {
        await supabase.from('task_submissions').insert({
          task_id: selectedTask.id,
          user_id: user.id,
          submission_notes: submissionNotes,
          attachment_url: attachmentUrl,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });
      }

      toast.success(t('tasks.taskSubmitted'));
      setDialogOpen(false);
      setSelectedTask(null);
      setSubmissionNotes('');
      setAttachmentFile(null);
      fetchTasks();
    } catch (error) {
      console.error('Error submitting task:', error);
      toast.error(t('tasks.taskSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const getAttachmentFileName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  const completedCount = submissions.filter((s) => s.status === 'verified').length;
  const submittedCount = submissions.filter((s) => s.status === 'submitted').length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('tasks.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('tasks.subtitle')}
        </p>
      </div>

      {/* Progress Summary */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{formatLocalizedNumber(completedCount, locale)}/{formatLocalizedNumber(tasks.length, locale)}</p>
              <p className="text-sm text-muted-foreground">{t('tasks.tasksVerified')}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{formatLocalizedNumber(completedCount, locale)} {t('tasks.verified')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <span>{formatLocalizedNumber(submittedCount, locale)} {t('tasks.pending')}</span>
              </div>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const submission = getSubmission(task.id);
          const status = submission?.status;

          return (
            <Card
              key={task.id}
              className={`border-border/50 transition-all ${
                status === 'verified' ? 'bg-success/5 border-success/30' : ''
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Task Number */}
                  <div
                    className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      status === 'verified'
                        ? 'bg-success text-success-foreground'
                        : status === 'submitted'
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {status === 'verified' ? '✓' : formatLocalizedNumber(task.task_order, locale)}
                  </div>

                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{t(`taskTitles.${task.title}`, { defaultValue: task.title })}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3">
                    {getStatusBadge(status)}

                    <Dialog open={dialogOpen && selectedTask?.id === task.id} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (!open) {
                        setSelectedTask(null);
                        setNotesError('');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setSubmissionNotes(submission?.submission_notes || '');
                            setAttachmentFile(null);
                            setNotesError('');
                            setDialogOpen(true);
                          }}
                        >
                          {status === 'verified' ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>
                            {t('sidebar.tasks')} {task.task_order}: {t(`taskTitles.${task.title}`, { defaultValue: task.title })}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          {task.description && (
                            <div>
                              <h4 className="font-medium mb-1">{t('tasks.description')}</h4>
                              <p className="text-sm text-muted-foreground">
                                {task.description}
                              </p>
                            </div>
                          )}
                          {task.guidelines && (
                            <div>
                              <h4 className="font-medium mb-1">{t('tasks.guidelines')}</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {task.guidelines}
                              </p>
                            </div>
                          )}

                          {/* Show existing attachment if any */}
                          {submission?.attachment_url && (
                            <div>
                              <h4 className="font-medium mb-1">{t('tasks.attachment')}</h4>
                              <a 
                                href={submission.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-2"
                              >
                                <Paperclip className="h-4 w-4" />
                                {getAttachmentFileName(submission.attachment_url)}
                              </a>
                            </div>
                          )}

                          {status !== 'verified' && (
                            <>
                              <div>
                                <Label className="font-medium">
                                  {t('tasks.yourSubmission')} <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                  placeholder="Describe how you completed this task..."
                                  value={submissionNotes}
                                  onChange={(e) => {
                                    setSubmissionNotes(e.target.value);
                                    if (e.target.value.trim()) {
                                      setNotesError('');
                                    }
                                  }}
                                  rows={4}
                                  className={`mt-2 ${notesError ? 'border-destructive' : ''}`}
                                />
                                {notesError && (
                                  <p className="text-sm text-destructive mt-1">{notesError}</p>
                                )}
                              </div>

                              {/* Attachment Upload */}
                              <div>
                                <Label className="font-medium">{t('tasks.attachmentOptional')}</Label>
                                <div className="mt-2">
                                  {attachmentFile ? (
                                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm flex-1 truncate">{attachmentFile.name}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={removeAttachment}
                                        className="h-6 w-6 p-0"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div>
                                      <Input
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full"
                                      >
                                        <Upload className="h-4 w-4 mr-2" />
                                        {t('tasks.uploadFile')}
                                      </Button>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {t('tasks.fileTypes')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <Button
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={submitting || uploadingFile}
                              >
                                {(submitting || uploadingFile) ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                {uploadingFile ? t('tasks.uploading') : submission ? t('tasks.updateSubmission') : t('tasks.submitForReview')}
                              </Button>
                            </>
                          )}

                          {submission?.verification_notes && (
                            <div className="p-3 bg-secondary/50 rounded-lg">
                              <h4 className="font-medium mb-1">{t('tasks.coachFeedback')}</h4>
                              <p className="text-sm text-muted-foreground">
                                {submission.verification_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  {/* Audit History Link */}
                  {submission && (
                    <div className="mt-2">
                      <AuditHistoryPopup tableName="task_submissions" recordId={submission.id} />
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