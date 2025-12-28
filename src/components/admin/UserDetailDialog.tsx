import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  User, Mail, Phone, GraduationCap, CheckCircle, XCircle, Clock, 
  FileText, TrendingUp, History, ExternalLink, Paperclip, Target,
  ChevronRight, ArrowLeft, Play, Send
} from 'lucide-react';
import { formatLocalizedDate, formatLocalizedNumber } from '@/lib/formatters';
import type { AppRole } from '@/types/database';

interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userRole: AppRole;
  userEmail?: string;
  userPhone?: string;
  coachName?: string;
}

interface JourneyStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
}

interface ProgressData {
  id: string;
  stage_id: string;
  status: string;
}

interface TaskWithSubmission {
  id: string;
  title: string;
  description: string | null;
  guidelines: string | null;
  task_order: number;
  stage_id: string | null;
  submission?: {
    id: string;
    status: string;
    submission_notes: string | null;
    attachment_url: string | null;
    submitted_at: string | null;
    verification_notes: string | null;
  };
}

interface DocumentData {
  id: string;
  document_type: string;
  document_name: string;
  file_url: string | null;
  status: string;
  submitted_at: string | null;
  review_notes: string | null;
}

interface TradeData {
  id: string;
  trade_type: string;
  product_service: string;
  country: string;
  amount: number;
  trade_date: string;
  status: string;
  attachment_url: string | null;
  notes: string | null;
}

interface EnrollmentData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string;
  status: string;
  submitted_at: string | null;
}

interface AuditLogData {
  id: string;
  table_name: string;
  action: string;
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
  changed_by_name?: string;
}

