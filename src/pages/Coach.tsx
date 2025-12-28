import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Eye, FileText, ClipboardList, Users, Paperclip, TrendingUp, UserPlus, LayoutDashboard, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatLocalizedNumber, formatLocalizedDate } from '@/lib/formatters';
import FacilitatorDashboard from '@/components/coach/FacilitatorDashboard';
import UserDetailDialog from '@/components/admin/UserDetailDialog';
import type { AppRole } from '@/types/database';

interface TaskSubmissionWithDetails {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  submission_notes: string | null;
  attachment_url: string | null;
  submitted_at: string | null;
  participant_name: string;
  participant_email: string;
  task_title: string;
  task_description: string | null;
}

interface DocumentWithDetails {
  id: string;
  user_id: string;
  document_type: string;
  document_name: string;
  file_url: string | null;
  status: string;
  submitted_at: string | null;
  participant_name: string;
  participant_email: string;
}

interface TradeWithDetails {
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
  participant_name: string;
  participant_email: string;
}

interface EnrollmentWithDetails {
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
  participant_name: string;
  participant_email: string;
}
const Coach = () => {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const [pendingTasks, setPendingTasks] = useState<TaskSubmissionWithDetails[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<DocumentWithDetails[]>([]);
  const [participants, setParticipants] = useState<{ id: string; full_name: string; email: string; phone: string | null; batch_number: string | null }[]>([]);
  const [pendingTrades, setPendingTrades] = useState<TradeWithDetails[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [pendingEnrollments, setPendingEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskSubmissionWithDetails | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithDetails | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeWithDetails | null>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentWithDetails | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const locale = i18n.language;

  useEffect(() => {
    if (user && (role === 'coach' || role === 'admin')) {
      fetchData();
    }
  }, [user, role]);

  const fetchData = async () => {
    try {
      // First get assigned participants
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, batch_number, assigned_coach_id');

      const assignedParticipants = role === 'admin' 
        ? profiles || []
        : (profiles || []).filter(p => p.assigned_coach_id === user?.id);
      
      setParticipants(assignedParticipants.map(p => ({
        id: p.id,
        full_name: p.full_name || 'Unknown',
        email: p.email || 'No email',
        phone: p.phone,
        batch_number: p.batch_number
      })));

      const participantIds = assignedParticipants.map(p => p.id);

      if (participantIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch tasks and submissions
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, description');

      const { data: submissions } = await supabase
        .from('task_submissions')
        .select('*')
        .in('user_id', participantIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      const pendingTasksList: TaskSubmissionWithDetails[] = (submissions || []).map(sub => {
        const task = tasks?.find(t => t.id === sub.task_id);
        const participant = assignedParticipants.find(p => p.id === sub.user_id);
        return {
          ...sub,
          participant_name: participant?.full_name || 'Unknown',
          participant_email: participant?.email || '',
          task_title: task?.title || 'Unknown Task',
          task_description: task?.description || null
        };
      });

      setPendingTasks(pendingTasksList);

      // Fetch documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .in('user_id', participantIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      const pendingDocsList: DocumentWithDetails[] = (docs || []).map(doc => {
        const participant = assignedParticipants.find(p => p.id === doc.user_id);
        return {
          ...doc,
          participant_name: participant?.full_name || 'Unknown',
          participant_email: participant?.email || ''
        };
      });

      setPendingDocuments(pendingDocsList);

      // Fetch pending trades
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .in('user_id', participantIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const pendingTradesList: TradeWithDetails[] = (trades || []).map(trade => {
        const participant = assignedParticipants.find(p => p.id === trade.user_id);
        return {
          ...trade,
          participant_name: participant?.full_name || 'Unknown',
          participant_email: participant?.email || ''
        };
      });

      setPendingTrades(pendingTradesList);

      // Fetch pending enrollments that need coach action (submitted or documents_sent_to_office)
      const { data: enrollments } = await supabase
        .from('enrollment_submissions')
        .select('*')
        .in('user_id', participantIds)
        .in('status', ['submitted', 'documents_sent_to_office'])
        .order('submitted_at', { ascending: false });

      const pendingEnrollmentsList: EnrollmentWithDetails[] = (enrollments || []).map(enrollment => {
        const participant = assignedParticipants.find(p => p.id === enrollment.user_id);
        return {
          ...enrollment,
          participant_name: participant?.full_name || 'Unknown',
          participant_email: participant?.email || ''
        };
      });

      setPendingEnrollments(pendingEnrollmentsList);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('coach.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleTaskVerification = async (approve: boolean) => {
    if (!selectedTask) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('task_submissions')
        .update({
          status: approve ? 'verified' : 'rejected',
          verified_by: user?.id,
          verification_notes: verificationNotes,
          verified_at: new Date().toISOString()
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      toast.success(approve ? t('coach.taskApproved') : t('coach.taskRejected'));
      setSelectedTask(null);
      setVerificationNotes('');
      fetchData();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setProcessing(false);
    }
  };

  const handleDocumentVerification = async (approve: boolean) => {
    if (!selectedDocument) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status: approve ? 'approved' : 'rejected',
          reviewed_by: user?.id,
          review_notes: verificationNotes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedDocument.id);

      if (error) throw error;

      toast.success(approve ? t('coach.documentApproved') : t('coach.documentRejected'));
      setSelectedDocument(null);
      setVerificationNotes('');
      fetchData();
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setProcessing(false);
    }
  };

  const handleTradeVerification = async (approve: boolean) => {
    if (!selectedTrade) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          status: approve ? 'approved' : 'rejected',
          approved_by: user?.id,
          approval_notes: verificationNotes,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedTrade.id);

      if (error) throw error;

      toast.success(approve ? t('coach.tradeApproved') : t('coach.tradeRejected'));
      setSelectedTrade(null);
      setVerificationNotes('');
      fetchData();
    } catch (error) {
      console.error('Error updating trade:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setProcessing(false);
    }
  };

  const handleEnrollmentStatusUpdate = async (newStatus: string) => {
    if (!selectedEnrollment) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('enrollment_submissions')
        .update({
          status: newStatus,
          updated_by: user?.id,
          notes: verificationNotes || selectedEnrollment.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEnrollment.id);

      if (error) throw error;

      toast.success(t('coach.enrollmentStatusUpdated'));
      setSelectedEnrollment(null);
      setVerificationNotes('');
      fetchData();
    } catch (error) {
      console.error('Error updating enrollment:', error);
      toast.error(t('coach.failedToUpdate'));
    } finally {
      setProcessing(false);
    }
  };

  const getEnrollmentStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="secondary">{t('coach.enrollmentStatus.submitted')}</Badge>;
      case 'documents_sent_to_user':
        return <Badge className="bg-blue-500">{t('coach.enrollmentStatus.documentsSentToUser')}</Badge>;
      case 'documents_sent_to_office':
        return <Badge className="bg-orange-500">{t('coach.enrollmentStatus.documentsSentToOffice')}</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">{t('coach.enrollmentStatus.completed')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDocumentTypeName = (type: string) => {
    return t(`documents.types.${type}`, type);
  };

  if (role !== 'coach' && role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t('coach.accessDenied')}</CardTitle>
            <CardDescription>{t('coach.noPermission')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('coach.title')}</h1>
        <p className="text-muted-foreground">{t('coach.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.assignedParticipants')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(participants.length, locale)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingTaskReviews')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(pendingTasks.length, locale)}</div>
            {pendingTasks.length > 0 && (
              <Badge variant="destructive" className="mt-2">{t('coach.actionRequired')}</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingDocumentReviews')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(pendingDocuments.length, locale)}</div>
            {pendingDocuments.length > 0 && (
              <Badge variant="destructive" className="mt-2">{t('coach.actionRequired')}</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingTradeReviews')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(pendingTrades.length, locale)}</div>
            {pendingTrades.length > 0 && (
              <Badge variant="destructive" className="mt-2">{t('coach.actionRequired')}</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingEnrollments')}</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(pendingEnrollments.length, locale)}</div>
            {pendingEnrollments.length > 0 && (
              <Badge variant="destructive" className="mt-2">{t('coach.actionRequired')}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            {t('facilitator.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="participants">
            <Users className="h-4 w-4 mr-2" />
            {t('coach.participants')}
            <Badge variant="secondary" className="ml-2">{formatLocalizedNumber(participants.length, locale)}</Badge>
          </TabsTrigger>
          <TabsTrigger value="tasks">
            {t('coach.taskSubmissions')}
            {pendingTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{formatLocalizedNumber(pendingTasks.length, locale)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t('coach.documents')}
            {pendingDocuments.length > 0 && (
              <Badge variant="secondary" className="ml-2">{formatLocalizedNumber(pendingDocuments.length, locale)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trades">
            {t('coach.trades')}
            {pendingTrades.length > 0 && (
              <Badge variant="secondary" className="ml-2">{formatLocalizedNumber(pendingTrades.length, locale)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            {t('coach.enrollments')}
            {pendingEnrollments.length > 0 && (
              <Badge variant="secondary" className="ml-2">{formatLocalizedNumber(pendingEnrollments.length, locale)}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <FacilitatorDashboard />
        </TabsContent>
        <TabsContent value="participants">
          <Card>
            <CardHeader>
              <CardTitle>{t('coach.assignedParticipants')}</CardTitle>
              <CardDescription>{t('coach.participantsListDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('coach.noParticipants')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participantName')}</TableHead>
                      <TableHead>{t('common.email')}</TableHead>
                      <TableHead>{t('common.phone')}</TableHead>
                      <TableHead>{t('admin.batchNumber')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow 
                        key={participant.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedParticipant(participant)}
                      >
                        <TableCell className="font-medium">{participant.full_name}</TableCell>
                        <TableCell>{participant.email}</TableCell>
                        <TableCell>{participant.phone || '-'}</TableCell>
                        <TableCell>{participant.batch_number || '-'}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParticipant(participant);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('coach.viewDetails')}
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
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>{t('coach.pendingTaskSubmissions')}</CardTitle>
              <CardDescription>{t('coach.reviewTasksDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('coach.noPendingTasks')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.task')}</TableHead>
                      <TableHead>{t('coach.submitted')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.participant_name}</p>
                            <p className="text-sm text-muted-foreground">{task.participant_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{task.task_title}</TableCell>
                        <TableCell>
                          {task.submitted_at 
                            ? formatLocalizedDate(task.submitted_at, 'PP', locale)
                            : t('common.na')}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedTask(task);
                              setVerificationNotes('');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
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
              <CardTitle>{t('coach.pendingDocumentReviewsTitle')}</CardTitle>
              <CardDescription>{t('coach.reviewDocumentsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('coach.noPendingDocuments')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.documentType')}</TableHead>
                      <TableHead>{t('coach.fileName')}</TableHead>
                      <TableHead>{t('coach.submitted')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{doc.participant_name}</p>
                            <p className="text-sm text-muted-foreground">{doc.participant_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getDocumentTypeName(doc.document_type)}</TableCell>
                        <TableCell>
                          {doc.file_url ? (
                            <a 
                              href={doc.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {doc.document_name}
                            </a>
                          ) : doc.document_name}
                        </TableCell>
                        <TableCell>
                          {doc.submitted_at 
                            ? formatLocalizedDate(doc.submitted_at, 'PP', locale)
                            : t('common.na')}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setVerificationNotes('');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
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

        <TabsContent value="trades">
          <Card>
            <CardHeader>
              <CardTitle>{t('coach.pendingTradeReviewsTitle')}</CardTitle>
              <CardDescription>{t('coach.reviewTradesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('coach.noPendingTrades')}</p>
                </div>
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
                    {pendingTrades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{trade.participant_name}</p>
                            <p className="text-sm text-muted-foreground">{trade.participant_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{t(`trades.${trade.trade_type}`)}</TableCell>
                        <TableCell>{trade.product_service}</TableCell>
                        <TableCell>{trade.country}</TableCell>
                        <TableCell>₹{trade.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedTrade(trade);
                              setVerificationNotes('');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
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

        <TabsContent value="enrollments">
          <Card>
            <CardHeader>
              <CardTitle>{t('coach.pendingEnrollmentsTitle')}</CardTitle>
              <CardDescription>{t('coach.reviewEnrollmentsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingEnrollments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('coach.noPendingEnrollments')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('coach.participant')}</TableHead>
                      <TableHead>{t('coach.enrollmentName')}</TableHead>
                      <TableHead>{t('coach.status')}</TableHead>
                      <TableHead>{t('coach.submitted')}</TableHead>
                      <TableHead>{t('coach.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingEnrollments.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{enrollment.participant_name}</p>
                            <p className="text-sm text-muted-foreground">{enrollment.participant_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{enrollment.full_name}</TableCell>
                        <TableCell>{getEnrollmentStatusBadge(enrollment.status)}</TableCell>
                        <TableCell>
                          {enrollment.submitted_at 
                            ? formatLocalizedDate(enrollment.submitted_at, 'PP', locale)
                            : t('common.na')}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedEnrollment(enrollment);
                              setVerificationNotes('');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
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
      </Tabs>

      {/* Task Review Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('coach.reviewTaskSubmission')}</DialogTitle>
            <DialogDescription>
              {t('coach.reviewAndProvide')}
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.participant')}</p>
                <p className="font-medium">{selectedTask.participant_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.task')}</p>
                <p className="font-medium">{selectedTask.task_title}</p>
                {selectedTask.task_description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedTask.task_description}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.submissionNotes')}</p>
                <p className="text-sm bg-muted p-3 rounded-lg mt-1">
                  {selectedTask.submission_notes || t('coach.noNotesProvided')}
                </p>
              </div>
              {selectedTask.attachment_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('coach.attachment')}</p>
                  <a 
                    href={selectedTask.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-2 mt-1"
                  >
                    <Paperclip className="h-4 w-4" />
                    {t('coach.viewAttachment')}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('coach.yourFeedback')}</p>
                <Textarea
                  placeholder={t('coach.addFeedback')}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleTaskVerification(false)}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {t('coach.reject')}
            </Button>
            <Button
              onClick={() => handleTaskVerification(true)}
              disabled={processing}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {t('coach.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Review Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('coach.reviewDocument')}</DialogTitle>
            <DialogDescription>
              {t('coach.reviewDocumentAndProvide')}
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.participant')}</p>
                <p className="font-medium">{selectedDocument.participant_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.documentType')}</p>
                <p className="font-medium">{getDocumentTypeName(selectedDocument.document_type)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.file')}</p>
                {selectedDocument.file_url ? (
                  <a 
                    href={selectedDocument.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    {selectedDocument.document_name}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('coach.noFileUploaded')}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('coach.reviewNotes')}</p>
                <Textarea
                  placeholder={t('coach.addReviewNotes')}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleDocumentVerification(false)}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {t('coach.reject')}
            </Button>
            <Button
              onClick={() => handleDocumentVerification(true)}
              disabled={processing}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {t('coach.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trade Review Dialog */}
      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('coach.reviewTrade')}</DialogTitle>
            <DialogDescription>
              {t('coach.reviewTradeAndProvide')}
            </DialogDescription>
          </DialogHeader>
          {selectedTrade && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.participant')}</p>
                <p className="font-medium">{selectedTrade.participant_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('trades.type')}</p>
                  <p className="font-medium">{t(`trades.${selectedTrade.trade_type}`)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('trades.country')}</p>
                  <p className="font-medium">{selectedTrade.country}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('trades.product')}</p>
                <p className="font-medium">{selectedTrade.product_service}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('trades.amount')}</p>
                  <p className="font-medium">₹{selectedTrade.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('trades.date')}</p>
                  <p className="font-medium">{formatLocalizedDate(selectedTrade.trade_date, 'PP', locale)}</p>
                </div>
              </div>
              {selectedTrade.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('trades.notes')}</p>
                  <p className="text-sm bg-muted p-3 rounded-lg mt-1">{selectedTrade.notes}</p>
                </div>
              )}
              {selectedTrade.attachment_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('coach.attachment')}</p>
                  <a 
                    href={selectedTrade.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-2 mt-1"
                  >
                    <Paperclip className="h-4 w-4" />
                    {t('coach.viewAttachment')}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('coach.yourFeedback')}</p>
                <Textarea
                  placeholder={t('coach.addFeedback')}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleTradeVerification(false)}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {t('coach.reject')}
            </Button>
            <Button
              onClick={() => handleTradeVerification(true)}
              disabled={processing}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {t('coach.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrollment Review Dialog */}
      <Dialog open={!!selectedEnrollment} onOpenChange={() => setSelectedEnrollment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('coach.reviewEnrollment')}</DialogTitle>
            <DialogDescription>
              {t('coach.reviewEnrollmentDesc')}
            </DialogDescription>
          </DialogHeader>
          {selectedEnrollment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('coach.enrollmentName')}</p>
                  <p className="font-medium">{selectedEnrollment.full_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('coach.status')}</p>
                  {getEnrollmentStatusBadge(selectedEnrollment.status)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('common.email')}</p>
                  <p className="font-medium">{selectedEnrollment.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('common.phone')}</p>
                  <p className="font-medium">{selectedEnrollment.phone}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.address')}</p>
                <p className="text-sm bg-muted p-3 rounded-lg mt-1">{selectedEnrollment.address}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('coach.dateOfBirth')}</p>
                <p className="font-medium">{formatLocalizedDate(selectedEnrollment.date_of_birth, 'PP', locale)}</p>
              </div>
              {selectedEnrollment.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('coach.notes')}</p>
                  <p className="text-sm bg-muted p-3 rounded-lg mt-1">{selectedEnrollment.notes}</p>
                </div>
              )}
              {selectedEnrollment.attachment_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('coach.attachment')}</p>
                  <a 
                    href={selectedEnrollment.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-2 mt-1"
                  >
                    <Paperclip className="h-4 w-4" />
                    {t('coach.viewAttachment')}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('coach.updateStatus')}</p>
                <Select 
                  value={selectedEnrollment.status}
                  onValueChange={(value) => handleEnrollmentStatusUpdate(value)}
                  disabled={processing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">{t('coach.enrollmentStatus.submitted')}</SelectItem>
                    <SelectItem value="documents_sent_to_user">{t('coach.enrollmentStatus.documentsSentToUser')}</SelectItem>
                    <SelectItem value="documents_sent_to_office">{t('coach.enrollmentStatus.documentsSentToOffice')}</SelectItem>
                    <SelectItem value="completed">{t('coach.enrollmentStatus.completed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t('coach.notes')}</p>
                <Textarea
                  placeholder={t('coach.addNotes')}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedEnrollment(null)}
            >
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      {selectedParticipant && (
        <UserDetailDialog
          open={!!selectedParticipant}
          onOpenChange={(open) => !open && setSelectedParticipant(null)}
          userId={selectedParticipant.id}
          userName={selectedParticipant.full_name}
          userRole="participant"
          userEmail={selectedParticipant.email}
        />
      )}
    </div>
  );
};

export default Coach;
