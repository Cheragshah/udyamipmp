import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  FileText, 
  ClipboardList, 
  TrendingUp, 
  UserPlus, 
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { formatLocalizedNumber, formatLocalizedDate } from '@/lib/formatters';
import { AnalyticsDetailDialog, DrillDownRecord } from '@/components/analytics/AnalyticsDetailDialog';

interface PendingSummary {
  tasks: number;
  documents: number;
  trades: number;
  enrollments: number;
  stagesNotStarted: number;
}

interface ParticipantSummary {
  id: string;
  full_name: string;
  email: string;
  batch_number: string | null;
  pendingTasks: number;
  pendingDocuments: number;
  pendingTrades: number;
  currentStage: number;
  stageStatus: string;
}

interface FacilitatorDashboardProps {
  onNavigateToTab?: (tab: string) => void;
}

const FacilitatorDashboard = ({ onNavigateToTab }: FacilitatorDashboardProps) => {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PendingSummary>({
    tasks: 0,
    documents: 0,
    trades: 0,
    enrollments: 0,
    stagesNotStarted: 0
  });
  const [participantSummaries, setParticipantSummaries] = useState<ParticipantSummary[]>([]);
  
  // Drill-down dialog state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownData, setDrillDownData] = useState<DrillDownRecord[]>([]);
  const [drillDownColumns, setDrillDownColumns] = useState<{ key: keyof DrillDownRecord; label: string }[]>([]);
  
  // Store raw data for drill-down
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [rawDocs, setRawDocs] = useState<any[]>([]);
  const [rawTrades, setRawTrades] = useState<any[]>([]);
  const [rawEnrollments, setRawEnrollments] = useState<any[]>([]);
  const [assignedParticipants, setAssignedParticipants] = useState<any[]>([]);

  const locale = i18n.language;

  useEffect(() => {
    if (user && (role === 'coach' || role === 'admin')) {
      fetchDashboardData();
    }
  }, [user, role]);

  const fetchDashboardData = async () => {
    try {
      // Get assigned participants
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, batch_number, assigned_coach_id');

      const assignedParticipants = role === 'admin' 
        ? profiles || []
        : (profiles || []).filter(p => p.assigned_coach_id === user?.id);

      const participantIds = assignedParticipants.map(p => p.id);

      if (participantIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch all pending items
      const [tasksRes, docsRes, tradesRes, enrollmentsRes, progressRes, stagesRes] = await Promise.all([
        supabase.from('task_submissions').select('*, tasks(title)').in('user_id', participantIds).eq('status', 'submitted'),
        supabase.from('documents').select('*').in('user_id', participantIds).eq('status', 'submitted'),
        supabase.from('trades').select('*').in('user_id', participantIds).eq('status', 'pending'),
        supabase.from('enrollment_submissions').select('*').in('user_id', participantIds).eq('status', 'submitted'),
        supabase.from('participant_progress').select('user_id, stage_id, status').in('user_id', participantIds),
        supabase.from('journey_stages').select('id, stage_order').eq('is_active', true)
      ]);

      const tasks = tasksRes.data || [];
      const docs = docsRes.data || [];
      const trades = tradesRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const progress = progressRes.data || [];
      const stages = stagesRes.data || [];

      // Store raw data for drill-down
      setRawTasks(tasks);
      setRawDocs(docs);
      setRawTrades(trades);
      setRawEnrollments(enrollments);
      setAssignedParticipants(assignedParticipants);

      // Calculate summary
      setSummary({
        tasks: tasks.length,
        documents: docs.length,
        trades: trades.length,
        enrollments: enrollments.length,
        stagesNotStarted: participantIds.length * stages.length - progress.length
      });

      // Calculate per-participant summary
      const summaries: ParticipantSummary[] = assignedParticipants.map(p => {
        const userProgress = progress.filter(pr => pr.user_id === p.id);
        const completedStages = userProgress.filter(pr => pr.status === 'completed').length;
        const currentStageProgress = userProgress.find(pr => pr.status === 'in_progress');
        
        // Find current stage order
        let currentStageOrder = 1;
        if (currentStageProgress) {
          const stage = stages.find(s => s.id === currentStageProgress.stage_id);
          currentStageOrder = stage?.stage_order || 1;
        } else if (completedStages > 0) {
          currentStageOrder = completedStages + 1;
        }

        return {
          id: p.id,
          full_name: p.full_name || 'Unknown',
          email: p.email || '',
          batch_number: p.batch_number,
          pendingTasks: tasks.filter(t => t.user_id === p.id).length,
          pendingDocuments: docs.filter(d => d.user_id === p.id).length,
          pendingTrades: trades.filter(tr => tr.user_id === p.id).length,
          currentStage: currentStageOrder,
          stageStatus: currentStageProgress ? 'in_progress' : (completedStages === stages.length ? 'completed' : 'not_started')
        };
      });

      // Sort by pending items (most pending first)
      summaries.sort((a, b) => {
        const aPending = a.pendingTasks + a.pendingDocuments + a.pendingTrades;
        const bPending = b.pendingTasks + b.pendingDocuments + b.pendingTrades;
        return bPending - aPending;
      });

      setParticipantSummaries(summaries);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalPending = () => {
    return summary.tasks + summary.documents + summary.trades + summary.enrollments;
  };

  const getStatusIcon = (stageStatus: string) => {
    switch (stageStatus) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Drill-down handler for coach dashboard
  const handleDrillDown = (type: 'tasks' | 'documents' | 'trades' | 'enrollments') => {
    let title = '';
    let records: DrillDownRecord[] = [];
    
    if (type === 'tasks') {
      title = t('coach.pendingTaskReviews');
      records = rawTasks.map(task => {
        const profile = assignedParticipants.find(p => p.id === task.user_id);
        return {
          id: task.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: 'submitted',
          extra: task.tasks?.title || '-',
        };
      });
      setDrillDownColumns([
        { key: 'userName', label: t('admin.name') },
        { key: 'email', label: t('admin.email') },
        { key: 'batch', label: t('admin.batchNumber') },
        { key: 'extra', label: t('tasks.title') },
        { key: 'status', label: t('finance.status') },
      ]);
    } else if (type === 'documents') {
      title = t('coach.pendingDocumentReviews');
      records = rawDocs.map(doc => {
        const profile = assignedParticipants.find(p => p.id === doc.user_id);
        return {
          id: doc.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: 'submitted',
          extra: doc.document_name || '-',
        };
      });
      setDrillDownColumns([
        { key: 'userName', label: t('admin.name') },
        { key: 'email', label: t('admin.email') },
        { key: 'batch', label: t('admin.batchNumber') },
        { key: 'extra', label: t('documentsPage.title') },
        { key: 'status', label: t('finance.status') },
      ]);
    } else if (type === 'trades') {
      title = t('coach.pendingTradeReviews');
      records = rawTrades.map(trade => {
        const profile = assignedParticipants.find(p => p.id === trade.user_id);
        return {
          id: trade.id,
          userName: profile?.full_name || t('common.na'),
          email: profile?.email || '-',
          batch: profile?.batch_number || undefined,
          status: 'pending',
          extra: trade.product_service || '-',
        };
      });
      setDrillDownColumns([
        { key: 'userName', label: t('admin.name') },
        { key: 'email', label: t('admin.email') },
        { key: 'batch', label: t('admin.batchNumber') },
        { key: 'extra', label: t('trades.productService') },
        { key: 'status', label: t('finance.status') },
      ]);
    } else {
      title = t('coach.pendingEnrollments');
      records = rawEnrollments.map(enroll => {
        const profile = assignedParticipants.find(p => p.id === enroll.user_id);
        return {
          id: enroll.id,
          userName: profile?.full_name || enroll.full_name || t('common.na'),
          email: profile?.email || enroll.email || '-',
          batch: profile?.batch_number || undefined,
          status: enroll.status,
        };
      });
      setDrillDownColumns([
        { key: 'userName', label: t('admin.name') },
        { key: 'email', label: t('admin.email') },
        { key: 'batch', label: t('admin.batchNumber') },
        { key: 'status', label: t('finance.status') },
      ]);
    }
    
    setDrillDownTitle(title);
    setDrillDownData(records);
    setDrillDownOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const participantsWithPending = participantSummaries.filter(
    p => p.pendingTasks > 0 || p.pendingDocuments > 0 || p.pendingTrades > 0
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={`${getTotalPending() > 0 ? 'border-destructive' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('facilitator.totalPending')}</CardTitle>
            <AlertCircle className={`h-4 w-4 ${getTotalPending() > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(getTotalPending(), locale)}</div>
            <p className="text-xs text-muted-foreground">{t('facilitator.itemsNeedAttention')}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onNavigateToTab?.('tasks')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingTaskReviews')}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(summary.tasks, locale)}</div>
            {summary.tasks > 0 && <Badge variant="destructive" className="mt-1">{t('coach.actionRequired')}</Badge>}
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onNavigateToTab?.('documents')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingDocumentReviews')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(summary.documents, locale)}</div>
            {summary.documents > 0 && <Badge variant="destructive" className="mt-1">{t('coach.actionRequired')}</Badge>}
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onNavigateToTab?.('trades')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingTradeReviews')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(summary.trades, locale)}</div>
            {summary.trades > 0 && <Badge variant="destructive" className="mt-1">{t('coach.actionRequired')}</Badge>}
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onNavigateToTab?.('enrollments')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('coach.pendingEnrollments')}</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(summary.enrollments, locale)}</div>
            {summary.enrollments > 0 && <Badge variant="destructive" className="mt-1">{t('coach.actionRequired')}</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Participants with Pending Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('facilitator.participantsNeedingAttention')}
          </CardTitle>
          <CardDescription>{t('facilitator.participantsNeedingAttentionDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {participantsWithPending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('facilitator.allCaughtUp')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.name')}</TableHead>
                  <TableHead>{t('admin.batchNumber')}</TableHead>
                  <TableHead>{t('facilitator.currentStage')}</TableHead>
                  <TableHead className="text-center">{t('coach.taskSubmissions')}</TableHead>
                  <TableHead className="text-center">{t('coach.documents')}</TableHead>
                  <TableHead className="text-center">{t('coach.trades')}</TableHead>
                  <TableHead>{t('facilitator.totalPending')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantsWithPending.slice(0, 10).map((participant) => {
                  const totalPending = participant.pendingTasks + participant.pendingDocuments + participant.pendingTrades;
                  return (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{participant.full_name}</p>
                          <p className="text-xs text-muted-foreground">{participant.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {participant.batch_number ? (
                          <Badge variant="outline">{participant.batch_number}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(participant.stageStatus)}
                          <span>{t('facilitator.stage')} {participant.currentStage}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {participant.pendingTasks > 0 ? (
                          <Badge variant="destructive">{participant.pendingTasks}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {participant.pendingDocuments > 0 ? (
                          <Badge variant="destructive">{participant.pendingDocuments}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {participant.pendingTrades > 0 ? (
                          <Badge variant="destructive">{participant.pendingTrades}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={totalPending > 0 ? 'destructive' : 'secondary'}>
                          {totalPending} {t('facilitator.items')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All Participants Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('facilitator.allParticipants')}
          </CardTitle>
          <CardDescription>{t('facilitator.allParticipantsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.name')}</TableHead>
                <TableHead>{t('admin.email')}</TableHead>
                <TableHead>{t('admin.batchNumber')}</TableHead>
                <TableHead>{t('facilitator.currentStage')}</TableHead>
                <TableHead>{t('facilitator.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantSummaries.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium">{participant.full_name}</TableCell>
                  <TableCell>{participant.email}</TableCell>
                  <TableCell>
                    {participant.batch_number ? (
                      <Badge variant="outline">{participant.batch_number}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <span>{t('facilitator.stage')} {participant.currentStage}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(participant.stageStatus)}
                      <span className="capitalize">{participant.stageStatus.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FacilitatorDashboard;