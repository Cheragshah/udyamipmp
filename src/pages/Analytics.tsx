import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Users, CheckCircle, FileText, TrendingUp, FileBarChart } from 'lucide-react';
import { formatLocalizedNumber, formatLocalizedCurrency } from '@/lib/formatters';
import { AnalyticsDetailDialog, DrillDownRecord } from '@/components/analytics/AnalyticsDetailDialog';
import { CustomReportBuilder } from '@/components/analytics/CustomReportBuilder';

interface AnalyticsData {
  totalParticipants: number;
  activeParticipants: number;
  tasksCompleted: number;
  totalTasks: number;
  documentsApproved: number;
  totalDocuments: number;
  totalTradeVolume: number;
  averageAttendance: number;
  stageProgress: { name: string; completed: number; total: number }[];
  tasksByStatus: { status: string; count: number }[];
  documentsByStatus: { status: string; count: number }[];
  tradesByMonth: { month: string; exports: number; imports: number }[];
  attendanceByWeek: { week: string; count: number }[];
}

interface RawData {
  profiles: any[];
  stages: any[];
  progress: any[];
  tasks: any[];
  submissions: any[];
  documents: any[];
  trades: any[];
  attendance: any[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', '#22c55e', '#3b82f6', '#f97316'];

const Analytics = () => {
  const { t, i18n } = useTranslation();
  const { user, role } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Drill-down dialog state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownData, setDrillDownData] = useState<DrillDownRecord[]>([]);
  const [drillDownColumns, setDrillDownColumns] = useState<{ key: keyof DrillDownRecord; label: string }[]>([]);

  useEffect(() => {
    if (user && (role === 'admin' || role === 'coach')) {
      fetchAnalytics();
    }
  }, [user, role]);

  const fetchAnalytics = async () => {
    try {
      // Fetch all required data
      const [
        { data: profiles },
        { data: stages },
        { data: progress },
        { data: tasks },
        { data: submissions },
        { data: documents },
        { data: trades },
        { data: attendance }
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, batch_number, assigned_coach_id'),
        supabase.from('journey_stages').select('*').eq('is_active', true).order('stage_order'),
        supabase.from('participant_progress').select('*'),
        supabase.from('tasks').select('*').eq('is_active', true),
        supabase.from('task_submissions').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('trades').select('*'),
        supabase.from('attendance').select('*')
      ]);

      // Store raw data for drill-down
      setRawData({
        profiles: profiles || [],
        stages: stages || [],
        progress: progress || [],
        tasks: tasks || [],
        submissions: submissions || [],
        documents: documents || [],
        trades: trades || [],
        attendance: attendance || [],
      });

      // Calculate metrics
      const participants = role === 'coach' 
        ? (profiles || []).filter(p => p.assigned_coach_id === user?.id)
        : profiles || [];
      
      const participantIds = participants.map(p => p.id);
      
      const filteredSubmissions = role === 'coach'
        ? (submissions || []).filter(s => participantIds.includes(s.user_id))
        : submissions || [];
      
      const filteredDocuments = role === 'coach'
        ? (documents || []).filter(d => participantIds.includes(d.user_id))
        : documents || [];
      
      const filteredTrades = role === 'coach'
        ? (trades || []).filter(t => participantIds.includes(t.user_id))
        : trades || [];
      
      const filteredAttendance = role === 'coach'
        ? (attendance || []).filter(a => participantIds.includes(a.user_id))
        : attendance || [];

      // Stage progress
      const stageProgress = (stages || []).map(stage => {
        const completed = (progress || []).filter(
          p => p.stage_id === stage.id && p.status === 'completed' && participantIds.includes(p.user_id)
        ).length;
        return { name: stage.name, completed, total: participants.length };
      });

      // Tasks by status
      const taskStatuses = ['not_started', 'in_progress', 'submitted', 'verified', 'rejected'];
      const tasksByStatus = taskStatuses.map(status => ({
        status: status,
        count: filteredSubmissions.filter(s => s.status === status).length
      }));

      // Documents by status
      const docStatuses = ['pending', 'submitted', 'under_review', 'approved', 'rejected'];
      const documentsByStatus = docStatuses.map(status => ({
        status: status,
        count: filteredDocuments.filter(d => d.status === status).length
      }));

      // Trades by month
      const tradesByMonth: Record<string, { exports: number; imports: number }> = {};
      filteredTrades.forEach(trade => {
        const month = new Date(trade.trade_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!tradesByMonth[month]) tradesByMonth[month] = { exports: 0, imports: 0 };
        if (trade.trade_type === 'export') {
          tradesByMonth[month].exports += Number(trade.amount);
        } else {
          tradesByMonth[month].imports += Number(trade.amount);
        }
      });

      // Attendance by week
      const attendanceByWeek: Record<string, number> = {};
      filteredAttendance.forEach(a => {
        const week = `Week ${Math.ceil(new Date(a.date).getDate() / 7)}`;
        attendanceByWeek[week] = (attendanceByWeek[week] || 0) + 1;
      });

      setData({
        totalParticipants: participants.length,
        activeParticipants: new Set(filteredSubmissions.map(s => s.user_id)).size,
        tasksCompleted: filteredSubmissions.filter(s => s.status === 'verified').length,
        totalTasks: (tasks?.length || 0) * participants.length,
        documentsApproved: filteredDocuments.filter(d => d.status === 'approved').length,
        totalDocuments: 6 * participants.length,
        totalTradeVolume: filteredTrades.reduce((sum, t) => sum + Number(t.amount), 0),
        averageAttendance: participants.length > 0 
          ? filteredAttendance.length / participants.length 
          : 0,
        stageProgress,
        tasksByStatus,
        documentsByStatus,
        tradesByMonth: Object.entries(tradesByMonth).map(([month, data]) => ({ month, ...data })),
        attendanceByWeek: Object.entries(attendanceByWeek).map(([week, count]) => ({ week, count }))
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    return t(`analytics.statuses.${status}`, status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
  };

  // Drill-down handlers
  const handleStageClick = (stageName: string) => {
    if (!rawData) return;
    
    const stage = rawData.stages.find(s => s.name === stageName);
    if (!stage) return;

    const stageProgress = rawData.progress.filter(p => p.stage_id === stage.id);
    const profileMap = new Map(rawData.profiles.map(p => [p.id, p]));
    
    const records: DrillDownRecord[] = stageProgress.map(p => {
      const profile = profileMap.get(p.user_id);
      return {
        id: p.id,
        userName: profile?.full_name || 'Unknown',
        email: profile?.email || '-',
        batch: profile?.batch_number || '-',
        status: p.status,
        date: p.completed_at ? new Date(p.completed_at).toLocaleDateString() : '-',
      };
    });

    setDrillDownTitle(`${stageName} - ${t('reports.participants')}`);
    setDrillDownData(records);
    setDrillDownColumns([
      { key: 'userName', label: t('admin.name') },
      { key: 'email', label: t('admin.email') },
      { key: 'batch', label: t('admin.batchNumber') },
      { key: 'status', label: t('common.status') },
      { key: 'date', label: t('reports.completedDate') },
    ]);
    setDrillDownOpen(true);
  };

  const handleTaskStatusClick = (status: string) => {
    if (!rawData) return;
    
    const filtered = rawData.submissions.filter(s => s.status === status);
    const profileMap = new Map(rawData.profiles.map(p => [p.id, p]));
    const taskMap = new Map(rawData.tasks.map(t => [t.id, t]));
    
    const records: DrillDownRecord[] = filtered.map(s => {
      const profile = profileMap.get(s.user_id);
      const task = taskMap.get(s.task_id);
      return {
        id: s.id,
        userName: profile?.full_name || 'Unknown',
        email: profile?.email || '-',
        batch: profile?.batch_number || '-',
        status: s.status,
        extra: task?.title || 'Unknown Task',
        date: s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '-',
      };
    });

    setDrillDownTitle(`${getStatusLabel(status)} - ${t('analytics.tasks')}`);
    setDrillDownData(records);
    setDrillDownColumns([
      { key: 'userName', label: t('admin.name') },
      { key: 'extra', label: t('coach.task') },
      { key: 'batch', label: t('admin.batchNumber') },
      { key: 'status', label: t('common.status') },
      { key: 'date', label: t('coach.submitted') },
    ]);
    setDrillDownOpen(true);
  };

  const handleDocStatusClick = (status: string) => {
    if (!rawData) return;
    
    const filtered = rawData.documents.filter(d => d.status === status);
    const profileMap = new Map(rawData.profiles.map(p => [p.id, p]));
    
    const records: DrillDownRecord[] = filtered.map(d => {
      const profile = profileMap.get(d.user_id);
      return {
        id: d.id,
        userName: profile?.full_name || 'Unknown',
        email: profile?.email || '-',
        batch: profile?.batch_number || '-',
        status: d.status,
        extra: d.document_type,
        date: d.submitted_at ? new Date(d.submitted_at).toLocaleDateString() : '-',
      };
    });

    setDrillDownTitle(`${getStatusLabel(status)} - ${t('analytics.documents')}`);
    setDrillDownData(records);
    setDrillDownColumns([
      { key: 'userName', label: t('admin.name') },
      { key: 'extra', label: t('coach.documentType') },
      { key: 'batch', label: t('admin.batchNumber') },
      { key: 'status', label: t('common.status') },
      { key: 'date', label: t('coach.submitted') },
    ]);
    setDrillDownOpen(true);
  };

  if (role !== 'admin' && role !== 'coach') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t('analytics.accessDenied')}</CardTitle>
            <CardDescription>{t('analytics.noPermissionAnalytics')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!data) return null;

  const locale = i18n.language;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
        <p className="text-muted-foreground">
          {role === 'admin' ? t('analytics.programWide') : t('analytics.yourParticipants')}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.participants')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(data.totalParticipants, locale)}</div>
            <p className="text-xs text-muted-foreground">{formatLocalizedNumber(data.activeParticipants, locale)} {t('analytics.active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.tasksVerified')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(data.tasksCompleted, locale)}</div>
            <Progress value={(data.tasksCompleted / data.totalTasks) * 100} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.documentsApproved')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedNumber(data.documentsApproved, locale)}</div>
            <Progress value={(data.documentsApproved / data.totalDocuments) * 100} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.tradeVolume')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLocalizedCurrency(data.totalTradeVolume, locale)}</div>
            <p className="text-xs text-muted-foreground">{t('analytics.totalValue')}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList>
          <TabsTrigger value="progress">{t('analytics.journeyProgress')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('analytics.tasks')}</TabsTrigger>
          <TabsTrigger value="documents">{t('analytics.documents')}</TabsTrigger>
          <TabsTrigger value="trades">{t('analytics.tradeAnalytics')}</TabsTrigger>
          {role === 'admin' && (
            <TabsTrigger value="custom">
              <FileBarChart className="h-4 w-4 mr-1" />
              {t('reports.customReports')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.stageCompletion')}</CardTitle>
              <CardDescription>{t('analytics.stageCompletionDesc')} - {t('reports.clickToViewDetails')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.stageProgress} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar 
                      dataKey="completed" 
                      fill="hsl(var(--primary))" 
                      name={t('analytics.completed')} 
                      cursor="pointer"
                      onClick={(data) => handleStageClick(data.name)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.tasksByStatus')}</CardTitle>
                <CardDescription>{t('reports.clickToViewDetails')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.tasksByStatus.filter(t => t.count > 0).map(item => ({
                          ...item,
                          displayStatus: getStatusLabel(item.status)
                        }))}
                        dataKey="count"
                        nameKey="displayStatus"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ displayStatus, count }) => `${displayStatus}: ${formatLocalizedNumber(count, locale)}`}
                        cursor="pointer"
                        onClick={(data) => handleTaskStatusClick(data.status)}
                      >
                        {data.tasksByStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.taskBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.tasksByStatus.map((item, index) => (
                  <div 
                    key={item.status} 
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                    onClick={() => handleTaskStatusClick(item.status)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{getStatusLabel(item.status)}</span>
                    </div>
                    <span className="font-medium">{formatLocalizedNumber(item.count, locale)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.documentsByStatus')}</CardTitle>
                <CardDescription>{t('reports.clickToViewDetails')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={data.documentsByStatus.map(item => ({
                        ...item,
                        displayStatus: getStatusLabel(item.status)
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="displayStatus" />
                      <YAxis />
                      <Tooltip />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        cursor="pointer"
                        onClick={(data) => handleDocStatusClick(data.status)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.documentBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.documentsByStatus.map((item, index) => (
                  <div 
                    key={item.status} 
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                    onClick={() => handleDocStatusClick(item.status)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{getStatusLabel(item.status)}</span>
                    </div>
                    <span className="font-medium">{formatLocalizedNumber(item.count, locale)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trades">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.tradeVolumeOverTime')}</CardTitle>
              <CardDescription>{t('analytics.monthlyExportsImports')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.tradesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatLocalizedCurrency(Number(value), locale)} />
                    <Legend />
                    <Line type="monotone" dataKey="exports" stroke="hsl(var(--primary))" strokeWidth={2} name={t('trades.export')} />
                    <Line type="monotone" dataKey="imports" stroke="hsl(var(--secondary))" strokeWidth={2} name={t('trades.import')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {role === 'admin' && (
          <TabsContent value="custom">
            <CustomReportBuilder />
          </TabsContent>
        )}
      </Tabs>

      {/* Drill-Down Dialog */}
      <AnalyticsDetailDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownTitle}
        data={drillDownData}
        columns={drillDownColumns}
      />
    </div>
  );
};

export default Analytics;
