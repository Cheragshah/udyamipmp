import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, UserCheck, Crown, GraduationCap, User, CheckCircle, XCircle, FileText, ClipboardList, History, ExternalLink, TrendingUp, Paperclip, Search, GitCompare, Zap, Link as LinkIcon, Calendar, Loader2, CalendarCheck, RotateCcw, Mail, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Profile, AppRole } from '@/types/database';
import { formatLocalizedNumber, formatLocalizedDate } from '@/lib/formatters';
import UserDetailDialog from '@/components/admin/UserDetailDialog';
import UserComparisonView from '@/components/admin/UserComparisonView';
import BulkActionsDialog from '@/components/admin/BulkActionsDialog';
import SessionCompletionManager from '@/components/admin/SessionCompletionManager';
import LinksManagement from '@/components/admin/LinksManagement';
import AttendanceManager from '@/components/admin/AttendanceManager';
import NotificationSettings from '@/components/admin/NotificationSettings';
import RoleNavigationManager from '@/components/admin/RoleNavigationManager';

interface UserWithRole extends Profile {
  role: AppRole;
  coach_name?: string;
  batch_number?: string | null;
  unique_id?: string | null;
}

interface TaskSubmission {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  submission_notes: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  participant_name?: string;
  task_title?: string;
}

interface DocumentSubmission {
  id: string;
  user_id: string;
  document_type: string;
  document_name: string;
  file_url: string | null;
  status: string;
  submitted_at: string | null;
  participant_name?: string;
}

interface EnrollmentSubmission {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string;
  status: string;
  notes: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
}

interface TradeSubmission {
  id: string;
  user_id: string;
  trade_type: string;
  product_service: string;
  country: string;
  amount: number;
  trade_date: string;
  status: string;
  attachment_url: string | null;
  notes: string | null;
  participant_name?: string;
}

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  user_id: string;
  action: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  notes: string | null;
  created_at: string;
  user_name?: string;
  changed_by_name?: string;
}

const Admin = () => {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  
  // New state for approvals
  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [documentSubmissions, setDocumentSubmissions] = useState<DocumentSubmission[]>([]);
  const [enrollmentSubmissions, setEnrollmentSubmissions] = useState<EnrollmentSubmission[]>([]);
  const [tradeSubmissions, setTradeSubmissions] = useState<TradeSubmission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Approved/Verified records for reopen functionality
  const [approvedDocuments, setApprovedDocuments] = useState<DocumentSubmission[]>([]);
  const [verifiedTasks, setVerifiedTasks] = useState<TaskSubmission[]>([]);
  
  // Dialog state
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; type: 'task' | 'document' | 'enrollment' | 'trade'; item: any }>({ 
    open: false, 
    type: 'task', 
    item: null 
  });
  const [feedback, setFeedback] = useState('');
  
  // User detail dialog state
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  
  // New dialogs state
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [bulkActionsUser, setBulkActionsUser] = useState<UserWithRole | null>(null);
  const [sessionManagerUser, setSessionManagerUser] = useState<UserWithRole | null>(null);
  const [batchEditDialog, setBatchEditDialog] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [batchNumber, setBatchNumber] = useState('');

  const locale = i18n.language;

  useEffect(() => {
    if (user && role === 'admin') {
      fetchAllData();
    }
  }, [user, role]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchTaskSubmissions(),
      fetchDocumentSubmissions(),
      fetchEnrollmentSubmissions(),
      fetchTradeSubmissions(),
      fetchAuditLogs(),
      fetchApprovedDocuments(),
      fetchVerifiedTasks()
    ]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const coach = profiles?.find(p => p.id === profile.assigned_coach_id);
        return {
          ...profile,
          role: (userRole?.role as AppRole) || 'participant',
          coach_name: coach?.full_name || undefined,
          batch_number: (profile as any).batch_number || null,
          unique_id: (profile as any).unique_id || null
        };
      });

      setUsers(usersWithRoles);
      setCoaches(usersWithRoles.filter(u => u.role === 'coach' || u.role === 'admin'));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('admin.failedToLoad'));
    }
  };

  const fetchTaskSubmissions = async () => {
    try {
      const { data: submissions, error } = await supabase
        .from('task_submissions')
        .select('*')
        .in('status', ['submitted', 'in_progress'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');
      const { data: tasks } = await supabase.from('tasks').select('id, title');

      const enriched = (submissions || []).map(s => ({
        ...s,
        participant_name: profiles?.find(p => p.id === s.user_id)?.full_name || 'Unknown',
        task_title: tasks?.find(t => t.id === s.task_id)?.title || 'Unknown Task'
      }));

      setTaskSubmissions(enriched);
    } catch (error) {
      console.error('Error fetching task submissions:', error);
    }
  };

  const fetchDocumentSubmissions = async () => {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');

      const enriched = (documents || []).map(d => ({
        ...d,
        participant_name: profiles?.find(p => p.id === d.user_id)?.full_name || 'Unknown'
      }));

      setDocumentSubmissions(enriched);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchEnrollmentSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollment_submissions')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setEnrollmentSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    }
  };

  const fetchTradeSubmissions = async () => {
    try {
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');

      const enriched = (trades || []).map(t => ({
        ...t,
        participant_name: profiles?.find(p => p.id === t.user_id)?.full_name || 'Unknown'
      }));

      setTradeSubmissions(enriched);
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');

      const enriched = ((data as any[]) || []).map((log: any) => ({
        ...log,
        user_name: profiles?.find(p => p.id === log.user_id)?.full_name || 'Unknown',
        changed_by_name: profiles?.find(p => p.id === log.changed_by)?.full_name || 'System'
      })) as AuditLog[];

      setAuditLogs(enriched);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const fetchApprovedDocuments = async () => {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'approved')
        .order('reviewed_at', { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');

      const enriched = (documents || []).map(d => ({
        ...d,
        participant_name: profiles?.find(p => p.id === d.user_id)?.full_name || 'Unknown'
      }));

      setApprovedDocuments(enriched);
    } catch (error) {
      console.error('Error fetching approved documents:', error);
    }
  };

  const fetchVerifiedTasks = async () => {
    try {
      const { data: submissions, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('status', 'verified')
        .order('verified_at', { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from('profiles').select('id, full_name');
      const { data: tasks } = await supabase.from('tasks').select('id, title');

      const enriched = (submissions || []).map(s => ({
        ...s,
        participant_name: profiles?.find(p => p.id === s.user_id)?.full_name || 'Unknown',
        task_title: tasks?.find(t => t.id === s.task_id)?.title || 'Unknown Task'
      }));

      setVerifiedTasks(enriched);
    } catch (error) {
      console.error('Error fetching verified tasks:', error);
    }
  };

  const handleReopenDocument = async (docId: string) => {
    setUpdating(docId);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null
        })
        .eq('id', docId);

      if (error) throw error;
      toast.success(t('admin.documentReopened'));
      fetchApprovedDocuments();
      fetchDocumentSubmissions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error reopening document:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  const handleReopenTask = async (taskId: string) => {
    setUpdating(taskId);
    try {
      const { error } = await supabase
        .from('task_submissions')
        .update({
          status: 'submitted',
          verified_by: null,
          verified_at: null,
          verification_notes: null
        })
        .eq('id', taskId);

      if (error) throw error;
      toast.success(t('admin.taskReopened'));
      fetchVerifiedTasks();
      fetchTaskSubmissions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error reopening task:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    setUpdating(userId);
    try {
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }

      toast.success(t('admin.roleUpdated'));
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(t('admin.failedToUpdateRole'));
    } finally {
      setUpdating(null);
    }
  };

  const assignCoach = async (participantId: string, coachId: string | null) => {
    setUpdating(participantId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ assigned_coach_id: coachId === 'none' ? null : coachId })
        .eq('id', participantId);

      if (error) throw error;
      toast.success(t('admin.coachAssigned'));
      fetchUsers();
    } catch (error) {
      console.error('Error assigning coach:', error);
      toast.error(t('admin.failedToAssignCoach'));
    } finally {
      setUpdating(null);
    }
  };

  const handleTaskApproval = async (approved: boolean) => {
    if (!reviewDialog.item) return;
    setUpdating(reviewDialog.item.id);
    
    try {
      const { error } = await supabase
        .from('task_submissions')
        .update({
          status: approved ? 'verified' : 'rejected',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          verification_notes: feedback || null
        })
        .eq('id', reviewDialog.item.id);

      if (error) throw error;
      toast.success(approved ? t('coach.taskApproved') : t('coach.taskRejected'));
      setReviewDialog({ open: false, type: 'task', item: null });
      setFeedback('');
      fetchTaskSubmissions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setUpdating(null);
    }
  };

  const handleDocumentApproval = async (approved: boolean) => {
    if (!reviewDialog.item) return;
    setUpdating(reviewDialog.item.id);
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: feedback || null
        })
        .eq('id', reviewDialog.item.id);

      if (error) throw error;
      toast.success(approved ? t('coach.docApproved') : t('coach.docRejected'));
      setReviewDialog({ open: false, type: 'document', item: null });
      setFeedback('');
      fetchDocumentSubmissions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setUpdating(null);
    }
  };

  const handleTradeApproval = async (approved: boolean) => {
    if (!reviewDialog.item) return;
    setUpdating(reviewDialog.item.id);
    
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          approval_notes: feedback || null
        })
        .eq('id', reviewDialog.item.id);

      if (error) throw error;
      toast.success(approved ? t('coach.tradeApproved') : t('coach.tradeRejected'));
      setReviewDialog({ open: false, type: 'trade', item: null });
      setFeedback('');
      fetchTradeSubmissions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating trade:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setUpdating(null);
    }
  };

  const handleEnrollmentStatusUpdate = async (enrollmentId: string, newStatus: string) => {
    setUpdating(enrollmentId);
    try {
      const { error } = await supabase
        .from('enrollment_submissions')
        .update({
          status: newStatus,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', enrollmentId);

      if (error) throw error;
      toast.success(t('enrollment.statusUpdated'));
      fetchEnrollmentSubmissions();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error updating enrollment:', error);
      toast.error(t('enrollment.updateFailed'));
    } finally {
      setUpdating(null);
    }
  };

  // Batch update function
  const handleBulkBatchUpdate = async () => {
    if (selectedUserIds.length === 0 || !batchNumber) {
      toast.error(t('admin.selectUsersAndBatch'));
      return;
    }
    setUpdating('batch');
    try {
      for (const userId of selectedUserIds) {
        await supabase.from('profiles').update({ batch_number: batchNumber }).eq('id', userId);
      }
      toast.success(t('admin.batchUpdated', { count: selectedUserIds.length }));
      setSelectedUserIds([]);
      setBatchNumber('');
      setBatchEditDialog(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating batch:', error);
      toast.error(t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getRoleBadge = (userRole: AppRole) => {
    switch (userRole) {
      case 'admin':
        return <Badge className="bg-destructive text-destructive-foreground"><Crown className="w-3 h-3 mr-1" />{t('roles.admin')}</Badge>;
      case 'coach':
        return <Badge className="bg-primary text-primary-foreground"><GraduationCap className="w-3 h-3 mr-1" />{t('roles.coach')}</Badge>;
      case 'ecommerce':
        return <Badge className="bg-purple-500 text-white">{t('roles.ecommerce')}</Badge>;
      case 'finance':
        return <Badge className="bg-green-600 text-white">{t('roles.finance')}</Badge>;
      default:
        return <Badge variant="secondary"><User className="w-3 h-3 mr-1" />{t('roles.participant')}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
      case 'approved':
      case 'completed':
        return <Badge className="bg-green-500 text-white">{t(`enrollment.statuses.${status}`) || status}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{status}</Badge>;
      case 'submitted':
      case 'pending':
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'approved':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />{action}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{action}</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t('admin.accessDenied')}</CardTitle>
            <CardDescription>{t('admin.noPermission')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const participantsList = users.filter(u => u.role === 'participant');
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    coaches: users.filter(u => u.role === 'coach').length,
    participants: participantsList.length,
    assigned: participantsList.filter(p => p.assigned_coach_id).length,
    pendingTasks: taskSubmissions.length,
    pendingDocs: documentSubmissions.length,
    pendingTrades: tradeSubmissions.length
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('admin.title')}</h1>
        <p className="text-muted-foreground">{t('admin.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(stats.total, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.pendingTasks')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(stats.pendingTasks, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.pendingDocs')}</CardTitle>
            <FileText className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(stats.pendingDocs, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.participantsAssigned')}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(stats.assigned, locale)}/{formatLocalizedNumber(stats.participants, locale)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users">{t('admin.allUsers')}</TabsTrigger>
          <TabsTrigger value="roles">{t('admin.roleManagement')}</TabsTrigger>
          <TabsTrigger value="assignments">{t('admin.coachAssignments')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('admin.taskApprovals')}</TabsTrigger>
          <TabsTrigger value="verifiedTasks" className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            {t('admin.verifiedTasks')}
          </TabsTrigger>
          <TabsTrigger value="documents">{t('admin.documentApprovals')}</TabsTrigger>
          <TabsTrigger value="approvedDocs" className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3" />
            {t('admin.approvedDocuments')}
          </TabsTrigger>
          <TabsTrigger value="trades">{t('admin.tradeApprovals')}</TabsTrigger>
          <TabsTrigger value="enrollments">{t('admin.enrollmentReviews')}</TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-1">
            <CalendarCheck className="h-3 w-3" />
            {t('admin.attendance')}
          </TabsTrigger>
          <TabsTrigger value="links" className="flex items-center gap-1">
            <LinkIcon className="h-3 w-3" />
            {t('admin.links')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {t('admin.notifications')}
          </TabsTrigger>
          <TabsTrigger value="audit">{t('admin.auditHistory')}</TabsTrigger>
          <TabsTrigger value="navigation" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {t('admin.roleNavigation')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>{t('admin.allUsers')}</CardTitle>
                  <CardDescription>{t('admin.viewAllUsers')}</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => setComparisonOpen(true)}>
                    <GitCompare className="h-4 w-4 mr-2" />
                    {t('admin.compareUsers')}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setBatchEditDialog(true)}
                    disabled={selectedUserIds.length === 0}
                  >
                    {t('admin.updateBatch')} ({selectedUserIds.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchUsers')}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedUserIds.length === participantsList.length && participantsList.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUserIds(participantsList.map(u => u.id));
                          } else {
                            setSelectedUserIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>{t('admin.name')}</TableHead>
                    <TableHead>{t('admin.email')}</TableHead>
                    <TableHead>{t('admin.batchNumber')}</TableHead>
                    <TableHead>{t('admin.uniqueId')}</TableHead>
                    <TableHead>{t('admin.role')}</TableHead>
                    <TableHead>{t('admin.assignedCoach')}</TableHead>
                    <TableHead>{t('coach.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users
                    .filter((u) => {
                      const search = userSearch.toLowerCase();
                      return (
                        !search ||
                        u.full_name?.toLowerCase().includes(search) ||
                        u.email?.toLowerCase().includes(search) ||
                        u.phone?.toLowerCase().includes(search) ||
                        u.batch_number?.toLowerCase().includes(search)
                      );
                    })
                    .map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedUserIds.includes(u.id)}
                          onCheckedChange={() => toggleUserSelection(u.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="font-medium text-primary hover:underline cursor-pointer text-left"
                        >
                          {u.full_name || t('common.na')}
                        </button>
                      </TableCell>
                      <TableCell>{u.email || t('common.na')}</TableCell>
                      <TableCell>
                        {u.batch_number ? (
                          <Badge variant="outline">{u.batch_number}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.unique_id ? (
                          <Badge variant="secondary" className="font-mono text-xs">{u.unique_id}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">{t('admin.pendingUniqueId')}</span>
                        )}
                      </TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>{u.coach_name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setBulkActionsUser(u)}
                            title={t('admin.bulkActions')}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSessionManagerUser(u)}
                            title={t('admin.manageSessions')}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.roleManagement')}</CardTitle>
              <CardDescription>{t('admin.assignOrChangeRoles')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.name')}</TableHead>
                    <TableHead>{t('admin.email')}</TableHead>
                    <TableHead>{t('admin.currentRole')}</TableHead>
                    <TableHead>{t('admin.changeRole')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || t('common.na')}</TableCell>
                      <TableCell>{u.email || t('common.na')}</TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(value) => updateUserRole(u.id, value as AppRole)}
                          disabled={updating === u.id || u.id === user?.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="participant">{t('roles.participant')}</SelectItem>
                            <SelectItem value="coach">{t('roles.coach')}</SelectItem>
                            <SelectItem value="ecommerce">{t('roles.ecommerce')}</SelectItem>
                            <SelectItem value="finance">{t('roles.finance')}</SelectItem>
                            <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.coachParticipantAssignments')}</CardTitle>
              <CardDescription>{t('admin.assignCoachesToParticipants')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.participant')}</TableHead>
                    <TableHead>{t('admin.email')}</TableHead>
                    <TableHead>{t('admin.currentCoach')}</TableHead>
                    <TableHead>{t('admin.assignCoach')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantsList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name || t('common.na')}</TableCell>
                      <TableCell>{p.email || t('common.na')}</TableCell>
                      <TableCell>{p.coach_name || t('admin.unassigned')}</TableCell>
                      <TableCell>
                        <Select
                          value={p.assigned_coach_id || 'none'}
                          onValueChange={(value) => assignCoach(p.id, value)}
                          disabled={updating === p.id}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('admin.selectCoach')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('admin.unassigned')}</SelectItem>
                            {coaches.map((coach) => (
                              <SelectItem key={coach.id} value={coach.id}>
                                {coach.full_name || coach.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.taskApprovals')}</CardTitle>
              <CardDescription>{t('admin.reviewAllTasks')}</CardDescription>
            </CardHeader>
            <CardContent>
              {taskSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('coach.noPendingTasks')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.task')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('coach.submitted')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.participant_name}</TableCell>
                        <TableCell>{submission.task_title}</TableCell>
                        <TableCell>{getStatusBadge(submission.status)}</TableCell>
                        <TableCell>{submission.submitted_at ? formatLocalizedDate(submission.submitted_at, 'PP', locale) : '-'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewDialog({ open: true, type: 'task', item: submission })}
                          >
                            {t('coach.review')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.documentApprovals')}</CardTitle>
              <CardDescription>{t('admin.reviewAllDocs')}</CardDescription>
            </CardHeader>
            <CardContent>
              {documentSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('coach.noPendingDocs')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.documentType')}</TableHead>
                      <TableHead>{t('coach.fileName')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentSubmissions.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.participant_name}</TableCell>
                        <TableCell>{t(`documentTypes.${doc.document_type}`) || doc.document_type}</TableCell>
                        <TableCell>{doc.document_name}</TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {doc.file_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReviewDialog({ open: true, type: 'document', item: doc })}
                            >
                              {t('coach.review')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.tradeApprovals')}</CardTitle>
              <CardDescription>{t('admin.reviewAllTrades')}</CardDescription>
            </CardHeader>
            <CardContent>
              {tradeSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('coach.noPendingTrades')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('trades.type')}</TableHead>
                      <TableHead>{t('trades.product')}</TableHead>
                      <TableHead>{t('trades.country')}</TableHead>
                      <TableHead>{t('trades.amount')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tradeSubmissions.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium">{trade.participant_name}</TableCell>
                        <TableCell>{t(`trades.${trade.trade_type}`)}</TableCell>
                        <TableCell>{trade.product_service}</TableCell>
                        <TableCell>{trade.country}</TableCell>
                        <TableCell>₹{trade.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {trade.attachment_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={trade.attachment_url} target="_blank" rel="noopener noreferrer">
                                  <Paperclip className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReviewDialog({ open: true, type: 'trade', item: trade })}
                            >
                              {t('coach.review')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.enrollmentReviews')}</CardTitle>
              <CardDescription>{t('admin.manageEnrollments')}</CardDescription>
            </CardHeader>
            <CardContent>
              {enrollmentSubmissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('admin.noEnrollments')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('enrollment.fullName')}</TableHead>
                      <TableHead>{t('enrollment.email')}</TableHead>
                      <TableHead>{t('enrollment.phone')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('admin.updateStatus')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollmentSubmissions.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="font-medium">{enrollment.full_name}</TableCell>
                        <TableCell>{enrollment.email}</TableCell>
                        <TableCell>{enrollment.phone}</TableCell>
                        <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                        <TableCell>
                          <Select
                            value={enrollment.status}
                            onValueChange={(value) => handleEnrollmentStatusUpdate(enrollment.id, value)}
                            disabled={updating === enrollment.id}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">{t('enrollment.statuses.submitted')}</SelectItem>
                              <SelectItem value="documents_sent_to_user">{t('enrollment.statuses.documents_sent_to_user')}</SelectItem>
                              <SelectItem value="documents_sent_to_office">{t('enrollment.statuses.documents_sent_to_office')}</SelectItem>
                              <SelectItem value="completed">{t('enrollment.statuses.completed')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <AttendanceManager />
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links">
          <LinksManagement />
        </TabsContent>

        {/* Verified Tasks Tab - for reopen */}
        <TabsContent value="verifiedTasks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                {t('admin.verifiedTasks')}
              </CardTitle>
              <CardDescription>{t('admin.verifiedTasksDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('admin.noVerifiedTasks')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.task')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('admin.verifiedAt')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verifiedTasks.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.participant_name}</TableCell>
                        <TableCell>{submission.task_title}</TableCell>
                        <TableCell>{getStatusBadge(submission.status)}</TableCell>
                        <TableCell>{submission.verified_at ? formatLocalizedDate(submission.verified_at, 'PP', locale) : '-'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReopenTask(submission.id)}
                            disabled={updating === submission.id}
                          >
                            {updating === submission.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                {t('admin.reopen')}
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approved Documents Tab - for reopen */}
        <TabsContent value="approvedDocs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                {t('admin.approvedDocuments')}
              </CardTitle>
              <CardDescription>{t('admin.approvedDocsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {approvedDocuments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('admin.noApprovedDocuments')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.documentType')}</TableHead>
                      <TableHead>{t('coach.fileName')}</TableHead>
                      <TableHead>{t('admin.approvedAt')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.participant_name}</TableCell>
                        <TableCell>{t(`documentTypes.${doc.document_type}`) || doc.document_type}</TableCell>
                        <TableCell>{doc.document_name}</TableCell>
                        <TableCell>{doc.submitted_at ? formatLocalizedDate(doc.submitted_at, 'PP', locale) : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {doc.file_url && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReopenDocument(doc.id)}
                              disabled={updating === doc.id}
                            >
                              {updating === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  {t('admin.reopen')}
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('admin.auditHistory')}
              </CardTitle>
              <CardDescription>{t('admin.auditDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('admin.noAuditLogs')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.timestamp')}</TableHead>
                      <TableHead>{t('admin.table')}</TableHead>
                      <TableHead>{t('admin.user')}</TableHead>
                      <TableHead>{t('admin.action')}</TableHead>
                      <TableHead>{t('admin.oldStatus')}</TableHead>
                      <TableHead>{t('admin.newStatus')}</TableHead>
                      <TableHead>{t('admin.changedBy')}</TableHead>
                      <TableHead>{t('admin.notes')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">{formatLocalizedDate(log.created_at, 'PPp', locale)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.table_name}</Badge>
                        </TableCell>
                        <TableCell>{log.user_name}</TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>{log.old_status || '-'}</TableCell>
                        <TableCell>{log.new_status}</TableCell>
                        <TableCell>{log.changed_by_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{log.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Navigation Tab */}
        <TabsContent value="navigation">
          <RoleNavigationManager />
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false, type: 'task', item: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.type === 'task' ? t('coach.reviewTaskSubmission') : t('coach.reviewDocument')}
            </DialogTitle>
            <DialogDescription>{t('coach.reviewDescription')}</DialogDescription>
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
                  <div>
                    <label className="text-sm font-medium">{t('coach.attachment')}</label>
                    <Button variant="link" className="p-0 h-auto" asChild>
                      <a href={reviewDialog.item.file_url} target="_blank" rel="noopener noreferrer">
                        {t('coach.viewAttachment')}
                      </a>
                    </Button>
                  </div>
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
                    <p className="text-sm text-muted-foreground">₹{reviewDialog.item.amount?.toLocaleString()}</p>
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
                  <div>
                    <label className="text-sm font-medium">{t('coach.attachment')}</label>
                    <Button variant="link" className="p-0 h-auto" asChild>
                      <a href={reviewDialog.item.attachment_url} target="_blank" rel="noopener noreferrer">
                        <Paperclip className="h-4 w-4 mr-1" />
                        {t('coach.viewAttachment')}
                      </a>
                    </Button>
                  </div>
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
                onClick={() => {
                  if (reviewDialog.type === 'task') handleTaskApproval(false);
                  else if (reviewDialog.type === 'document') handleDocumentApproval(false);
                  else if (reviewDialog.type === 'trade') handleTradeApproval(false);
                }}
                disabled={updating !== null}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {t('coach.reject')}
              </Button>
              <Button
                onClick={() => {
                  if (reviewDialog.type === 'task') handleTaskApproval(true);
                  else if (reviewDialog.type === 'document') handleDocumentApproval(true);
                  else if (reviewDialog.type === 'trade') handleTradeApproval(true);
                }}
                disabled={updating !== null}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('coach.approve')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      {selectedUser && (
        <UserDetailDialog
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.full_name || ''}
          userRole={selectedUser.role}
          userEmail={selectedUser.email || undefined}
          userPhone={selectedUser.phone || undefined}
          coachName={selectedUser.coach_name}
        />
      )}

      {/* User Comparison View */}
      <UserComparisonView 
        users={users} 
        open={comparisonOpen} 
        onOpenChange={setComparisonOpen} 
      />

      {/* Bulk Actions Dialog */}
      {bulkActionsUser && (
        <BulkActionsDialog
          open={!!bulkActionsUser}
          onOpenChange={(open) => !open && setBulkActionsUser(null)}
          userId={bulkActionsUser.id}
          userName={bulkActionsUser.full_name || ''}
          onComplete={fetchAllData}
        />
      )}

      {/* Session Completion Manager */}
      {sessionManagerUser && (
        <SessionCompletionManager
          open={!!sessionManagerUser}
          onOpenChange={(open) => !open && setSessionManagerUser(null)}
          userId={sessionManagerUser.id}
          userName={sessionManagerUser.full_name || ''}
          onComplete={fetchAllData}
        />
      )}

      {/* Batch Edit Dialog */}
      <Dialog open={batchEditDialog} onOpenChange={setBatchEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.updateBatchNumber')}</DialogTitle>
            <DialogDescription>
              {t('admin.updateBatchDescription', { count: selectedUserIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder={t('admin.enterBatchNumber')}
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('admin.selectedUsers')}: {selectedUserIds.length}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchEditDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBulkBatchUpdate} disabled={!batchNumber || updating === 'batch'}>
              {t('admin.updateBatch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;