export default function UserDetailDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
  userEmail,
  userPhone,
  coachName
}: UserDetailDialogProps) {
  const { t, i18n } = useTranslation();
  const { user, role: currentUserRole } = useAuth();
  const locale = i18n.language;

  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<JourneyStage[]>([]);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [tasks, setTasks] = useState<TaskWithSubmission[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogData[]>([]);

  // Review dialog state
  const [reviewDialog, setReviewDialog] = useState<{ 
    open: boolean; 
    type: 'task' | 'document' | 'trade'; 
    item: any 
  }>({ open: false, type: 'task', item: null });
  const [feedback, setFeedback] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  // Admin submit on behalf state
  const [submitDialog, setSubmitDialog] = useState<{
    open: boolean;
    taskId: string;
    taskTitle: string;
  }>({ open: false, taskId: '', taskTitle: '' });
  const [submitNotes, setSubmitNotes] = useState('');

  useEffect(() => {
    if (open && userId) {
      fetchAllUserData();
    }
  }, [open, userId]);

  const fetchAllUserData = async () => {
    setLoading(true);
    await Promise.all([
      fetchJourneyData(),
      fetchTasks(),
      fetchDocuments(),
      fetchTrades(),
      fetchEnrollment(),
      fetchAuditLogs()
    ]);
    setLoading(false);
  };

  const fetchJourneyData = async () => {
    try {
      const [stagesRes, progressRes] = await Promise.all([
        supabase.from('journey_stages').select('*').order('stage_order'),
        supabase.from('participant_progress').select('*').eq('user_id', userId)
      ]);
      setStages(stagesRes.data || []);
      setProgress(progressRes.data || []);
    } catch (error) {
      console.error('Error fetching journey data:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const [tasksRes, submissionsRes] = await Promise.all([
        supabase.from('tasks').select('*').order('task_order'),
        supabase.from('task_submissions').select('*').eq('user_id', userId)
      ]);
      
      const tasksWithSubmissions = (tasksRes.data || []).map(task => ({
        ...task,
        submission: submissionsRes.data?.find(s => s.task_id === task.id)
      }));
      setTasks(tasksWithSubmissions);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data } = await supabase.from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchTrades = async () => {
    try {
      const { data } = await supabase.from('trades').select('*').eq('user_id', userId).order('trade_date', { ascending: false });
      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  };

  const fetchEnrollment = async () => {
    try {
      const { data } = await supabase.from('enrollment_submissions').select('*').eq('user_id', userId).maybeSingle();
      setEnrollment(data || null);
    } catch (error) {
      console.error('Error fetching enrollment:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data: logs } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      const { data: profiles } = await supabase.from('profiles').select('id, full_name');
      
      const enriched = ((logs as any[]) || []).map((log: any) => ({
        ...log,
        changed_by_name: profiles?.find(p => p.id === log.changed_by)?.full_name || t('auditHistory.system')
      }));
      
      setAuditLogs(enriched);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  // Check if current user can update a specific stage based on role
  const canUpdateStage = (stageName: string): boolean => {
    // Admin can do everything
    if (currentUserRole === 'admin') return true;
    
    // Fees Paid can only be marked by finance or admin
    if (stageName === 'Fees Paid') {
      return currentUserRole === 'finance';
    }
    
    // E-Commerce Setup can only be marked by ecommerce team or admin
    if (stageName === 'E-Commerce Setup') {
      return currentUserRole === 'ecommerce';
    }
    
    // Coaches can update other stages
    if (currentUserRole === 'coach') return true;
    
    // Finance team can update Fees Paid (handled above)
    if (currentUserRole === 'finance') return stageName === 'Fees Paid';
    
    // Ecommerce team can update E-Commerce Setup (handled above)
    if (currentUserRole === 'ecommerce') return stageName === 'E-Commerce Setup';
    
    return false;
  };

  // Check if current user can submit tasks on behalf of users (admin only)
  const canSubmitOnBehalf = currentUserRole === 'admin';

  // Update stage progress on behalf of user
  const updateStageProgress = async (stageId: string, newStatus: string) => {
    const stage = stages.find(s => s.id === stageId);
    if (stage && !canUpdateStage(stage.name)) {
      toast.error(t('admin.noPermissionForStage'));
      return;
    }
    
    setUpdating(stageId);
    try {
      const existing = progress.find(p => p.stage_id === stageId);
      if (existing) {
        await supabase.from('participant_progress').update({
          status: newStatus,
          started_at: newStatus === 'in_progress' ? new Date().toISOString() : undefined,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        }).eq('id', existing.id);
      } else {
        await supabase.from('participant_progress').insert({
          user_id: userId,
          stage_id: stageId,
          status: newStatus,
          started_at: new Date().toISOString(),
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        });
      }
      toast.success(t('admin.stageUpdated'));
      fetchJourneyData();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  // Submit task on behalf of user
  const submitTaskForUser = async () => {
    if (!submitDialog.taskId) return;
    setUpdating(submitDialog.taskId);
    
    try {
      // Check if submission exists
      const existingTask = tasks.find(t => t.id === submitDialog.taskId);
      
      if (existingTask?.submission) {
        // Update existing submission
        await supabase.from('task_submissions').update({
          status: 'verified',
          submission_notes: submitNotes || `Submitted by admin on behalf of user`,
          submitted_at: new Date().toISOString(),
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          verification_notes: 'Auto-verified - submitted by admin'
        }).eq('id', existingTask.submission.id);
      } else {
        // Create new submission
        await supabase.from('task_submissions').insert({
          user_id: userId,
          task_id: submitDialog.taskId,
          status: 'verified',
          submission_notes: submitNotes || `Submitted by admin on behalf of user`,
          submitted_at: new Date().toISOString(),
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          verification_notes: 'Auto-verified - submitted by admin'
        });
      }
      
      toast.success(t('admin.taskSubmittedForUser'));
      setSubmitDialog({ open: false, taskId: '', taskTitle: '' });
      setSubmitNotes('');
      fetchTasks();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error submitting task:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  const handleApproval = async (type: 'task' | 'document' | 'trade', approved: boolean) => {
    if (!reviewDialog.item) return;
    setUpdating(reviewDialog.item.id);

    try {
      if (type === 'task') {
        await supabase.from('task_submissions').update({
          status: approved ? 'verified' : 'rejected',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          verification_notes: feedback || null
        }).eq('id', reviewDialog.item.id);
      } else if (type === 'document') {
        await supabase.from('documents').update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: feedback || null
        }).eq('id', reviewDialog.item.id);
      } else if (type === 'trade') {
        await supabase.from('trades').update({
          status: approved ? 'approved' : 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: feedback || null
        }).eq('id', reviewDialog.item.id);
      }

      toast.success(approved ? t('coach.taskApproved') : t('coach.taskRejected'));
      setReviewDialog({ open: false, type: 'task', item: null });
      setFeedback('');
      
      if (type === 'task') fetchTasks();
      else if (type === 'document') fetchDocuments();
      else if (type === 'trade') fetchTrades();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
      case 'approved':
      case 'completed':
        return <Badge className="bg-green-500 text-white">{status}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{status}</Badge>;
      case 'submitted':
      case 'pending':
      case 'in_progress':
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive text-destructive-foreground">{t('roles.admin')}</Badge>;
      case 'coach':
        return <Badge className="bg-primary text-primary-foreground">{t('roles.coach')}</Badge>;
      default:
        return <Badge variant="secondary">{t('roles.participant')}</Badge>;
    }
  };

  // Group tasks by stage
  const tasksByStage = tasks.reduce((acc, task) => {
    const stageId = task.stage_id || 'unassigned';
    if (!acc[stageId]) acc[stageId] = [];
    acc[stageId].push(task);
    return acc;
  }, {} as Record<string, TaskWithSubmission[]>);

  // Calculate stats
  const completedStages = progress.filter(p => p.status === 'completed').length;
  const completedTasks = tasks.filter(t => t.submission?.status === 'verified').length;
  const approvedDocs = documents.filter(d => d.status === 'approved').length;
  const approvedTrades = trades.filter(t => t.status === 'approved').length;
  const totalTradeVolume = trades.reduce((sum, t) => sum + (t.amount || 0), 0);
  const overallProgress = stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle><Skeleton className="h-6 w-48" /></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full h-[95vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b p-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <User className="h-6 w-6 text-primary" />
                  <h1 className="text-xl font-bold">{userName || t('common.na')}</h1>
                  {getRoleBadge(userRole)}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {userEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" /> {userEmail}
                    </span>
                  )}
                  {userPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {userPhone}
                    </span>
                  )}
                  {coachName && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4" /> {coachName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Target className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{overallProgress}%</p>
                    <p className="text-sm text-muted-foreground">{t('userDetail.progress')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{completedStages}/{stages.length}</p>
                    <p className="text-sm text-muted-foreground">{t('userDetail.stagesCompleted')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{completedTasks}/{tasks.length}</p>
                    <p className="text-sm text-muted-foreground">{t('userDetail.tasks')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{approvedDocs}/{documents.length}</p>
                    <p className="text-sm text-muted-foreground">{t('userDetail.documents')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{approvedTrades}</p>
                    <p className="text-sm text-muted-foreground">{t('userDetail.trades')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">₹{formatLocalizedNumber(totalTradeVolume, locale)}</p>
                    <p className="text-sm text-muted-foreground">{t('userDetail.totalTradeVolume')}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">{t('userDetail.journeyProgress')}</span>
                <span className="text-muted-foreground">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="journey" className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto gap-1 mb-4">
                <TabsTrigger value="journey">{t('userDetail.tabs.journey')}</TabsTrigger>
                <TabsTrigger value="tasks">{t('userDetail.tabs.tasks')}</TabsTrigger>
                <TabsTrigger value="documents">{t('userDetail.tabs.documents')}</TabsTrigger>
                <TabsTrigger value="trades">{t('userDetail.tabs.trades')}</TabsTrigger>
                <TabsTrigger value="enrollment">{t('userDetail.tabs.enrollment')}</TabsTrigger>
                <TabsTrigger value="audit">{t('userDetail.tabs.audit')}</TabsTrigger>
              </TabsList>

              {/* Journey Tab - Expandable Stages */}
              <TabsContent value="journey" className="mt-0">
                <div className="grid lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t('admin.stagesOverview')}</h3>
                    <Accordion type="multiple" className="space-y-2">
                      {stages.map((stage) => {
                        const stageProgress = progress.find(p => p.stage_id === stage.id);
                        const status = stageProgress?.status || 'not_started';
                        const stageTasks = tasksByStage[stage.id] || [];
                        const completedStageTasks = stageTasks.filter(t => t.submission?.status === 'verified').length;
                        
                        return (
                          <AccordionItem key={stage.id} value={stage.id} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline py-4">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    status === 'completed' ? 'bg-green-500 text-white' :
                                    status === 'in_progress' ? 'bg-blue-500 text-white' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {stage.stage_order}
                                  </div>
                                  <div className="text-left">
                                    <p className="font-medium">{t(`stages.${stage.name}`) || stage.name}</p>
                                    {stageTasks.length > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        {completedStageTasks}/{stageTasks.length} {t('admin.tasksCompleted')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {getStatusBadge(status)}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="space-y-4 pt-2">
                                {stage.description && (
                                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                                )}
                                
                                {/* Stage Actions */}
                                {canUpdateStage(stage.name) ? (
                                  <div className="flex flex-wrap gap-2">
                                    <Select
                                      value={status}
                                      onValueChange={(value) => updateStageProgress(stage.id, value)}
                                      disabled={updating === stage.id}
                                    >
                                      <SelectTrigger className="w-48">
                                        <SelectValue placeholder={t('admin.updateStatus')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="not_started">{t('status.not_started')}</SelectItem>
                                        <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                                        <SelectItem value="completed">{t('status.completed')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">
                                    {stage.name === 'Fees Paid' 
                                      ? t('admin.feesPaidRestricted')
                                      : stage.name === 'E-Commerce Setup'
                                      ? t('admin.ecommerceRestricted')
                                      : t('admin.noPermissionForStage')}
                                  </p>
                                )}

                                {/* Tasks in this stage */}
                                {stageTasks.length > 0 && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-medium mb-2">{t('admin.tasksInStage')}</h4>
                                    <div className="space-y-2">
                                      {stageTasks.map((task) => {
                                        const taskStatus = task.submission?.status || 'not_started';
                                        const canSubmit = taskStatus === 'not_started' || taskStatus === 'rejected';
                                        const isPending = taskStatus === 'submitted' || taskStatus === 'in_progress';
                                        
                                        return (
                                          <div key={task.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-muted-foreground">#{task.task_order}</span>
                                              <span className="text-sm">{t(`taskTitles.${task.title}`) || task.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {getStatusBadge(taskStatus)}
                                              {canSubmitOnBehalf && canSubmit && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => setSubmitDialog({ 
                                                    open: true, 
                                                    taskId: task.id, 
                                                    taskTitle: t(`taskTitles.${task.title}`) || task.title 
                                                  })}
                                                >
                                                  <Send className="h-3 w-3 mr-1" />
                                                  {t('admin.submitForUser')}
                                                </Button>
                                              )}
                                              {isPending && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => setReviewDialog({ open: true, type: 'task', item: task.submission })}
                                                >
                                                  {t('coach.review')}
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>

                  {/* Quick Stats Column */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">{t('admin.quickStats')}</h3>
                    <div className="space-y-4">
                      <Card className="p-4">
                        <h4 className="font-medium mb-3">{t('admin.stageBreakdown')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500" />
                              {t('status.completed')}
                            </span>
                            <span className="font-medium">{progress.filter(p => p.status === 'completed').length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500" />
                              {t('status.in_progress')}
                            </span>
                            <span className="font-medium">{progress.filter(p => p.status === 'in_progress').length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-muted" />
                              {t('status.not_started')}
                            </span>
                            <span className="font-medium">{stages.length - progress.length}</span>
                          </div>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h4 className="font-medium mb-3">{t('admin.taskBreakdown')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              {t('status.verified')}
                            </span>
                            <span className="font-medium">{tasks.filter(t => t.submission?.status === 'verified').length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-blue-500" />
                              {t('status.submitted')}
                            </span>
                            <span className="font-medium">{tasks.filter(t => t.submission?.status === 'submitted').length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3 h-3 text-destructive" />
                              {t('status.rejected')}
                            </span>
                            <span className="font-medium">{tasks.filter(t => t.submission?.status === 'rejected').length}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-muted" />
                              {t('status.not_started')}
                            </span>
                            <span className="font-medium">{tasks.filter(t => !t.submission).length}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="mt-0">
                <div className="grid lg:grid-cols-3 gap-4">
                  {tasks.map((task) => {
                    const status = task.submission?.status || 'not_started';
                    const isPending = status === 'submitted' || status === 'in_progress';
                    const canSubmit = status === 'not_started' || status === 'rejected';
                    
                    return (
                      <Card key={task.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">#{task.task_order}</span>
                            {getStatusBadge(status)}
                          </div>
                        </div>
                        <h4 className="font-medium mb-1">{t(`taskTitles.${task.title}`) || task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex gap-2">
                          {canSubmit && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setSubmitDialog({ 
                                open: true, 
                                taskId: task.id, 
                                taskTitle: t(`taskTitles.${task.title}`) || task.title 
                              })}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {t('admin.submitForUser')}
                            </Button>
                          )}
                          {isPending && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReviewDialog({ open: true, type: 'task', item: task.submission })}
                            >
                              {t('coach.review')}
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="mt-0">
                <div className="grid lg:grid-cols-3 gap-4">
                  {documents.length === 0 ? (
                    <p className="col-span-3 text-center text-muted-foreground py-8">{t('userDetail.noDocuments')}</p>
                  ) : (
                    documents.map((doc) => {
                      const isPending = doc.status === 'pending' || doc.status === 'submitted';
                      return (
                        <Card key={doc.id} className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            {getStatusBadge(doc.status)}
                            {doc.file_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                          <h4 className="font-medium">{t(`documentTypes.${doc.document_type}`) || doc.document_name}</h4>
                          <p className="text-sm text-muted-foreground">{doc.document_name}</p>
                          {isPending && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={() => setReviewDialog({ open: true, type: 'document', item: doc })}
                            >
                              {t('coach.review')}
                            </Button>
                          )}
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* Trades Tab */}
              <TabsContent value="trades" className="mt-0">
                <Card className="mb-4 p-4">
                  <p className="text-lg font-medium">{t('userDetail.totalTradeVolume')}: ₹{formatLocalizedNumber(totalTradeVolume, locale)}</p>
                </Card>
                <div className="grid lg:grid-cols-3 gap-4">
                  {trades.length === 0 ? (
                    <p className="col-span-3 text-center text-muted-foreground py-8">{t('userDetail.noTrades')}</p>
                  ) : (
                    trades.map((trade) => {
                      const isPending = trade.status === 'pending';
                      return (
                        <Card key={trade.id} className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            {getStatusBadge(trade.status)}
                            {trade.attachment_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={trade.attachment_url} target="_blank" rel="noopener noreferrer">
                                  <Paperclip className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                          <h4 className="font-medium">{trade.product_service}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t(`trades.${trade.trade_type}`)} • {trade.country}
                          </p>
                          <p className="text-lg font-semibold mt-2">₹{formatLocalizedNumber(trade.amount, locale)}</p>
                          {isPending && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={() => setReviewDialog({ open: true, type: 'trade', item: trade })}
                            >
                              {t('coach.review')}
                            </Button>
                          )}
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* Enrollment Tab */}
              <TabsContent value="enrollment" className="mt-0">
                {enrollment ? (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                      <h3 className="font-semibold mb-4">{t('enrollment.personalInfo')}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('enrollment.fullName')}</p>
                          <p className="font-medium">{enrollment.full_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('enrollment.email')}</p>
                          <p className="font-medium">{enrollment.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('enrollment.phone')}</p>
                          <p className="font-medium">{enrollment.phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('enrollment.dateOfBirth')}</p>
                          <p className="font-medium">{formatLocalizedDate(enrollment.date_of_birth, 'PP', locale)}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">{t('enrollment.address')}</p>
                        <p className="font-medium">{enrollment.address}</p>
                      </div>
                    </Card>
                    <Card className="p-6">
                      <h3 className="font-semibold mb-4">{t('common.status')}</h3>
                      <div className="flex items-center gap-3 mb-4">
                        {getStatusBadge(enrollment.status)}
                        {enrollment.submitted_at && (
                          <span className="text-sm text-muted-foreground">
                            {t('enrollment.submittedAt')}: {formatLocalizedDate(enrollment.submitted_at, 'PPp', locale)}
                          </span>
                        )}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">{t('userDetail.noEnrollment')}</p>
                )}
              </TabsContent>

              {/* Audit Tab */}
              <TabsContent value="audit" className="mt-0">
                <div className="space-y-3">
                  {auditLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t('auditHistory.noHistory')}</p>
                  ) : (
                    auditLogs.map((log) => (
                      <Card key={log.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant="outline" className="mb-2">{log.table_name}</Badge>
                            <p className="text-sm">
                              <span className="text-muted-foreground">{log.old_status || '-'}</span>
                              <ChevronRight className="inline h-4 w-4 mx-1" />
                              <span className="font-medium">{log.new_status}</span>
                            </p>
                            {log.notes && <p className="text-sm text-muted-foreground mt-1">{log.notes}</p>}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p>{formatLocalizedDate(log.created_at, 'PP', locale)}</p>
                            <p>{t('auditHistory.by')} {log.changed_by_name}</p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false, type: 'task', item: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('coach.reviewTaskSubmission')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {reviewDialog.type === 'task' && reviewDialog.item && (
              <>
                <div>
                  <label className="text-sm font-medium">{t('coach.submissionNotes')}</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviewDialog.item.submission_notes || t('coach.noNotesProvided')}
                  </p>
                </div>
                {reviewDialog.item.attachment_url && (
                  <div>
                    <label className="text-sm font-medium">{t('coach.attachment')}</label>
                    <Button variant="link" className="p-0 h-auto" asChild>
                      <a href={reviewDialog.item.attachment_url} target="_blank" rel="noopener noreferrer">
                        {t('coach.viewAttachment')}
                      </a>
                    </Button>
                  </div>
                )}
              </>
            )}
            
            {reviewDialog.type === 'document' && reviewDialog.item && (
              <>
                <div>
                  <label className="text-sm font-medium">{t('coach.documentType')}</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(`documentTypes.${reviewDialog.item.document_type}`) || reviewDialog.item.document_type}
                  </p>
                </div>
                {reviewDialog.item.file_url && (
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <a href={reviewDialog.item.file_url} target="_blank" rel="noopener noreferrer">
                      {t('coach.viewAttachment')}
                    </a>
                  </Button>
                )}
              </>
            )}

            {reviewDialog.type === 'trade' && reviewDialog.item && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">{t('trades.type')}</label>
                    <p className="text-sm text-muted-foreground">{t(`trades.${reviewDialog.item.trade_type}`)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('trades.amount')}</label>
                    <p className="text-sm text-muted-foreground">₹{formatLocalizedNumber(reviewDialog.item.amount, locale)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('trades.product')}</label>
                    <p className="text-sm text-muted-foreground">{reviewDialog.item.product_service}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('trades.country')}</label>
                    <p className="text-sm text-muted-foreground">{reviewDialog.item.country}</p>
                  </div>
                </div>
                {reviewDialog.item.attachment_url && (
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <a href={reviewDialog.item.attachment_url} target="_blank" rel="noopener noreferrer">
                      <Paperclip className="h-4 w-4 mr-1" />{t('coach.viewAttachment')}
                    </a>
                  </Button>
                )}
              </>
            )}
            
            <div>
              <label className="text-sm font-medium">{t('coach.yourFeedback')}</label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t('coach.feedbackPlaceholder')}
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="destructive"
                onClick={() => handleApproval(reviewDialog.type, false)}
                disabled={updating !== null}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {t('coach.reject')}
              </Button>
              <Button
                onClick={() => handleApproval(reviewDialog.type, true)}
                disabled={updating !== null}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('coach.approve')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit on Behalf Dialog */}
      <Dialog open={submitDialog.open} onOpenChange={(open) => !open && setSubmitDialog({ open: false, taskId: '', taskTitle: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.submitTaskForUser')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('tasks.title')}</label>
              <p className="text-sm text-muted-foreground mt-1">{submitDialog.taskTitle}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium">{t('admin.submissionNotes')}</label>
              <Textarea
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
                placeholder={t('admin.submissionNotesPlaceholder')}
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSubmitDialog({ open: false, taskId: '', taskTitle: '' })}>
                {t('common.cancel')}
              </Button>
              <Button onClick={submitTaskForUser} disabled={updating !== null}>
                <Send className="w-4 h-4 mr-2" />
                {t('admin.submitAndVerify')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
